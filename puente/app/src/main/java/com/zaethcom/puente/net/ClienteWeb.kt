package com.zaethcom.puente.net

import android.content.Context
import com.zaethcom.puente.core.Impresor
import com.zaethcom.puente.core.Resultado
import com.zaethcom.puente.core.Rol
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.Base64

/**
 * El puente habla directo con la web, sin PC ni estación de Node en medio.
 *
 * Hasta aquí una sede necesitaba un computador corriendo `estacion/` que pidiera la
 * cola y le mandara los bytes a este puente por TCP. Montar eso en cada empresa
 * nueva (instalar Node, copiar un config.json, dejar una terminal abierta) fue
 * justamente lo que no funcionó en el primer local. Ahora:
 *
 *  1. En la web, Sedes → Estación de impresión → «Código para la app Android».
 *  2. Ese código (8 letras, vence en 15 min) se escribe aquí: [vincular] lo canjea
 *     en `POST /api/estacion/vincular` por la clave de estación de esa sede.
 *  3. Cada 2 s se pide `GET /api/impresion/pendientes?formato=bytes`: cada trabajo
 *     llega ya traducido (ESC/POS, PPLB o ZPL según la sede) con su destino, se le
 *     entrega a [Impresor.imprimir] del rol correspondiente y se reporta el
 *     resultado. Este lado no interpreta nada, igual que los servidores TCP.
 *
 * Contrato completo en `estacion/puente-android.md`. Los servidores TCP siguen
 * abiertos: una estación de PC que ya funcionaba no se entera de esto.
 */
const val API_POR_DEFECTO = "https://taller-saas-mvp.vercel.app"

private const val INTERVALO_MS = 2_000L
/** Sin red o con la web caída no tiene sentido martillar cada 2 s. */
private const val INTERVALO_FALLO_MS = 10_000L

data class Vinculo(
    val apiBase: String,
    val sedeId: String,
    val clave: String,
    val sedeNombre: String
)

data class TrabajoWeb(
    val id: String,
    val tipo: String,
    val rol: Rol?,
    val datos: ByteArray?,
    /** Si la web no pudo preparar los bytes: se reporta tal cual. */
    val error: String?
)

data class EstadoWeb(
    val vinculo: Vinculo? = null,
    val conectado: Boolean = false,
    val mensaje: String = "",
    val esError: Boolean = false
)

data class RespuestaHttp(val codigo: Int, val cuerpo: String)

/** Lo único que [ClienteWeb] necesita de la red: así se prueba en la JVM. */
fun interface Http {
    fun pedir(metodo: String, url: String, clave: String?, cuerpo: String?): RespuestaHttp
}

interface AlmacenVinculo {
    fun cargar(): Vinculo?
    fun guardar(vinculo: Vinculo?)
}

/** Deja solo letras y números, en mayúscula: "abcd-efgh" y "ABCD EFGH" son el mismo código. */
fun normalizarCodigo(texto: String): String? {
    val limpio = texto.uppercase().filter { it in 'A'..'Z' || it in '0'..'9' }
    return limpio.takeIf { it.length == 8 }
}

/** Lee la respuesta de `pendientes?formato=bytes`. Pura, para poder probarla. */
fun leerTrabajos(json: String): List<TrabajoWeb> {
    val arreglo = JSONArray(json)
    return (0 until arreglo.length()).map { i ->
        val o = arreglo.getJSONObject(i)
        val rol = when (o.optString("destino")) {
            "tickets" -> Rol.TICKETS
            "etiquetas" -> Rol.ETIQUETAS
            else -> null
        }
        val datos = o.optString("bytes").takeIf { it.isNotEmpty() }?.let { Base64.getDecoder().decode(it) }
        TrabajoWeb(
            id = o.getString("id"),
            tipo = o.optString("tipo"),
            rol = rol,
            datos = datos,
            error = if (o.has("error") && !o.isNull("error")) o.getString("error") else null
        )
    }
}

private fun mensajeDe(r: RespuestaHttp): String =
    runCatching { JSONObject(r.cuerpo).optString("error") }.getOrNull()?.takeIf { it.isNotBlank() }
        ?: "la web respondió ${r.codigo}"

class ClienteWeb(
    private val impresor: Impresor,
    private val almacen: AlmacenVinculo,
    private val http: Http = HttpUrlConnection
) {
    private val _estado = MutableStateFlow(EstadoWeb(vinculo = almacen.cargar()))
    val estado: StateFlow<EstadoWeb> = _estado

    private val scope = CoroutineScope(Dispatchers.IO)
    private var job: Job? = null

    fun arrancar() {
        if (job?.isActive == true || _estado.value.vinculo == null) return
        job = scope.launch {
            while (isActive) {
                val ok = try {
                    cicloUnaVez()
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    marcar(false, "Sin conexión con la web: ${e.message ?: e.javaClass.simpleName}", esError = true)
                    false
                }
                delay(if (ok) INTERVALO_MS else INTERVALO_FALLO_MS)
            }
        }
    }

    fun detener() {
        job?.cancel()
        job = null
    }

    /**
     * Canjea el código de la web por la clave de la sede. Devuelve null si salió
     * bien, o el motivo en palabras para mostrarlo en pantalla.
     */
    suspend fun vincular(codigoEscrito: String, nombreEquipo: String, apiBase: String = API_POR_DEFECTO): String? {
        val codigo = normalizarCodigo(codigoEscrito) ?: return "El código tiene 8 letras o números, como ABCD-EFGH"
        val cuerpo = JSONObject().put("codigo", codigo).put("nombre", nombreEquipo).toString()
        val r = try {
            withContext(Dispatchers.IO) { http.pedir("POST", "$apiBase/api/estacion/vincular", null, cuerpo) }
        } catch (e: Exception) {
            return "No se pudo llegar a la web: ${e.message ?: e.javaClass.simpleName}"
        }
        if (r.codigo != 200) return mensajeDe(r)

        val o = JSONObject(r.cuerpo)
        val vinculo = Vinculo(
            apiBase = apiBase,
            sedeId = o.getString("sedeId"),
            clave = o.getString("clave"),
            sedeNombre = o.optString("sedeNombre").ifBlank { "esta sede" }
        )
        almacen.guardar(vinculo)
        _estado.value = EstadoWeb(vinculo = vinculo, mensaje = "Vinculado a ${vinculo.sedeNombre}")
        impresor.anotar("Web: vinculado a ${vinculo.sedeNombre}")
        detener()
        arrancar()
        return null
    }

    fun desvincular() {
        detener()
        almacen.guardar(null)
        _estado.value = EstadoWeb()
        impresor.anotar("Web: desvinculado")
    }

    /** Una vuelta: pedir la cola, imprimir, reportar. true si la web respondió bien. */
    suspend fun cicloUnaVez(): Boolean {
        val v = _estado.value.vinculo ?: return false
        val r = http.pedir("GET", "${v.apiBase}/api/impresion/pendientes?sede=${v.sedeId}&formato=bytes", v.clave, null)
        if (r.codigo == 401) {
            marcar(false, "La web ya no acepta esta clave (se generó otra). Vincula de nuevo con un código.", esError = true)
            return false
        }
        if (r.codigo != 200) {
            marcar(false, mensajeDe(r), esError = true)
            return false
        }

        marcar(true, "En línea con ${v.sedeNombre}")
        for (t in leerTrabajos(r.cuerpo)) {
            val resultado: Resultado = when {
                t.error != null -> Resultado.Error(t.error)
                t.rol == null || t.datos == null -> Resultado.Error("trabajo sin destino o sin datos")
                else -> impresor.imprimir(t.rol, t.datos)
            }
            val cuerpo = when (resultado) {
                is Resultado.Ok -> JSONObject().put("ok", true)
                is Resultado.Error -> JSONObject().put("ok", false).put("error", resultado.motivo)
            }.toString()
            http.pedir("POST", "${v.apiBase}/api/impresion/${t.id}/resultado", v.clave, cuerpo)
            if (resultado is Resultado.Error) impresor.anotar("Web: ${t.tipo} falló: ${resultado.motivo}", esError = true)
        }
        return true
    }

    private fun marcar(conectado: Boolean, mensaje: String, esError: Boolean = false) {
        val antes = _estado.value
        // Solo se anota en la bitácora cuando cambia, no cada 2 s.
        if (antes.mensaje != mensaje) impresor.anotar("Web: $mensaje", esError)
        _estado.value = antes.copy(conectado = conectado, mensaje = mensaje, esError = esError)
    }
}

/** El [Http] real. HttpURLConnection alcanza: son tres llamadas JSON pequeñas. */
object HttpUrlConnection : Http {
    override fun pedir(metodo: String, url: String, clave: String?, cuerpo: String?): RespuestaHttp {
        val c = URL(url).openConnection() as HttpURLConnection
        try {
            c.requestMethod = metodo
            c.connectTimeout = 10_000
            c.readTimeout = 20_000
            c.setRequestProperty("Accept", "application/json")
            clave?.let { c.setRequestProperty("Authorization", "Bearer $it") }
            if (cuerpo != null) {
                c.doOutput = true
                c.setRequestProperty("Content-Type", "application/json")
                c.outputStream.use { it.write(cuerpo.toByteArray(Charsets.UTF_8)) }
            }
            val codigo = c.responseCode
            val flujo = if (codigo in 200..299) c.inputStream else c.errorStream
            val texto = flujo?.bufferedReader(Charsets.UTF_8)?.use { it.readText() } ?: ""
            return RespuestaHttp(codigo, texto)
        } finally {
            c.disconnect()
        }
    }
}

/** El vínculo se guarda aparte de la config de impresoras: son cosas distintas. */
class AlmacenVinculoPrefs(context: Context) : AlmacenVinculo {
    private val prefs = context.getSharedPreferences("puente_web", Context.MODE_PRIVATE)

    override fun cargar(): Vinculo? {
        val clave = prefs.getString("clave", null) ?: return null
        val sedeId = prefs.getString("sedeId", null) ?: return null
        return Vinculo(
            apiBase = prefs.getString("apiBase", null) ?: API_POR_DEFECTO,
            sedeId = sedeId,
            clave = clave,
            sedeNombre = prefs.getString("sedeNombre", null) ?: "esta sede"
        )
    }

    override fun guardar(vinculo: Vinculo?) {
        val e = prefs.edit()
        if (vinculo == null) {
            e.clear()
        } else {
            e.putString("apiBase", vinculo.apiBase)
                .putString("sedeId", vinculo.sedeId)
                .putString("clave", vinculo.clave)
                .putString("sedeNombre", vinculo.sedeNombre)
        }
        e.apply()
    }
}
