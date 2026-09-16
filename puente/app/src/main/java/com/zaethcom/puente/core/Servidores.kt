package com.zaethcom.puente.core

import com.zaethcom.puente.net.ServidorHttp
import com.zaethcom.puente.net.ServidorTcp

/**
 * Arranca y para los tres oyentes: un TCP por rol (tickets y etiquetas, cada uno en
 * su puerto) más el HTTP. Reiniciar es la única forma de aplicar un cambio de puerto:
 * un ServerSocket ya abierto no se muda.
 */
class Servidores(private val puente: Puente) {

    private val tcp: Map<Rol, ServidorTcp> =
        Rol.entries.associateWith { ServidorTcp(it, puente) }
    private val http = ServidorHttp(puente)

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
    }

    fun detener() {
        tcp.values.forEach { it.detener() }
        http.detener()
    }

    fun reiniciar() {
        detener()
        arrancar()
    }

    fun estado(): Map<String, Boolean> =
        Rol.entries.associate { it.etiqueta to tcp.getValue(it).activo } + ("HTTP" to http.activo)
}
