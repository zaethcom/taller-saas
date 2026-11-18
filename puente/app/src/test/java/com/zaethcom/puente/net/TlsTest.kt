package com.zaethcom.puente.net

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import java.util.Base64

/** Confianza de mentira: acepta o rechaza todo, y cuenta cuántas veces la consultaron. */
private class ConfianzaFalsa(private val acepta: Boolean) : javax.net.ssl.X509TrustManager {
    var consultas = 0
    override fun checkServerTrusted(cadena: Array<X509Certificate>, tipo: String) {
        consultas++
        if (!acepta) throw CertificateException("no")
    }
    override fun checkClientTrusted(cadena: Array<X509Certificate>, tipo: String) {}
    override fun getAcceptedIssuers(): Array<X509Certificate> = emptyArray()
}

private fun raiz(nombre: String) = File("src/main/res/raw/$nombre").inputStream()

class TlsTest {

    @Test
    fun `las raíces empaquetadas son ISRG Root X1 y X2`() {
        val certs = leerCertificados(listOf(raiz("isrg_root_x1.pem"), raiz("isrg_root_x2.pem")))
        assertEquals(listOf("ISRG Root X1", "ISRG Root X2"), certs.map {
            it.subjectX500Principal.name.substringAfter("CN=").substringBefore(",")
        })
    }

    @Test
    fun `se arma la fábrica con las raíces empaquetadas`() {
        assertNotNull(fabricaTls(listOf(raiz("isrg_root_x1.pem"), raiz("isrg_root_x2.pem"))))
    }

    @Test
    fun `si el sistema confía no se consulta a las raíces extra`() {
        val extra = ConfianzaFalsa(acepta = false)
        ConfianzaCombinada(ConfianzaFalsa(acepta = true), extra).checkServerTrusted(emptyArray(), "RSA")
        assertEquals(0, extra.consultas)
    }

    @Test
    fun `si el sistema no confía deciden las raíces extra`() {
        val extra = ConfianzaFalsa(acepta = true)
        ConfianzaCombinada(ConfianzaFalsa(acepta = false), extra).checkServerTrusted(emptyArray(), "RSA")
        assertEquals(1, extra.consultas)
    }

    @Test(expected = CertificateException::class)
    fun `si ninguna confía se rechaza`() {
        ConfianzaCombinada(ConfianzaFalsa(acepta = false), ConfianzaFalsa(acepta = false))
            .checkServerTrusted(emptyArray(), "RSA")
    }

    @Test
    fun `decodifica Base64 igual que java util Base64`() {
        val bytes = ByteArray(256) { it.toByte() }
        for (largo in listOf(0, 1, 2, 3, 255, 256)) {
            val parte = bytes.copyOf(largo)
            assertArrayEquals(parte, decodificarBase64(Base64.getEncoder().encodeToString(parte)))
        }
        assertTrue(decodificarBase64("").isEmpty())
    }
}
