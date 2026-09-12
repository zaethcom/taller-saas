package com.zaethcom.puente.net

import android.util.Log
import com.zaethcom.puente.core.Puente
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

private const val TAG = "PuenteTcp"
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
    private val puente: Puente
) {
    private val scope = CoroutineScope(Dispatchers.IO)
    private var socketServidor: ServerSocket? = null
    private var job: Job? = null

    val activo: Boolean get() = job?.isActive == true

    fun arrancar(puerto: Int) {
        if (activo) return
        job = scope.launch {
            try {
                val servidor = ServerSocket(puerto)
                socketServidor = servidor
                puente.anotar("${rol.etiqueta}: escuchando en el puerto $puerto")
                while (true) {
                    val cliente = servidor.accept()
                    launch { atender(cliente) }
                }
            } catch (e: SocketException) {
                Log.i(TAG, "Servidor de ${rol.name} detenido: ${e.message}")
            } catch (e: Exception) {
                puente.anotar(
                    "${rol.etiqueta}: no se pudo abrir el puerto $puerto -- ${e.message}",
                    esError = true
                )
            }
        }
    }

    fun detener() {
        job?.cancel()
        runCatching { socketServidor?.close() }
        socketServidor = null
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

                when (val r = puente.imprimir(rol, payload)) {
                    is Resultado.Ok -> responder(socket, "OK")
                    is Resultado.Error -> responder(socket, "ERR:${r.motivo}")
                }
            } catch (e: EOFException) {
                // Conexión abierta y cerrada sin mandar nada: un escáner de puertos o un
                // chequeo de salud (`nc -z` hace exactamente esto). No es un fallo.
                Log.d(TAG, "Cliente cortó antes del payload (${socket.inetAddress?.hostAddress})")
            } catch (e: Exception) {
                puente.anotar("${rol.etiqueta}: error atendiendo un trabajo -- ${e.message}", esError = true)
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
