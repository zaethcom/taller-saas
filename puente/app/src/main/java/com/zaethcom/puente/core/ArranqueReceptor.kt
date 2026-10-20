package com.zaethcom.puente.core

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Levanta el puente solo cuando el equipo se prende o la app se actualiza.
 *
 * Sin esto, después de un apagón o un reinicio el puente quedaba muerto hasta que
 * alguien abriera la app a mano -- y en un mostrador nadie se acuerda: la sede se
 * quedaba sin imprimir. La configuración (impresoras asignadas y vínculo con la web)
 * ya se guarda en SharedPreferences, así que basta con arrancar el servicio.
 */
class ArranqueReceptor : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED -> runCatching { ServicioPuente.arrancar(context) }
        }
    }
}
