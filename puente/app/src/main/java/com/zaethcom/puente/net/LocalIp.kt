package com.zaethcom.puente.net

import android.content.Context
import android.net.ConnectivityManager
import android.net.LinkProperties
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.net.Inet4Address
import java.net.InetAddress
import java.net.NetworkInterface

/**
 * La IP de este equipo en la red local: la que va en el config.json de una estación
 * de PC. La conexión con la web NO la necesita.
 *
 * Antes era una función que se llamaba una sola vez al abrir la pantalla. Desde que
 * la app arranca sola al prender el equipo (y Android la abre al detectar la
 * impresora USB), esa primera llamada podía llegar antes de que la WiFi o el cable
 * tuvieran dirección: devolvía null y la cabecera se quedaba en «Sin red» para
 * siempre, aunque el equipo estuviera en línea. Ahora se vigila la red y el valor se
 * actualiza solo cada vez que cambia.
 *
 * Usa ConnectivityManager y NetworkInterface, no WifiManager: no pide permiso de
 * ubicación y funciona igual por cable, que es como suele estar un equipo de
 * mostrador.
 */
class RedLocal(context: Context) {

    private val cm = context.applicationContext.getSystemService(ConnectivityManager::class.java)

    private val _ip = MutableStateFlow(leer())
    val ip: StateFlow<String?> = _ip

    private var vigilando = false

    /** Empieza a seguir los cambios de red. Se llama una vez, al crear la app. */
    fun vigilar() {
        if (vigilando || cm == null) return
        vigilando = true
        val pedido = NetworkRequest.Builder()
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .addTransportType(NetworkCapabilities.TRANSPORT_ETHERNET)
            // Una red del local sin salida a internet también le sirve a la estación.
            .removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        runCatching {
            cm.registerNetworkCallback(pedido, object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) = refrescar()
                override fun onLost(network: Network) = refrescar()
                override fun onLinkPropertiesChanged(network: Network, lp: LinkProperties) = refrescar()
            })
        }
    }

    /** Vuelve a leer la IP ya. Para el botón «Buscar de nuevo» y al volver a la app. */
    fun refrescar() {
        _ip.value = leer()
    }

    private fun leer(): String? = desdeConnectivity() ?: desdeInterfaces()

    /**
     * Revisa todas las redes WiFi/cable que Android conoce, no solo la activa: la
     * activa puede ser datos móviles aunque el equipo también esté en la WiFi del local.
     */
    @Suppress("DEPRECATION")
    private fun desdeConnectivity(): String? = runCatching {
        val cm = cm ?: return null
        val activa = cm.activeNetwork
        cm.allNetworks
            .sortedByDescending { it == activa }
            .asSequence()
            .filter { red ->
                val caps = cm.getNetworkCapabilities(red) ?: return@filter false
                caps.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                    caps.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET)
            }
            .mapNotNull { red ->
                cm.getLinkProperties(red)?.linkAddresses
                    ?.map { it.address }
                    ?.let { primeraUtil(it) }
            }
            .firstOrNull()
    }.getOrNull()

    /** Respaldo para equipos (PC con Android) donde el cable no se reporta bien. */
    private fun desdeInterfaces(): String? = runCatching {
        NetworkInterface.getNetworkInterfaces().toList()
            .filter { it.isUp && !it.isLoopback && !it.isVirtual }
            .map { InterfazRed(it.name, it.inetAddresses.toList()) }
            .let { elegirDeInterfaces(it) }
    }.getOrNull()
}

/** Lo mínimo de una interfaz para poder elegir, separado para probarlo en la JVM. */
data class InterfazRed(val nombre: String, val direcciones: List<InetAddress>)

/** Interfaces que nunca son "la red del local": datos móviles, túneles, VPN, etc. */
private val NO_LOCALES = listOf(
    "lo", "rmnet", "ccmni", "tun", "ppp", "dummy", "p2p", "v4-", "ip6tnl", "sit", "docker", "veth"
)

/**
 * La primera IPv4 útil, prefiriendo cable (eth), luego WiFi (wlan), luego lo demás.
 * Antes se tomaba la primera IPv4 de cualquier interfaz, que en algunos equipos era
 * la de datos móviles o la de una VPN.
 */
fun elegirDeInterfaces(interfaces: List<InterfazRed>): String? =
    interfaces
        .filter { i -> NO_LOCALES.none { i.nombre.startsWith(it) } }
        .sortedBy {
            when {
                it.nombre.startsWith("eth") -> 0
                it.nombre.startsWith("wlan") -> 1
                else -> 2
            }
        }
        .firstNotNullOfOrNull { primeraUtil(it.direcciones) }

private fun primeraUtil(direcciones: List<InetAddress>): String? =
    direcciones
        .filterIsInstance<Inet4Address>()
        .filter { !it.isLoopbackAddress && !it.isLinkLocalAddress && !it.isAnyLocalAddress }
        // 192.168.x / 10.x / 172.16-31.x primero: es lo que tiene una red de local.
        .sortedByDescending { it.isSiteLocalAddress }
        .firstOrNull()
        ?.hostAddress
