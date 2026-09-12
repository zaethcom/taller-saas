package com.zaethcom.puente.net

import android.util.Base64
import android.util.Log
import com.zaethcom.puente.core.Puente
import com.zaethcom.puente.core.Resultado
import com.zaethcom.puente.core.Rol
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

private const val TAG = "PuenteHttp"

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
class ServidorHttp(private val puente: Puente) {

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
                puente.anotar("HTTP: escuchando en el puerto $puerto")
                while (true) {
                    val cliente = servidor.accept()
                    launch { atender(cliente) }
                }
            } catch (e: SocketException) {
                Log.i(TAG, "Servidor HTTP detenido: ${e.message}")
            } catch (e: Exception) {
                puente.anotar("HTTP: no se pudo abrir el puerto $puerto -- ${e.message}", esError = true)
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
            val salida = socket.getOutputStream()
            try {
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
                    responder(salida, 404, "No encontrado"); return
                }

                val secretoConfigurado = puente.config.value.secretoHttp
                if (secretoConfigurado.isBlank()) {
                    responder(salida, 503, "Este puente no tiene secreto configurado"); return
                }
                if (secretoRecibido != secretoConfigurado) {
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
                    Base64.decode(cuerpo.getString("payload_base64"), Base64.DEFAULT)
                } catch (e: Exception) {
                    responder(salida, 400, "payload_base64 inválido: ${e.message}"); return
                }

                when (val r = puente.imprimir(rol, payload)) {
                    is Resultado.Ok -> responder(salida, 200, "OK")
                    is Resultado.Error -> responder(salida, 500, r.motivo)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error atendiendo petición HTTP", e)
                runCatching { responder(salida, 500, e.message ?: "Error desconocido") }
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
