package com.zaethcom.puente.core

import com.zaethcom.puente.net.ClienteWeb
import com.zaethcom.puente.net.ServidorHttp
import com.zaethcom.puente.net.ServidorTcp
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Arranca y para los tres oyentes: un TCP por rol (tickets y etiquetas, cada uno en
 * su puerto) más el HTTP, y el [ClienteWeb] que pide la cola a la web cuando el
 * equipo está vinculado con un código. Reiniciar es la única forma de aplicar un cambio de puerto:
 * un ServerSocket ya abierto no se muda.
 */
class Servidores(private val puente: Puente, private val web: ClienteWeb) {

    private val tcp: Map<Rol, ServidorTcp> =
        Rol.entries.associateWith { ServidorTcp(it, puente) }
    private val http = ServidorHttp(puente)

    /**
     * En qué puerto quedó escuchando de verdad cada rol (null si no se pudo abrir).
     * La pantalla decía «Escuchando en 9100» siempre, aunque el puerto no se hubiera
     * podido abrir; ahora muestra lo que realmente pasó.
     */
    private val _escucha = MutableStateFlow<Map<Rol, Int?>>(emptyMap())
    val escucha: StateFlow<Map<Rol, Int?>> = _escucha

    private fun publicarEscucha() {
        _escucha.value = Rol.entries.associateWith { rol ->
            tcp.getValue(rol).takeIf { it.activo }?.puertoActivo?.takeIf { it > 0 }
        }
    }

    fun arrancar() {
        val cfg = puente.config.value
        Rol.entries.forEach { rol ->
            tcp.getValue(rol).arrancar(cfg.de(rol).puerto)
        }
        if (cfg.secretoHttp.isNotBlank()) {
            http.arrancar(cfg.puertoHttp)
        } else {
            puente.anotar("HTTP: sin secreto configurado, no se abre el puerto")
        }
        web.arrancar()
        publicarEscucha()
    }

    fun detener() {
        tcp.values.forEach { it.detener() }
        http.detener()
        web.detener()
        publicarEscucha()
    }

    fun reiniciar() {
        detener()
        arrancar()
    }

    fun estado(): Map<String, Boolean> =
        Rol.entries.associate { it.etiqueta to tcp.getValue(it).activo } + ("HTTP" to http.activo)
}
