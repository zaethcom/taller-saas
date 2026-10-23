package com.zaethcom.puente

import android.app.Application
import com.zaethcom.puente.core.Puente
import com.zaethcom.puente.core.Servidores
import com.zaethcom.puente.net.AlmacenVinculoPrefs
import com.zaethcom.puente.net.ClienteWeb
import com.zaethcom.puente.net.HttpUrlConnection
import com.zaethcom.puente.net.fabricaTls

/**
 * Sin inyección de dependencias: esta app tiene tres objetos de larga vida y un
 * grafo de Hilt para eso sería más ceremonia que código.
 */
class PuenteApp : Application() {

    lateinit var puente: Puente
        private set
    lateinit var servidores: Servidores
        private set
    lateinit var web: ClienteWeb
        private set

    override fun onCreate() {
        super.onCreate()
        puente = Puente(this)
        // Raíces de Let's Encrypt dentro del APK: Android 5 no las trae (ver net/Tls.kt).
        val tls = fabricaTls(listOf(R.raw.isrg_root_x1, R.raw.isrg_root_x2).map { resources.openRawResource(it) })
        web = ClienteWeb(puente, AlmacenVinculoPrefs(this), HttpUrlConnection(tls))
        servidores = Servidores(puente, web)
    }
}
