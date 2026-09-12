package com.zaethcom.puente

import android.app.Application
import com.zaethcom.puente.core.Puente
import com.zaethcom.puente.core.Servidores

/**
 * Sin inyección de dependencias: esta app tiene tres objetos de larga vida y un
 * grafo de Hilt para eso sería más ceremonia que código.
 */
class PuenteApp : Application() {

    lateinit var puente: Puente
        private set
    lateinit var servidores: Servidores
        private set

    override fun onCreate() {
        super.onCreate()
        puente = Puente(this)
        servidores = Servidores(puente)
    }
}
