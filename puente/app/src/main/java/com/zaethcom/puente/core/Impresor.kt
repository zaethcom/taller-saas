package com.zaethcom.puente.core

/**
 * Lo único que los servidores necesitan saber del puente: a quién entregarle los
 * bytes y dónde dejar constancia.
 *
 * Existe para poder probar el protocolo de verdad. [Puente] necesita un Context de
 * Android para llegar al USB, y eso arrastra todo el aparato de instrumentación a
 * unas pruebas que no tienen nada que ver con el USB: lo que hay que verificar es
 * que el framing TCP siga siendo byte a byte el que `estacion/destino.ts` ya manda,
 * y eso se comprueba en la JVM con un socket y un impresor de mentira.
 */
/** Resultado de un trabajo. El mensaje viaja tal cual al cliente, así que se escribe
 *  pensando en quien lo va a leer en la consola de la estación, no en el log. */
sealed interface Resultado {
    data object Ok : Resultado
    data class Error(val motivo: String) : Resultado
}

interface Impresor {
    suspend fun imprimir(rol: Rol, datos: ByteArray): Resultado
    fun anotar(texto: String, esError: Boolean = false)
    /** Vacío significa "sin configurar": el servidor HTTP falla cerrado. */
    fun secretoHttp(): String
}
