package com.zaethcom.puente.usb

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.usb.UsbConstants
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbDeviceConnection
import android.hardware.usb.UsbEndpoint
import android.hardware.usb.UsbInterface
import android.hardware.usb.UsbManager
import android.os.Build
import androidx.core.content.ContextCompat
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume

private const val ACCION_PERMISO_USB = "com.zaethcom.puente.USB_PERMISSION"

/** Tope por transferencia. Android acepta más, pero trocear evita fallos silenciosos
 *  con payloads grandes (una etiqueta con logo pasa de los 100 KB sin esfuerzo). */
private const val TROZO = 16 * 1024

/** Cuántas transferencias seguidas de cero bytes se toleran antes de darla por muerta.
 *  Con el timeout de bulkTransfer en 8 s, tres vueltas son ~24 s de silencio real. */
private const val MAX_VUELTAS_SIN_AVANCE = 3

/**
 * Mueve bytes crudos a una impresora USB. No sabe nada de ESC/POS, ZPL ni PPLB: este
 * puente reenvía exactamente lo que le llega por la red, porque quien lo generó ya
 * decidió el protocolo. Portado de smart-food-label
 * (printer/usb/UsbPrinterConnection.kt), que es la versión probada contra hardware
 * real; los cambios son el troceado de [escribir] y los mensajes en español.
 */
class UsbRawTransport(private val context: Context) {

    private val usbManager: UsbManager by lazy {
        context.getSystemService(Context.USB_SERVICE) as UsbManager
    }

    private var conexion: UsbDeviceConnection? = null
    private var interfaz: UsbInterface? = null
    private var salida: UsbEndpoint? = null

    fun dispositivos(): List<UsbDevice> = usbManager.deviceList.values.toList()

    fun buscar(vendorId: Int, productId: Int): UsbDevice? =
        usbManager.deviceList.values.firstOrNull {
            it.vendorId == vendorId && it.productId == productId
        }

    fun tienePermiso(dispositivo: UsbDevice): Boolean = usbManager.hasPermission(dispositivo)

    suspend fun pedirPermiso(dispositivo: UsbDevice): Boolean = suspendCancellableCoroutine { cont ->
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) PendingIntent.FLAG_MUTABLE else 0
        // setPackage() vuelve el intent explícito: sin esto Android 14+ rechaza un
        // PendingIntent mutable con intent implícito. Heredado de smart-food-label,
        // donde se diagnosticó en vivo.
        val intento = PendingIntent.getBroadcast(
            context, 0, Intent(ACCION_PERMISO_USB).setPackage(context.packageName), flags
        )
        val receptor = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context, intent: Intent) {
                if (intent.action != ACCION_PERMISO_USB) return
                runCatching { context.unregisterReceiver(this) }
                val concedido = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false)
                if (cont.isActive) cont.resume(concedido)
            }
        }
        ContextCompat.registerReceiver(
            context, receptor, IntentFilter(ACCION_PERMISO_USB), ContextCompat.RECEIVER_NOT_EXPORTED
        )
        // Si la corrutina se cancela con el diálogo de permiso abierto -- girar la
        // pantalla basta -- el receptor quedaría registrado para siempre y la
        // asignación se perdería en silencio.
        cont.invokeOnCancellation { runCatching { context.unregisterReceiver(receptor) } }
        usbManager.requestPermission(dispositivo, intento)
    }

    /**
     * Reclama la interfaz y localiza el endpoint de salida. Acepta bulk e interrupt:
     * algunas etiquetadoras se presentan como HID en vez de clase Printer, y
     * bulkTransfer() funciona igual con las dos.
     *
     * Devuelve null si abrió bien, o el motivo concreto del fallo.
     */
    fun abrir(dispositivo: UsbDevice): String? {
        for (i in 0 until dispositivo.interfaceCount) {
            val iface = dispositivo.getInterface(i)
            for (e in 0 until iface.endpointCount) {
                val ep = iface.getEndpoint(e)
                val esSalida = (ep.type == UsbConstants.USB_ENDPOINT_XFER_BULK ||
                    ep.type == UsbConstants.USB_ENDPOINT_XFER_INT) &&
                    ep.direction == UsbConstants.USB_DIR_OUT
                if (!esSalida) continue

                val con = usbManager.openDevice(dispositivo)
                    ?: return "openDevice() devolvió null: el dispositivo no está accesible " +
                        "(desconectado, sin alimentación estable, o ya abierto por otro proceso)"
                if (!con.claimInterface(iface, true)) {
                    con.close()
                    return "claimInterface() falló en la interfaz ${iface.id}: otro proceso la tiene tomada"
                }
                conexion = con
                interfaz = iface
                salida = ep
                return null
            }
        }
        val detalle = (0 until dispositivo.interfaceCount).joinToString("; ") { i ->
            val iface = dispositivo.getInterface(i)
            val eps = (0 until iface.endpointCount).joinToString(",") { e ->
                val ep = iface.getEndpoint(e); "tipo=${ep.type} dir=${ep.direction}"
            }
            "iface$i clase=${iface.interfaceClass} endpoints=[$eps]"
        }
        return "El dispositivo no expone endpoint de salida en sus ${dispositivo.interfaceCount} " +
            "interfaz(ces): $detalle"
    }

    fun abierto(): Boolean = conexion != null && salida != null

    /**
     * Escribe todos los bytes, troceando. Devuelve null si salió todo, o el motivo
     * del fallo indicando cuánto alcanzó a salir -- si la impresora se queda a medias,
     * saberlo cambia el diagnóstico.
     */
    fun escribir(datos: ByteArray, timeoutMs: Int = 8000): String? {
        val con = conexion ?: return "La conexión USB no está abierta"
        val ep = salida ?: return "La conexión USB no tiene endpoint de salida"

        var enviados = 0
        var sinAvance = 0
        while (enviados < datos.size) {
            val n = minOf(TROZO, datos.size - enviados)
            val trozo = datos.copyOfRange(enviados, enviados + n)
            val escritos = con.bulkTransfer(ep, trozo, trozo.size, timeoutMs)

            if (escritos < 0) {
                return "bulkTransfer() falló tras $enviados de ${datos.size} bytes"
            }

            // Una transferencia parcial NO es un fallo: el bus puede aceptar menos de
            // lo pedido y lo correcto es seguir mandando el resto. Tratarlo como fatal
            // cortaba una etiqueta grande a la mitad. Lo que sí es un fallo es que deje
            // de avanzar del todo, y eso se detecta contando vueltas sin progreso en
            // vez de rindiéndose en la primera parcial.
            if (escritos == 0) {
                sinAvance++
                if (sinAvance >= MAX_VUELTAS_SIN_AVANCE) {
                    return "La impresora dejó de aceptar datos en el byte $enviados de ${datos.size}"
                }
            } else {
                sinAvance = 0
            }

            enviados += escritos
        }
        return null
    }

    fun cerrar() {
        interfaz?.let { runCatching { conexion?.releaseInterface(it) } }
        runCatching { conexion?.close() }
        conexion = null
        salida = null
        interfaz = null
    }
}
