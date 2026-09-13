package com.zaethcom.puente.net

import com.zaethcom.puente.core.Impresor
import com.zaethcom.puente.core.Resultado
import com.zaethcom.puente.core.Rol
import java.util.concurrent.CountDownLatch

/**
 * Un [Impresor] que no toca ningún USB: guarda lo que le mandan para poder afirmar
 * sobre ello. Es lo que permite probar el protocolo de verdad, con sockets reales,
 * sin emulador ni impresora.
 */
class ImpresorFalso(
    private val respuesta: Resultado = Resultado.Ok,
    private val secreto: String = ""
) : Impresor {

    data class Trabajo(val rol: Rol, val datos: ByteArray)

    val recibidos = mutableListOf<Trabajo>()
    val anotaciones = mutableListOf<String>()

    /** Para esperar a que el servidor termine de procesar antes de afirmar. */
    val llegada = CountDownLatch(1)

    override suspend fun imprimir(rol: Rol, datos: ByteArray): Resultado {
        synchronized(recibidos) { recibidos.add(Trabajo(rol, datos)) }
        llegada.countDown()
        return respuesta
    }

    override fun anotar(texto: String, esError: Boolean) {
        synchronized(anotaciones) { anotaciones.add(texto) }
    }

    override fun secretoHttp(): String = secreto
}
