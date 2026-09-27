package com.zaethcom.puente.core

import android.content.Context
import com.zaethcom.puente.usb.UsbRawTransport
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

data class Linea(val cuando: String, val texto: String, val esError: Boolean)

/**
 * El corazón del puente: sabe qué impresora USB corresponde a cada rol y le escribe
 * los bytes tal cual llegaron.
 *
 * Abre y cierra el USB en cada trabajo en vez de mantenerlo tomado. Una impresora de
 * mostrador se apaga, se queda sin papel y se desenchufa; una conexión viva a través
 * de eso es una conexión que miente. Abrir cuesta milisegundos y el fallo sale en el
 * trabajo que lo causó, no tres trabajos después.
 *
 * El [Mutex] por rol es necesario: los dos servidores (TCP y HTTP) atienden cada
 * cliente en su propia corrutina, y dos escrituras cruzadas sobre el mismo endpoint
 * USB salen impresas entrelazadas.
 */
class Puente(private val context: Context) : Impresor {

    private val almacen = AlmacenConfig(context)

    private val _config = MutableStateFlow(almacen.cargar())
    val config: StateFlow<ConfigPuente> = _config

    private val _bitacora = MutableStateFlow<List<Linea>>(emptyList())
    val bitacora: StateFlow<List<Linea>> = _bitacora

    /**
     * Un cerrojo por dispositivo USB, NO por rol.
     *
     * Los dos roles pueden estar asignados a la misma impresora física -- de hecho es
     * la configuración de arranque mientras haya una sola conectada. Con un cerrojo
     * por rol, un ticket y una etiqueta simultáneos se reclaman el mismo endpoint a la
     * vez y salen entrelazados en el papel. La identidad que importa es la del
     * aparato, así que la clave es su VID/PID.
     */
    private val cerrojos = ConcurrentHashMap<String, Mutex>()

    private fun cerrojoDe(cfg: ImpresoraCfg): Mutex =
        cerrojos.getOrPut("${cfg.vendorId}:${cfg.productId}") { Mutex() }
    private val reloj = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    fun actualizar(cfg: ImpresoraCfg) {
        val nueva = _config.value.con(cfg)
        _config.value = nueva
        almacen.guardar(nueva)
    }

    override fun secretoHttp(): String = _config.value.secretoHttp

    fun actualizarHttp(secreto: String, puerto: Int) {
        val nueva = _config.value.copy(secretoHttp = secreto, puertoHttp = puerto)
        _config.value = nueva
        almacen.guardar(nueva)
    }

    override fun anotar(texto: String, esError: Boolean) {
        val linea = Linea(reloj.format(Date()), texto, esError)
        // Se queda con las últimas 200: es una pantalla de diagnóstico, no un archivo.
        _bitacora.value = (_bitacora.value + linea).takeLast(200)
    }

    /** Manda [datos] a la impresora del [rol]. Serializado por rol. */
    override suspend fun imprimir(rol: Rol, datos: ByteArray): Resultado {
        val cfg = _config.value.de(rol)
        if (!cfg.asignada) {
            return fallo(rol, "No hay impresora asignada al rol ${rol.etiqueta} en este dispositivo")
        }

        return cerrojoDe(cfg).withLock {
            val transporte = UsbRawTransport(context)
            val dispositivo = transporte.buscar(cfg.vendorId!!, cfg.productId!!)
                ?: return@withLock fallo(
                    rol,
                    "La impresora de ${rol.etiqueta} no está conectada " +
                        "(se buscaba VID ${cfg.vendorId} / PID ${cfg.productId})"
                )

            if (!transporte.tienePermiso(dispositivo)) {
                return@withLock fallo(
                    rol,
                    "Android no ha concedido permiso USB para la impresora de ${rol.etiqueta}. " +
                        "Abrir la app del puente y aceptarlo."
                )
            }

            val motivoApertura = transporte.abrir(dispositivo)
            if (motivoApertura != null) return@withLock fallo(rol, motivoApertura)

            try {
                val motivoEscritura = transporte.escribir(datos)
                if (motivoEscritura != null) return@withLock fallo(rol, motivoEscritura)
                anotar("${rol.etiqueta}: ${datos.size} bytes impresos")
                Resultado.Ok
            } finally {
                transporte.cerrar()
            }
        }
    }

    private fun fallo(rol: Rol, motivo: String): Resultado.Error {
        anotar("${rol.etiqueta}: $motivo", esError = true)
        return Resultado.Error(motivo)
    }
}
