package com.zaethcom.puente

import android.app.Application
import com.zaethcom.puente.core.Puente
import com.zaethcom.puente.core.Servidores
import com.zaethcom.puente.net.AlmacenVinculoPrefs
import com.zaethcom.puente.net.ClienteWeb
import com.zaethcom.puente.net.RedLocal

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
    /** La IP del equipo en la red del local, siempre al día. */
    lateinit var red: RedLocal
        private set

    override fun onCreate() {
        super.onCreate()
        puente = Puente(this)
        web = ClienteWeb(puente, AlmacenVinculoPrefs(this))
        servidores = Servidores(puente, web)
        red = RedLocal(this).also { it.vigilar() }
    }
}
