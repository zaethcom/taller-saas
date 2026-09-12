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

/** Resultado de un trabajo. El mensaje viaja tal cual al cliente, así que se escribe
 *  pensando en quien lo va a leer en la consola de la estación, no en el log. */
sealed interface Resultado {
    data object Ok : Resultado
    data class Error(val motivo: String) : Resultado
}

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
class Puente(private val context: Context) {

    private val almacen = AlmacenConfig(context)

    private val _config = MutableStateFlow(almacen.cargar())
    val config: StateFlow<ConfigPuente> = _config

    private val _bitacora = MutableStateFlow<List<Linea>>(emptyList())
    val bitacora: StateFlow<List<Linea>> = _bitacora

    private val cerrojos: Map<Rol, Mutex> = Rol.entries.associateWith { Mutex() }
    private val reloj = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    fun actualizar(cfg: ImpresoraCfg) {
        val nueva = _config.value.con(cfg)
        _config.value = nueva
        almacen.guardar(nueva)
    }

    fun actualizarHttp(secreto: String, puerto: Int) {
        val nueva = _config.value.copy(secretoHttp = secreto, puertoHttp = puerto)
        _config.value = nueva
        almacen.guardar(nueva)
    }

    fun anotar(texto: String, esError: Boolean = false) {
        val linea = Linea(reloj.format(Date()), texto, esError)
        // Se queda con las últimas 200: es una pantalla de diagnóstico, no un archivo.
        _bitacora.value = (_bitacora.value + linea).takeLast(200)
    }

    /** Manda [datos] a la impresora del [rol]. Serializado por rol. */
    suspend fun imprimir(rol: Rol, datos: ByteArray): Resultado {
        val cfg = _config.value.de(rol)
        if (!cfg.asignada) {
            return fallo(rol, "No hay impresora asignada al rol ${rol.etiqueta} en este dispositivo")
        }

        return cerrojos.getValue(rol).withLock {
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
