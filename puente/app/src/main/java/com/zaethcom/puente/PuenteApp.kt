package com.zaethcom.puente

import android.app.Application
import com.zaethcom.puente.core.Puente
import com.zaethcom.puente.core.Servidores
import com.zaethcom.puente.net.AlmacenVinculoPrefs
import com.zaethcom.puente.net.ClienteWeb

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
        web = ClienteWeb(puente, AlmacenVinculoPrefs(this))
        servidores = Servidores(puente, web)
    }
}
