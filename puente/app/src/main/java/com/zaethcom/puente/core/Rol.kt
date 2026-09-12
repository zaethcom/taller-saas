package com.zaethcom.puente.core

/**
 * Las dos salidas que este puente atiende. El rol NO viaja en el protocolo TCP:
 * cada rol escucha en su propio puerto, así un cliente que ya hablaba con el
 * puerto 9100 sigue funcionando sin enterarse de que ahora hay dos impresoras
 * (ver puente/README.md, "Por qué un puerto por rol").
 */
enum class Rol(val etiqueta: String, val puertoPorDefecto: Int) {
    TICKETS("Tickets", 9100),
    ETIQUETAS("Etiquetas", 9101);

    companion object {
        fun desde(nombre: String?): Rol? =
            entries.firstOrNull { it.name.equals(nombre, ignoreCase = true) }
    }
}
