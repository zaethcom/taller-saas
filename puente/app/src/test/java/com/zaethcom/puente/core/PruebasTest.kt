package com.zaethcom.puente.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Los bytes de prueba son lo primero que alguien ejecuta en una sede nueva. Si están
 * mal, el diagnóstico apunta a la impresora o al cable cuando el problema era el
 * payload -- que es justo la confusión que más tiempo cuesta en mostrador.
 */
class PruebasTest {

    @Test
    fun `el ticket empieza inicializando la impresora`() {
        val bytes = Pruebas.ticket()
        // ESC @ (0x1B 0x40) es el "reset" de ESC/POS: sin esto la impresora hereda
        // el estado del trabajo anterior (negrita colgada, alineación rara).
        assertEquals(0x1B.toByte(), bytes[0])
        assertEquals(0x40.toByte(), bytes[1])
    }

    @Test
    fun `el ticket termina cortando el papel`() {
        val bytes = Pruebas.ticket()
        val ultimos = bytes.takeLast(4)
        // GS V 66 0 = corte parcial.
        assertEquals(listOf(0x1D.toByte(), 'V'.code.toByte(), 66.toByte(), 0.toByte()), ultimos)
    }

    @Test
    fun `el pulso del cajon es el estandar ESC p`() {
        val bytes = Pruebas.abrirCajon()
        assertEquals(5, bytes.size)
        assertEquals(0x1B.toByte(), bytes[0])
        assertEquals('p'.code.toByte(), bytes[1])
    }

    @Test
    fun `la etiqueta de prueba es ZPL bien delimitado`() {
        val zpl = String(Pruebas.etiqueta(), Charsets.UTF_8)
        assertTrue("debe abrir con ^XA", zpl.startsWith("^XA"))
        assertTrue("debe cerrar con ^XZ", zpl.endsWith("^XZ"))
    }

    @Test
    fun `cada dialecto emite su propio preambulo`() {
        // Si dos dialectos generaran lo mismo, probar uno u otro no
        // distinguiría nada y el diagnóstico no serviría para nada.
        val zpl = String(PruebasEtiqueta.de(Dialecto.ZPL), Charsets.UTF_8)
        val epl = String(PruebasEtiqueta.de(Dialecto.EPL), Charsets.US_ASCII)
        val tspl = String(PruebasEtiqueta.de(Dialecto.TSPL), Charsets.US_ASCII)
        val escpos = PruebasEtiqueta.de(Dialecto.ESC_POS)

        assertTrue("ZPL abre con ^XA", zpl.startsWith("^XA"))
        assertTrue("EPL limpia el buffer con N", epl.startsWith("N\r\n"))
        assertTrue("TSPL declara el tamaño primero", tspl.startsWith("SIZE"))
        assertEquals("ESC/POS inicializa con ESC @", 0x1B.toByte(), escpos[0])
        assertEquals(0x40.toByte(), escpos[1])
    }

    @Test
    fun `cada dialecto termina mandando imprimir`() {
        // Sin el comando de impresión la etiquetadora se queda con la
        // etiqueta compuesta en memoria y no sale papel -- que es
        // indistinguible de "no me llegó nada".
        assertTrue(String(PruebasEtiqueta.epl(), Charsets.US_ASCII).trimEnd().endsWith("P1"))
        assertTrue(String(PruebasEtiqueta.tspl(), Charsets.US_ASCII).trimEnd().endsWith("PRINT 1,1"))
        assertTrue(String(PruebasEtiqueta.zpl(), Charsets.UTF_8).endsWith("^XZ"))
    }

    @Test
    fun `los cuatro dialectos generan bytes distintos entre si`() {
        val todos = Dialecto.entries.map { PruebasEtiqueta.de(it).toList() }
        assertEquals(todos.size, todos.toSet().size)
    }

    @Test
    fun `el rol se reconoce sin importar mayusculas`() {
        assertEquals(Rol.TICKETS, Rol.desde("tickets"))
        assertEquals(Rol.TICKETS, Rol.desde("TICKETS"))
        assertEquals(Rol.ETIQUETAS, Rol.desde("Etiquetas"))
    }

    @Test
    fun `un rol desconocido no se inventa un valor por defecto`() {
        // Devolver TICKETS ante basura haría que un cliente mal configurado imprima
        // etiquetas en la impresora de recibos sin que nadie se entere.
        assertNull(Rol.desde("impresora3"))
        assertNull(Rol.desde(null))
    }

    @Test
    fun `los dos roles tienen puertos distintos por defecto`() {
        // Si coincidieran, el segundo ServerSocket fallaría al arrancar y el fallo
        // aparecería como "no imprime" en vez de como un choque de puertos.
        val puertos = Rol.entries.map { it.puertoPorDefecto }
        assertEquals(puertos.size, puertos.toSet().size)
    }
}
