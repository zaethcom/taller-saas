package com.zaethcom.puente.net

import com.zaethcom.puente.core.Impresor
import com.zaethcom.puente.core.Resultado
import com.zaethcom.puente.core.Rol
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.io.DataInputStream
import java.io.EOFException
import java.io.OutputStreamWriter
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException

private const val MAX_PAYLOAD = 20_000_000

/**
 * Un servidor por rol, cada uno en su propio puerto. El rol NO viaja en el protocolo:
 * lo determina el puerto al que llegó la conexión.
 *
 * Esa decisión es deliberada. El protocolo ya existe y hay clientes hablándolo hoy
 * (DestinoPuenteAndroid, en estacion/destino.ts): 4 bytes de longitud en big-endian,
 * el payload, y una línea "OK" o "ERR:<motivo>". Meterle un campo de rol obligaría a
 * versionarlo y a cambiar cliente y servidor a la vez. Un segundo puerto no cambia
 * nada para quien ya apuntaba al 9100, y para las etiquetas es editar un número en
 * config.json -- que ya tiene `puerto` por impresora.
 */
class ServidorTcp(
    private val rol: Rol,
    private val impresor: Impresor
) {
    private val scope = CoroutineScope(Dispatchers.IO)
    private var socketServidor: ServerSocket? = null
    private var job: Job? = null

    val activo: Boolean get() = job?.isActive == true

    /** El puerto realmente enlazado, o -1. Con puerto 0 lo elige el sistema, que es
     *  como lo usan las pruebas. */
    var puertoActivo: Int = -1
        private set

    /**
     * Enlaza el puerto de forma síncrona y solo después lanza el bucle de aceptación.
     * Si se enlazara dentro de la corrutina, un puerto ocupado se vería como "no
     * imprime" en vez de como lo que es. Devuelve si quedó escuchando.
     */
    fun arrancar(puerto: Int): Boolean {
        if (activo) return true
        val servidor = try {
            ServerSocket(puerto)
        } catch (e: Exception) {
            impresor.anotar(
                "${rol.etiqueta}: no se pudo abrir el puerto $puerto -- ${e.message}",
                esError = true
            )
            return false
        }
        socketServidor = servidor
        puertoActivo = servidor.localPort
        impresor.anotar("${rol.etiqueta}: escuchando en el puerto ${servidor.localPort}")

        job = scope.launch {
            try {
                while (true) {
                    val cliente = servidor.accept()
                    launch { atender(cliente) }
                }
            } catch (e: SocketException) {
                // Cierre normal: detener() cierra el socket y accept() lanza esto.
            } catch (e: Exception) {
                impresor.anotar("${rol.etiqueta}: el bucle de aceptación murió -- ${e.message}", esError = true)
            }
        }
        return true
    }

    fun detener() {
        job?.cancel()
        runCatching { socketServidor?.close() }
        socketServidor = null
        puertoActivo = -1
    }

    private suspend fun atender(cliente: Socket) {
        cliente.use { socket ->
            try {
                val entrada = DataInputStream(socket.getInputStream())
                val largo = entrada.readInt()
                if (largo <= 0 || largo > MAX_PAYLOAD) {
                    responder(socket, "ERR:Tamaño de payload inválido ($largo bytes)")
                    return
                }
                val payload = ByteArray(largo)
                entrada.readFully(payload)

                when (val r = impresor.imprimir(rol, payload)) {
                    is Resultado.Ok -> responder(socket, "OK")
                    is Resultado.Error -> responder(socket, "ERR:${r.motivo}")
                }
            } catch (e: EOFException) {
                // Conexión abierta y cerrada sin mandar nada: un escáner de puertos o un
                // chequeo de salud (`nc -z` hace exactamente esto). No es un fallo, y no
                // se anota para no llenar la bitácora de ruido.
            } catch (e: Exception) {
                impresor.anotar("${rol.etiqueta}: error atendiendo un trabajo -- ${e.message}", esError = true)
                runCatching { responder(socket, "ERR:${e.message}") }
            }
        }
    }

    private fun responder(socket: Socket, linea: String) {
        OutputStreamWriter(socket.getOutputStream()).apply {
            write("$linea\n")
            flush()
        }
    }
}
