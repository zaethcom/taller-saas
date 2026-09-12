package com.zaethcom.puente.net

import com.zaethcom.puente.core.Resultado
import com.zaethcom.puente.core.Rol
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.BufferedReader
import java.io.DataOutputStream
import java.io.InputStreamReader
import java.net.Socket
import java.util.concurrent.TimeUnit

/**
 * El protocolo TCP tiene un cliente en producción que no se puede cambiar sin
 * desplegar en dos equipos a la vez: `DestinoPuenteAndroid`, en
 * `estacion/destino.ts`. Escribe cuatro bytes de longitud en big-endian, luego el
 * payload, y lee una línea `OK` o `ERR:<motivo>`.
 *
 * Estas pruebas hablan ese protocolo con un socket real contra el servidor real. Es
 * lo único de este proyecto que se puede verificar sin hardware, así que se verifica
 * a fondo.
 */
class ServidorTcpTest {

    /** Habla exactamente como destino.ts: 4 bytes big-endian + payload, lee una línea. */
    private fun enviar(puerto: Int, payload: ByteArray, largoDeclarado: Int? = null): String {
        Socket("127.0.0.1", puerto).use { socket ->
            val salida = DataOutputStream(socket.getOutputStream())
            salida.writeInt(largoDeclarado ?: payload.size)
            salida.write(payload)
            salida.flush()
            return BufferedReader(InputStreamReader(socket.getInputStream()))
                .readLine()
                .orEmpty()
        }
    }

    @Test
    fun `un trabajo correcto se entrega intacto y responde OK`() {
        val impresor = ImpresorFalso()
        val servidor = ServidorTcp(Rol.TICKETS, impresor)
        assertTrue(servidor.arrancar(0))
        try {
            val payload = byteArrayOf(0x1B, 0x40, 0x48, 0x6F, 0x6C, 0x61)
            val respuesta = enviar(servidor.puertoActivo, payload)

            assertEquals("OK", respuesta)
            assertTrue(impresor.llegada.await(5, TimeUnit.SECONDS))
            assertEquals(1, impresor.recibidos.size)
            assertEquals(Rol.TICKETS, impresor.recibidos[0].rol)
            // Byte a byte: el puente no debe tocar el payload.
            assertArrayEquals(payload, impresor.recibidos[0].datos)
        } finally {
            servidor.detener()
        }
    }

    @Test
    fun `un fallo de impresion viaja como ERR con el motivo`() {
        val impresor = ImpresorFalso(Resultado.Error("La impresora no está conectada"))
        val servidor = ServidorTcp(Rol.TICKETS, impresor)
        assertTrue(servidor.arrancar(0))
        try {
            val respuesta = enviar(servidor.puertoActivo, byteArrayOf(1, 2, 3))
            // destino.ts hace linea.slice("ERR:".length) para sacar el motivo.
            assertEquals("ERR:La impresora no está conectada", respuesta)
        } finally {
            servidor.detener()
        }
    }

    @Test
    fun `un payload gigante se rechaza sin intentar reservarlo`() {
        val impresor = ImpresorFalso()
        val servidor = ServidorTcp(Rol.TICKETS, impresor)
        assertTrue(servidor.arrancar(0))
        try {
            // Declara 500 MB sin mandarlos: si el servidor confiara en la cabecera
            // intentaría reservar ese ByteArray y se quedaría sin memoria.
            val respuesta = enviar(servidor.puertoActivo, ByteArray(0), largoDeclarado = 500_000_000)
            assertTrue("debía rechazarlo: $respuesta", respuesta.startsWith("ERR:"))
            assertTrue(impresor.recibidos.isEmpty())
        } finally {
            servidor.detener()
        }
    }

    @Test
    fun `una longitud de cero se rechaza`() {
        val impresor = ImpresorFalso()
        val servidor = ServidorTcp(Rol.TICKETS, impresor)
        assertTrue(servidor.arrancar(0))
        try {
            val respuesta = enviar(servidor.puertoActivo, ByteArray(0), largoDeclarado = 0)
            assertTrue(respuesta.startsWith("ERR:"))
        } finally {
            servidor.detener()
        }
    }

    @Test
    fun `un chequeo de puerto no tumba el servidor`() {
        val impresor = ImpresorFalso()
        val servidor = ServidorTcp(Rol.TICKETS, impresor)
        assertTrue(servidor.arrancar(0))
        try {
            // Esto es exactamente lo que hace `nc -z`, y lo que va a pasar cada vez
            // que alguien compruebe si el puerto está vivo.
            Socket("127.0.0.1", servidor.puertoActivo).close()

            // El servidor tiene que seguir atendiendo después.
            val respuesta = enviar(servidor.puertoActivo, byteArrayOf(9, 9))
            assertEquals("OK", respuesta)
        } finally {
            servidor.detener()
        }
    }

    @Test
    fun `un payload grande llega completo`() {
        val impresor = ImpresorFalso()
        val servidor = ServidorTcp(Rol.ETIQUETAS, impresor)
        assertTrue(servidor.arrancar(0))
        try {
            // Una etiqueta con logo pasa de 100 KB y no cabe en un solo paquete TCP:
            // esto verifica que el servidor use readFully y no un read suelto.
            val grande = ByteArray(300_000) { (it % 251).toByte() }
            assertEquals("OK", enviar(servidor.puertoActivo, grande))
            assertTrue(impresor.llegada.await(10, TimeUnit.SECONDS))
            assertArrayEquals(grande, impresor.recibidos[0].datos)
        } finally {
            servidor.detener()
        }
    }

    @Test
    fun `cada rol escucha en su propio puerto y no se cruzan`() {
        val tickets = ImpresorFalso()
        val etiquetas = ImpresorFalso()
        val sTickets = ServidorTcp(Rol.TICKETS, tickets)
        val sEtiquetas = ServidorTcp(Rol.ETIQUETAS, etiquetas)
        assertTrue(sTickets.arrancar(0))
        assertTrue(sEtiquetas.arrancar(0))
        try {
            enviar(sTickets.puertoActivo, byteArrayOf(1))
            enviar(sEtiquetas.puertoActivo, byteArrayOf(2))

            assertTrue(tickets.llegada.await(5, TimeUnit.SECONDS))
            assertTrue(etiquetas.llegada.await(5, TimeUnit.SECONDS))
            assertEquals(Rol.TICKETS, tickets.recibidos.single().rol)
            assertEquals(Rol.ETIQUETAS, etiquetas.recibidos.single().rol)
        } finally {
            sTickets.detener()
            sEtiquetas.detener()
        }
    }

    @Test
    fun `un puerto ocupado se reporta al arrancar y no en silencio`() {
        val primero = ServidorTcp(Rol.TICKETS, ImpresorFalso())
        assertTrue(primero.arrancar(0))
        try {
            val impresor = ImpresorFalso()
            val segundo = ServidorTcp(Rol.ETIQUETAS, impresor)
            // Mismo puerto que ya está tomado: tiene que decir que no, aquí y ahora.
            assertEquals(false, segundo.arrancar(primero.puertoActivo))
            assertTrue(impresor.anotaciones.any { it.contains("no se pudo abrir el puerto") })
        } finally {
            primero.detener()
        }
    }
}
