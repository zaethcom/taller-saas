package com.zaethcom.puente.core

import java.io.ByteArrayOutputStream

/**
 * Los idiomas que puede hablar una etiquetadora.
 *
 * El puente reenvía RAW y no necesita saberlo -- pero el botón de prueba sí,
 * porque genera los bytes él mismo. Existe porque una etiquetadora que no
 * reacciona no distingue entre "está mal conectada" y "le estoy hablando en
 * otro idioma": mandando uno de cada, se sabe en treinta segundos y sin
 * tener que averiguar el modelo.
 */
enum class Dialecto(val etiqueta: String) {
    ZPL("ZPL"),
    EPL("EPL / PPLB"),
    TSPL("TSPL"),
    ESC_POS("ESC/POS"),
}

/** Etiquetas de prueba, una por dialecto. Todas en modo texto: lo que hace
 *  falta es saber si la impresora reacciona, no que quede bonita. */
object PruebasEtiqueta {

    /** Zebra y las genéricas compatibles. Es lo que genera hoy estacion/etiqueta.ts. */
    fun zpl(): ByteArray =
        ("^XA" +
            "^CI28" +
            "^FO30,30^A0N,28,28^FDPuente de impresion^FS" +
            "^FO30,70^A0N,22,22^FDPrueba ZPL^FS" +
            "^XZ").toByteArray(Charsets.UTF_8)

    /** EPL2, y el PPLB de Argox en modo texto. */
    fun epl(): ByteArray =
        ("N\r\n" +
            "q406\r\n" +
            "Q240,24\r\n" +
            "A30,30,0,3,1,1,N,\"Puente de impresion\"\r\n" +
            "A30,90,0,2,1,1,N,\"Prueba EPL\"\r\n" +
            "P1\r\n").toByteArray(Charsets.US_ASCII)

    /** TSC y buena parte de las genéricas. */
    fun tspl(): ByteArray =
        ("SIZE 50 mm,30 mm\r\n" +
            "GAP 2 mm,0 mm\r\n" +
            "CLS\r\n" +
            "TEXT 30,30,\"3\",0,1,1,\"Puente de impresion\"\r\n" +
            "TEXT 30,90,\"2\",0,1,1,\"Prueba TSPL\"\r\n" +
            "PRINT 1,1\r\n").toByteArray(Charsets.US_ASCII)

    /** Algunas etiquetadoras baratas son ESC/POS con otro nombre. */
    fun escPos(): ByteArray = ByteArrayOutputStream().apply {
        write(byteArrayOf(0x1B, 0x40))
        write("Puente de impresion\n".toByteArray(Charsets.US_ASCII))
        write("Prueba ESC/POS\n".toByteArray(Charsets.US_ASCII))
        write(byteArrayOf(0x0A, 0x0A, 0x0A))
    }.toByteArray()

    fun de(dialecto: Dialecto): ByteArray = when (dialecto) {
        Dialecto.ZPL -> zpl()
        Dialecto.EPL -> epl()
        Dialecto.TSPL -> tspl()
        Dialecto.ESC_POS -> escPos()
    }
}

/**
 * Bytes de prueba para verificar que una impresora responde, sin depender de
 * que la aplicación web esté levantada.
 *
 * El puente reenvía RAW y no sabe qué protocolo habla cada impresora, así que
 * aquí sí hay que elegir uno: ESC/POS para el rol de tickets (que es lo que
 * habla la TM-T20II) y, para etiquetas, el que el usuario pruebe.
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

    /** El ZPL de siempre: es lo que genera la estación para las etiquetas
     *  reales, así que es el dialecto que de verdad importa acertar. */
    fun etiqueta(): ByteArray = PruebasEtiqueta.zpl()

    fun para(rol: Rol): ByteArray = when (rol) {
        Rol.TICKETS -> ticket()
        Rol.ETIQUETAS -> etiqueta()
    }

    /** Solo para tickets: el pulso que abre el cajón monedero. */
    fun abrirCajon(): ByteArray = byteArrayOf(ESC, 'p'.code.toByte(), 0, 25, 250.toByte())
}
