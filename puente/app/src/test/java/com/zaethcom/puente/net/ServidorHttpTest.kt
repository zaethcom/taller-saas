package com.zaethcom.puente.net

import com.zaethcom.puente.core.Rol
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.Socket
import java.util.Base64
import java.util.concurrent.TimeUnit

/**
 * El servidor HTTP es el que sí lleva el rol en el cuerpo, y el único que está
 * pensado para quedar expuesto fuera de la red local. Lo que más importa verificar
 * es que falle cerrado: sin secreto no debe imprimir nada, pase lo que pase.
 */
class ServidorHttpTest {

    private data class Respuesta(val estado: Int, val cuerpo: String)

    private fun postear(puerto: Int, ruta: String, cuerpo: String, secreto: String?): Respuesta {
        Socket("127.0.0.1", puerto).use { socket ->
            val bytes = cuerpo.toByteArray(Charsets.ISO_8859_1)
            val sb = StringBuilder()
                .append("POST $ruta HTTP/1.1\r\n")
                .append("Host: 127.0.0.1\r\n")
                .append("Content-Length: ${bytes.size}\r\n")
            if (secreto != null) sb.append("X-Puente-Secreto: $secreto\r\n")
            sb.append("\r\n").append(cuerpo)

            socket.getOutputStream().apply {
                write(sb.toString().toByteArray(Charsets.ISO_8859_1))
                flush()
            }

            val lector = BufferedReader(InputStreamReader(socket.getInputStream(), Charsets.ISO_8859_1))
            val estado = lector.readLine().orEmpty().split(" ").getOrNull(1)?.toIntOrNull() ?: -1
            while (true) {
                val linea = lector.readLine() ?: break
                if (linea.isEmpty()) break
            }
            return Respuesta(estado, lector.readText())
        }
    }

    private fun json(rol: String, payload: ByteArray): String =
        """{"rol":"$rol","payload_base64":"${Base64.getEncoder().encodeToString(payload)}"}"""

    @Test
    fun `sin secreto configurado no imprime nada`() {
        // Falla cerrado: un puerto de impresión abierto en la red de un local es,
        // en el mejor caso, papel que cualquiera gasta.
        val impresor = ImpresorFalso(secreto = "")
        val servidor = ServidorHttp(impresor)
        assertTrue(servidor.arrancar(0))
        try {
            val r = postear(servidor.puertoActivo, "/imprimir", json("tickets", byteArrayOf(1)), "loquesea")
            assertEquals(503, r.estado)
            assertTrue(impresor.recibidos.isEmpty())
        } finally {
            servidor.detener()
        }
    }

    @Test
    fun `un secreto equivocado no imprime nada`() {
        val impresor = ImpresorFalso(secreto = "el-bueno")
        val servidor = ServidorHttp(impresor)
        assertTrue(servidor.arrancar(0))
        try {
            val r = postear(servidor.puertoActivo, "/imprimir", json("tickets", byteArrayOf(1)), "el-malo")
            assertEquals(401, r.estado)
            assertTrue(impresor.recibidos.isEmpty())
        } finally {
            servidor.detener()
        }
    }

    @Test
    fun `sin cabecera de secreto tampoco imprime`() {
        val impresor = ImpresorFalso(secreto = "el-bueno")
        val servidor = ServidorHttp(impresor)
        assertTrue(servidor.arrancar(0))
        try {
            val r = postear(servidor.puertoActivo, "/imprimir", json("tickets", byteArrayOf(1)), null)
            assertEquals(401, r.estado)
            assertTrue(impresor.recibidos.isEmpty())
        } finally {
            servidor.detener()
        }
    }

    @Test
    fun `con el secreto correcto imprime y respeta el rol del cuerpo`() {
        val impresor = ImpresorFalso(secreto = "el-bueno")
        val servidor = ServidorHttp(impresor)
        assertTrue(servidor.arrancar(0))
        try {
            val payload = "^XA^FDhola^FS^XZ".toByteArray()
            val r = postear(servidor.puertoActivo, "/imprimir", json("etiquetas", payload), "el-bueno")

            assertEquals(200, r.estado)
            assertTrue(impresor.llegada.await(5, TimeUnit.SECONDS))
            assertEquals(Rol.ETIQUETAS, impresor.recibidos.single().rol)
            assertArrayEquals(payload, impresor.recibidos.single().datos)
        } finally {
            servidor.detener()
        }
    }

    @Test
    fun `un rol desconocido se rechaza en vez de caer en tickets`() {
        // Caer en un valor por defecto haría que un cliente mal configurado imprima
        // etiquetas en la impresora de recibos sin que nadie se entere.
        val impresor = ImpresorFalso(secreto = "el-bueno")
        val servidor = ServidorHttp(impresor)
        assertTrue(servidor.arrancar(0))
        try {
            val r = postear(servidor.puertoActivo, "/imprimir", json("impresora3", byteArrayOf(1)), "el-bueno")
            assertEquals(400, r.estado)
            assertTrue(impresor.recibidos.isEmpty())
        } finally {
            servidor.detener()
        }
    }

    @Test
    fun `otra ruta responde 404 sin tocar la impresora`() {
        val impresor = ImpresorFalso(secreto = "el-bueno")
        val servidor = ServidorHttp(impresor)
        assertTrue(servidor.arrancar(0))
        try {
            val r = postear(servidor.puertoActivo, "/otra-cosa", json("tickets", byteArrayOf(1)), "el-bueno")
            assertEquals(404, r.estado)
            assertTrue(impresor.recibidos.isEmpty())
        } finally {
            servidor.detener()
        }
    }

    @Test
    fun `un base64 corrupto se rechaza con 400 y no revienta el servidor`() {
        val impresor = ImpresorFalso(secreto = "el-bueno")
        val servidor = ServidorHttp(impresor)
        assertTrue(servidor.arrancar(0))
        try {
            val r = postear(
                servidor.puertoActivo, "/imprimir",
                """{"rol":"tickets","payload_base64":"esto no es base64 !!!"}""",
                "el-bueno"
            )
            assertTrue("esperaba 4xx, llegó ${r.estado}", r.estado in 400..499)

            // Y sigue vivo para el siguiente.
            val ok = postear(servidor.puertoActivo, "/imprimir", json("tickets", byteArrayOf(7)), "el-bueno")
            assertEquals(200, ok.estado)
        } finally {
            servidor.detener()
        }
    }
}
