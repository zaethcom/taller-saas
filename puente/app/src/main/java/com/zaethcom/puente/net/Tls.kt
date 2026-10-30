package com.zaethcom.puente.net

import java.io.InputStream
import java.net.InetAddress
import java.net.Socket
import java.security.KeyStore
import java.security.cert.CertificateException
import java.security.cert.CertificateFactory
import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.SSLSocketFactory
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

/**
 * HTTPS que funciona también en Android 5.
 *
 * El terminal IDEMIA de la sede (MorphoTablet2) trae Android 5.0.2, y ese almacén
 * de certificados no conoce ISRG Root X1/X2 -- Android las incorporó en 7.1.1. Todo
 * lo firmado por Let's Encrypt (www.taller360.app, por ejemplo) falla ahí con
 * SSLHandshakeException aunque el certificado esté perfecto.
 *
 * Por eso las dos raíces van dentro del APK (res/raw) y se confía en las del
 * sistema MÁS esas. La verificación no se relaja: un certificado que ninguna de las
 * dos fuentes respalda se rechaza igual que antes, y el nombre del host lo sigue
 * comprobando HttpsURLConnection.
 */
fun fabricaTls(raicesExtra: List<InputStream>): SSLSocketFactory {
    val contexto = SSLContext.getInstance("TLS")
    contexto.init(null, arrayOf(ConfianzaCombinada(confianzaDelSistema(), confianzaEn(raicesExtra))), null)
    return ConTls12(contexto.socketFactory)
}

/** Lee certificados PEM o DER. Cada flujo se cierra al terminar. */
fun leerCertificados(flujos: List<InputStream>): List<X509Certificate> {
    val fabrica = CertificateFactory.getInstance("X.509")
    return flujos.flatMap { flujo -> flujo.use { fabrica.generateCertificates(it).map { c -> c as X509Certificate } } }
}

private fun confianzaDelSistema(): X509TrustManager {
    val tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
    tmf.init(null as KeyStore?)
    return tmf.trustManagers.filterIsInstance<X509TrustManager>().first()
}

private fun confianzaEn(raices: List<InputStream>): X509TrustManager {
    val almacen = KeyStore.getInstance(KeyStore.getDefaultType()).apply { load(null, null) }
    leerCertificados(raices).forEachIndexed { i, c -> almacen.setCertificateEntry("raiz$i", c) }
    val tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
    tmf.init(almacen)
    return tmf.trustManagers.filterIsInstance<X509TrustManager>().first()
}

/** Acepta la cadena si la respalda el sistema o, si no, las raíces empaquetadas. */
internal class ConfianzaCombinada(
    private val sistema: X509TrustManager,
    private val extra: X509TrustManager
) : X509TrustManager {

    override fun checkServerTrusted(cadena: Array<X509Certificate>, tipo: String) {
        try {
            sistema.checkServerTrusted(cadena, tipo)
        } catch (e: CertificateException) {
            extra.checkServerTrusted(cadena, tipo)
        }
    }

    override fun checkClientTrusted(cadena: Array<X509Certificate>, tipo: String) =
        sistema.checkClientTrusted(cadena, tipo)

    override fun getAcceptedIssuers(): Array<X509Certificate> =
        sistema.acceptedIssuers + extra.acceptedIssuers
}

/**
 * Asegura TLS 1.2 en cada socket. Android 5 ya lo trae activo para clientes, pero
 * algunas ROM de fabricante lo dejan apagado, y Vercel no acepta nada más viejo.
 */
private class ConTls12(private val base: SSLSocketFactory) : SSLSocketFactory() {

    private fun ajustar(s: Socket): Socket {
        if (s is SSLSocket && "TLSv1.2" in s.supportedProtocols && "TLSv1.2" !in s.enabledProtocols) {
            s.enabledProtocols = s.enabledProtocols + "TLSv1.2"
        }
        return s
    }

    override fun getDefaultCipherSuites(): Array<String> = base.defaultCipherSuites
    override fun getSupportedCipherSuites(): Array<String> = base.supportedCipherSuites
    override fun createSocket(s: Socket, host: String, port: Int, autoClose: Boolean): Socket =
        ajustar(base.createSocket(s, host, port, autoClose))
    override fun createSocket(host: String, port: Int): Socket = ajustar(base.createSocket(host, port))
    override fun createSocket(host: String, port: Int, local: InetAddress, localPort: Int): Socket =
        ajustar(base.createSocket(host, port, local, localPort))
    override fun createSocket(host: InetAddress, port: Int): Socket = ajustar(base.createSocket(host, port))
    override fun createSocket(address: InetAddress, port: Int, local: InetAddress, localPort: Int): Socket =
        ajustar(base.createSocket(address, port, local, localPort))
}
