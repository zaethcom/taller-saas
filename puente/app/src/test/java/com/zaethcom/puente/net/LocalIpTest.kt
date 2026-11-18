package com.zaethcom.puente.net

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.net.InetAddress

/**
 * La IP que muestra la pantalla es la que se copia al config.json de una estación de
 * PC. Si se elige la de datos móviles o la de una VPN, la estación no encuentra al
 * puente y nadie entiende por qué.
 */
class LocalIpTest {

    private fun ip(texto: String): InetAddress = InetAddress.getByName(texto)

    @Test
    fun `prefiere el cable sobre la wifi`() {
        val elegida = elegirDeInterfaces(
            listOf(
                InterfazRed("wlan0", listOf(ip("192.168.1.40"))),
                InterfazRed("eth0", listOf(ip("192.168.1.20")))
            )
        )
        assertEquals("192.168.1.20", elegida)
    }

    @Test
    fun `ignora datos moviles y vpn`() {
        val elegida = elegirDeInterfaces(
            listOf(
                InterfazRed("rmnet_data0", listOf(ip("10.120.3.4"))),
                InterfazRed("tun0", listOf(ip("10.8.0.2"))),
                InterfazRed("wlan0", listOf(ip("192.168.0.15")))
            )
        )
        assertEquals("192.168.0.15", elegida)
    }

    @Test
    fun `ignora ipv6, link-local y loopback`() {
        val elegida = elegirDeInterfaces(
            listOf(
                InterfazRed("lo", listOf(ip("127.0.0.1"))),
                InterfazRed("eth0", listOf(ip("fe80::1"), ip("169.254.10.10"), ip("192.168.1.20")))
            )
        )
        assertEquals("192.168.1.20", elegida)
    }

    @Test
    fun `sin red local devuelve null`() {
        assertNull(elegirDeInterfaces(listOf(InterfazRed("rmnet0", listOf(ip("10.1.2.3"))))))
        assertNull(elegirDeInterfaces(emptyList()))
    }
}
