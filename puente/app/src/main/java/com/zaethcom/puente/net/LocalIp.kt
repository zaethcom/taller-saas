package com.zaethcom.puente.net

import java.net.Inet4Address
import java.net.NetworkInterface

/**
 * IP de este equipo en la red local, para mostrarla en pantalla: es la que hay que
 * poner en el config.json de la estación. Usa NetworkInterface y no WifiManager --
 * no pide permisos de ubicación y funciona igual por cable, que es como suele estar
 * conectado un equipo fijo de mostrador.
 */
fun ipLocal(): String? = try {
    NetworkInterface.getNetworkInterfaces().asSequence()
        .filter { !it.isLoopback && it.isUp }
        .flatMap { it.inetAddresses.asSequence() }
        .filterIsInstance<Inet4Address>()
        .mapNotNull { it.hostAddress }
        .firstOrNull()
} catch (e: Exception) {
    null
}
