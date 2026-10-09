package com.zaethcom.puente.net

import com.zaethcom.puente.core.Resultado
import com.zaethcom.puente.core.Rol
import kotlinx.coroutines.test.runTest
import org.json.JSONObject
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Base64

/** La web de mentira: responde lo que se le diga y guarda lo que le pidieron. */
private class WebFalsa(var respuestas: MutableMap<String, RespuestaHttp> = mutableMapOf()) : Http {
    data class Peticion(val metodo: String, val url: String, val clave: String?, val cuerpo: String?)
    val peticiones: MutableList<Peticion> = java.util.Collections.synchronizedList(mutableListOf())

    override fun pedir(metodo: String, url: String, clave: String?, cuerpo: String?): RespuestaHttp {
        peticiones.add(Peticion(metodo, url, clave, cuerpo))
        return respuestas.entries.firstOrNull { url.contains(it.key) }?.value ?: RespuestaHttp(200, "{}")
    }
}

private class AlmacenEnMemoria(var vinculo: Vinculo? = null) : AlmacenVinculo {
    override fun cargar() = vinculo
    override fun guardar(vinculo: Vinculo?) { this.vinculo = vinculo }
}

private val VINCULO = Vinculo("https://web", "sede-1", "clave-1", "Local 1")

class ClienteWebTest {

    @Test
    fun `normaliza el código sin importar guiones, espacios ni minúsculas`() {
        assertEquals("ABCDEFGH", normalizarCodigo("abcd-efgh"))
        assertEquals("ABCDEFGH", normalizarCodigo(" ABCD EFGH "))
        assertNull(normalizarCodigo("ABC"))
    }

    @Test
    fun `lee destino, bytes y errores de la cola`() {
        val b64 = Base64.getEncoder().encodeToString(byteArrayOf(1, 2, 3))
        val t = leerTrabajos(
            """[{"id":"a","tipo":"recibo_venta","destino":"tickets","bytes":"$b64"},
               {"id":"b","tipo":"etiqueta_qr","destino":"etiquetas","bytes":"$b64"},
               {"id":"c","tipo":"etiqueta_qr","error":"sin imagen"}]"""
        )
        assertEquals(Rol.TICKETS, t[0].rol)
        assertArrayEquals(byteArrayOf(1, 2, 3), t[0].datos)
        assertEquals(Rol.ETIQUETAS, t[1].rol)
        assertEquals("sin imagen", t[2].error)
    }

    @Test
    fun `vincular canjea el código y guarda la clave`() = runTest {
        val web = WebFalsa(mutableMapOf("/vincular" to RespuestaHttp(200, """{"clave":"k","sedeId":"s","sedeNombre":"Local 1"}""")))
        val almacen = AlmacenEnMemoria()
        val cliente = ClienteWeb(ImpresorFalso(), almacen, web)

        assertNull(cliente.vincular("abcd-efgh", "Tablet", "https://web"))
        cliente.detener()

        assertEquals(Vinculo("https://web", "s", "k", "Local 1"), almacen.vinculo)
        val p = web.peticiones.first()
        assertEquals("https://web/api/estacion/vincular", p.url)
        assertEquals("ABCDEFGH", JSONObject(p.cuerpo!!).getString("codigo"))
    }

    @Test
    fun `un código vencido muestra el mensaje de la web y no guarda nada`() = runTest {
        val web = WebFalsa(mutableMapOf("/vincular" to RespuestaHttp(400, """{"error":"código vencido"}""")))
        val almacen = AlmacenEnMemoria()
        val motivo = ClienteWeb(ImpresorFalso(), almacen, web).vincular("ABCDEFGH", "x", "https://web")
        assertEquals("código vencido", motivo)
        assertNull(almacen.vinculo)
    }

    @Test
    fun `imprime cada trabajo en su impresora y reporta el resultado`() = runTest {
        val b64 = Base64.getEncoder().encodeToString(byteArrayOf(9))
        val web = WebFalsa(mutableMapOf(
            "/pendientes" to RespuestaHttp(200, """[{"id":"t1","tipo":"etiqueta_qr","destino":"etiquetas","bytes":"$b64"}]""")
        ))
        val impresor = ImpresorFalso()
        val cliente = ClienteWeb(impresor, AlmacenEnMemoria(VINCULO), web)

        assertTrue(cliente.cicloUnaVez())

        assertEquals(Rol.ETIQUETAS, impresor.recibidos.single().rol)
        assertArrayEquals(byteArrayOf(9), impresor.recibidos.single().datos)
        val pedido = web.peticiones[0]
        assertEquals("https://web/api/impresion/pendientes?sede=sede-1&formato=bytes", pedido.url)
        assertEquals("clave-1", pedido.clave)
        val reporte = web.peticiones[1]
        assertEquals("https://web/api/impresion/t1/resultado", reporte.url)
        assertTrue(JSONObject(reporte.cuerpo!!).getBoolean("ok"))
        assertTrue(cliente.estado.value.conectado)
    }

    @Test
    fun `si la impresora falla, la web recibe el motivo`() = runTest {
        val b64 = Base64.getEncoder().encodeToString(byteArrayOf(9))
        val web = WebFalsa(mutableMapOf(
            "/pendientes" to RespuestaHttp(200, """[{"id":"t1","tipo":"recibo_venta","destino":"tickets","bytes":"$b64"}]""")
        ))
        val cliente = ClienteWeb(ImpresorFalso(Resultado.Error("sin papel")), AlmacenEnMemoria(VINCULO), web)

        cliente.cicloUnaVez()

        val reporte = JSONObject(web.peticiones[1].cuerpo!!)
        assertFalse(reporte.getBoolean("ok"))
        assertEquals("sin papel", reporte.getString("error"))
    }

    @Test
    fun `una clave revocada se muestra como error, sin imprimir`() = runTest {
        val web = WebFalsa(mutableMapOf("/pendientes" to RespuestaHttp(401, """{"error":"credencial"}""")))
        val impresor = ImpresorFalso()
        val cliente = ClienteWeb(impresor, AlmacenEnMemoria(VINCULO), web)

        assertFalse(cliente.cicloUnaVez())
        assertTrue(impresor.recibidos.isEmpty())
        assertTrue(cliente.estado.value.esError)
    }
}
