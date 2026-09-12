package com.zaethcom.puente.net

import com.zaethcom.puente.core.Impresor
import com.zaethcom.puente.core.Resultado
import com.zaethcom.puente.core.Rol
import kotlinx.coroutines.CancellationException
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
import java.net.SocketTimeoutException

private const val MAX_PAYLOAD = 20_000_000

/**
 * Un cliente que abre la conexión y no manda nada tiene este tiempo antes de que se
 * le corte. Sin esto, cada conexión colgada se queda con un hilo de Dispatchers.IO
 * para siempre: unas sesenta y el pool se agota, y entonces deja de imprimir TODO
 * sin un solo error en pantalla.
 */
private const val TIMEOUT_LECTURA_MS = 20_000

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
    private val impresor: Impresor,
    /** Inyectable solo para que las pruebas no tengan que esperar 20 s de verdad. */
    private val timeoutLecturaMs: Int = TIMEOUT_LECTURA_MS
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
                socket.soTimeout = timeoutLecturaMs
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
            } catch (e: SocketTimeoutException) {
                // Se conectó y no mandó el trabajo a tiempo. Se suelta el hilo y ya.
            } catch (e: CancellationException) {
                // Reinicio de servidores: no es un fallo de impresión y no debe anotarse
                // como tal ni contestarle ERR a un socket que se está cerrando.
                throw e
            } catch (e: Exception) {
                impresor.anotar("${rol.etiqueta}: error atendiendo un trabajo -- ${e.message}", esError = true)
                runCatching { responder(socket, "ERR:${e.message}") }
            }
        }
    }

    /** UTF-8 explícito: `destino.ts` decodifica la respuesta como UTF-8, y el juego
     *  de caracteres por defecto de la JVM no tiene por qué serlo. Los motivos de
     *  error llevan tildes. */
    private fun responder(socket: Socket, linea: String) {
        OutputStreamWriter(socket.getOutputStream(), Charsets.UTF_8).apply {
            write("$linea\n")
            flush()
        }
    }
}
