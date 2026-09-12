package com.zaethcom.puente.core

import java.io.ByteArrayOutputStream

/**
 * Bytes de prueba para verificar que una impresora responde, sin depender de que la
 * aplicación web esté levantada.
 *
 * El puente reenvía RAW y no sabe qué protocolo habla cada impresora, así que aquí sí
 * hay que elegir uno: ESC/POS para el rol de tickets (que es lo que habla la TM-T20II)
 * y ZPL para el de etiquetas. Si la etiquetadora resulta hablar PPLB o EPL, esta
 * prueba concreta no imprimirá nada legible -- pero los trabajos de verdad sí, porque
 * esos llegan ya renderizados desde quien los generó.
 */
object Pruebas {

    private const val ESC: Byte = 0x1B
    private const val GS: Byte = 0x1D

    /** Recibo corto ESC/POS: inicializa, centra, imprime, avanza y corta. */
    fun ticket(): ByteArray = ByteArrayOutputStream().apply {
        write(byteArrayOf(ESC, '@'.code.toByte()))              // inicializar
        write(byteArrayOf(ESC, 'a'.code.toByte(), 1))           // centrar
        write(byteArrayOf(ESC, 'E'.code.toByte(), 1))           // negrita
        write("PUENTE DE IMPRESION\n".toByteArray(Charsets.US_ASCII))
        write(byteArrayOf(ESC, 'E'.code.toByte(), 0))           // fin de negrita
        write("Prueba de tickets\n".toByteArray(Charsets.US_ASCII))
        write("Si lees esto, funciona.\n".toByteArray(Charsets.US_ASCII))
        write(byteArrayOf(0x0A, 0x0A, 0x0A))                    // avanzar papel
        write(byteArrayOf(GS, 'V'.code.toByte(), 66, 0))        // corte parcial
    }.toByteArray()

    /** Etiqueta ZPL mínima. */
    fun etiqueta(): ByteArray =
        ("^XA" +
            "^CI28" +
            "^FO30,30^A0N,28,28^FDPuente de impresion^FS" +
            "^FO30,70^A0N,22,22^FDPrueba de etiquetas^FS" +
            "^XZ").toByteArray(Charsets.UTF_8)

    fun para(rol: Rol): ByteArray = when (rol) {
        Rol.TICKETS -> ticket()
        Rol.ETIQUETAS -> etiqueta()
    }

    /** Solo para tickets: el pulso que abre el cajón monedero. */
    fun abrirCajon(): ByteArray = byteArrayOf(ESC, 'p'.code.toByte(), 0, 25, 250.toByte())
}
