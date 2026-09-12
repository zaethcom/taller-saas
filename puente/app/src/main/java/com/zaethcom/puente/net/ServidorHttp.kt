package com.zaethcom.puente.net

import com.zaethcom.puente.core.Impresor
import com.zaethcom.puente.core.Resultado
import com.zaethcom.puente.core.Rol
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.ServerSocket
import java.net.Socket
import java.net.SocketException
import java.net.SocketTimeoutException
import java.util.Base64

/**
 * La misma función que [ServidorTcp] pero por HTTP, y aquí el rol SÍ viaja en el
 * cuerpo -- en JSON no cuesta nada y evita abrir un puerto por rol hacia afuera.
 *
 * Existe para lo remoto: un túnel en modo TCP exige que quien se conecta corra
 * también el cliente del túnel, cosa imposible desde una función serverless. En
 * modo HTTP esto queda como una URL normal que cualquier fetch() puede llamar.
 *
 *   POST /imprimir
 *   X-Puente-Secreto: <el secreto configurado en la app>
 *   {"rol": "tickets", "payload_base64": "<bytes ya renderizados>"}
 *
 * Falla cerrado: sin secreto configurado rechaza todo. Un servidor de impresión
 * abierto en una red de local comercial es una impresora que cualquiera puede
 * gastar, y en el peor caso un cajón que cualquiera puede abrir.
 */
/** Ver [com.zaethcom.puente.net.ServidorTcp]: mismo motivo, y aquí importa más porque
 *  este puerto es el que puede quedar expuesto fuera de la red local. */
private const val TIMEOUT_LECTURA_MS = 20_000

class ServidorHttp(
    private val impresor: Impresor,
    /** Ver [ServidorTcp]. */
    private val timeoutLecturaMs: Int = TIMEOUT_LECTURA_MS
) {

    private val scope = CoroutineScope(Dispatchers.IO)
    private var socketServidor: ServerSocket? = null
    private var job: Job? = null

    val activo: Boolean get() = job?.isActive == true

    /** El puerto realmente enlazado, o -1. Ver [ServidorTcp.puertoActivo]. */
    var puertoActivo: Int = -1
        private set

    fun arrancar(puerto: Int): Boolean {
        if (activo) return true
        val servidor = try {
            ServerSocket(puerto)
        } catch (e: Exception) {
            impresor.anotar("HTTP: no se pudo abrir el puerto $puerto -- ${e.message}", esError = true)
            return false
        }
        socketServidor = servidor
        puertoActivo = servidor.localPort
        impresor.anotar("HTTP: escuchando en el puerto ${servidor.localPort}")

        job = scope.launch {
            try {
                while (true) {
                    val cliente = servidor.accept()
                    launch { atender(cliente) }
                }
            } catch (e: SocketException) {
                // Cierre normal desde detener().
            } catch (e: Exception) {
                impresor.anotar("HTTP: el bucle de aceptación murió -- ${e.message}", esError = true)
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
            val salida = socket.getOutputStream()
            try {
                socket.soTimeout = timeoutLecturaMs
                val lector = BufferedReader(InputStreamReader(socket.getInputStream(), Charsets.ISO_8859_1))
                val peticion = lector.readLine() ?: return
                val partes = peticion.split(" ")
                if (partes.size < 2) { responder(salida, 400, "Solicitud inválida"); return }
                val metodo = partes[0]
                val ruta = partes[1]

                var largoCuerpo = 0
                var secretoRecibido: String? = null
                while (true) {
                    val linea = lector.readLine() ?: break
                    if (linea.isEmpty()) break
                    val i = linea.indexOf(':')
                    if (i <= 0) continue
                    val nombre = linea.substring(0, i).trim().lowercase()
                    val valor = linea.substring(i + 1).trim()
                    when (nombre) {
                        "content-length" -> largoCuerpo = valor.toIntOrNull() ?: 0
                        "x-puente-secreto" -> secretoRecibido = valor
                    }
                }

                if (metodo != "POST" || ruta != "/imprimir") {
                    descartarCuerpo(lector, largoCuerpo)
                    responder(salida, 404, "No encontrado"); return
                }

                val secretoConfigurado = impresor.secretoHttp()
                if (secretoConfigurado.isBlank()) {
                    descartarCuerpo(lector, largoCuerpo)
                    responder(salida, 503, "Este puente no tiene secreto configurado"); return
                }
                if (secretoRecibido != secretoConfigurado) {
                    descartarCuerpo(lector, largoCuerpo)
                    responder(salida, 401, "Secreto inválido"); return
                }
                if (largoCuerpo <= 0 || largoCuerpo > 5_000_000) {
                    responder(salida, 400, "Content-Length inválido"); return
                }

                val buffer = CharArray(largoCuerpo)
                var leidos = 0
                while (leidos < largoCuerpo) {
                    val n = lector.read(buffer, leidos, largoCuerpo - leidos)
                    if (n < 0) break
                    leidos += n
                }

                val cuerpo = try {
                    JSONObject(String(buffer, 0, leidos))
                } catch (e: Exception) {
                    responder(salida, 400, "JSON inválido: ${e.message}"); return
                }

                val rol = Rol.desde(cuerpo.optString("rol", Rol.TICKETS.name))
                    ?: run { responder(salida, 400, "Rol desconocido: ${cuerpo.optString("rol")}"); return }

                val payload = try {
                    Base64.getDecoder().decode(cuerpo.getString("payload_base64"))
                } catch (e: Exception) {
                    responder(salida, 400, "payload_base64 inválido: ${e.message}"); return
                }

                when (val r = impresor.imprimir(rol, payload)) {
                    is Resultado.Ok -> responder(salida, 200, "OK")
                    is Resultado.Error -> responder(salida, 500, r.motivo)
                }
            } catch (e: SocketTimeoutException) {
                // Conexión abierta sin completar la petición. Se suelta el hilo.
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                impresor.anotar("HTTP: error atendiendo una petición -- ${e.message}", esError = true)
                runCatching { responder(salida, 500, e.message ?: "Error desconocido") }
            }
        }
    }

    /**
     * Descarta el cuerpo pendiente antes de responder un error. Cerrar el socket con
     * datos sin leer hace que el sistema mande RST, y entonces el cliente ve
     * "connection reset" en vez de "Secreto inválido" -- que es la diferencia entre
     * diagnosticarlo en un minuto o en una tarde.
     */
    private fun descartarCuerpo(lector: BufferedReader, largo: Int) {
        if (largo <= 0 || largo > 5_000_000) return
        runCatching {
            val basura = CharArray(8 * 1024)
            var restantes = largo
            while (restantes > 0) {
                val n = lector.read(basura, 0, minOf(basura.size, restantes))
                if (n < 0) break
                restantes -= n
            }
        }
    }

    private fun responder(salida: OutputStream, estado: Int, mensaje: String) {
        val texto = when (estado) {
            200 -> "OK"; 400 -> "Bad Request"; 401 -> "Unauthorized"
            404 -> "Not Found"; 503 -> "Service Unavailable"; else -> "Internal Server Error"
        }
        val cuerpo = mensaje.toByteArray(Charsets.UTF_8)
        val cabecera = "HTTP/1.1 $estado $texto\r\n" +
            "Content-Type: text/plain; charset=utf-8\r\n" +
            "Content-Length: ${cuerpo.size}\r\n" +
            "Connection: close\r\n\r\n"
        salida.write(cabecera.toByteArray(Charsets.ISO_8859_1))
        salida.write(cuerpo)
        salida.flush()
    }
}
