package com.zaethcom.puente.core

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.zaethcom.puente.MainActivity
import com.zaethcom.puente.PuenteApp
import com.zaethcom.puente.R
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.drop
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach

private const val CANAL = "puente_impresion"
private const val ID_NOTIFICACION = 1

/**
 * Mantiene los servidores vivos aunque la app pase a segundo plano.
 *
 * smart-food-label deja esto explícitamente pendiente ("no es un Foreground Service
 * todavía") y lo justifica porque el terminal es un aparato dedicado que nadie cierra.
 * Aquí sí lo es: un servicio en primer plano con notificación permanente es lo único
 * que impide que Android mate el proceso cuando la pantalla lleva un rato apagada --
 * exactamente el modo en que va a vivir este equipo.
 */
class ServicioPuente : Service() {

    override fun onBind(intent: Intent?): IBinder? = null

    private val alcance = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate() {
        super.onCreate()
        crearCanal()
        val app = applicationContext as PuenteApp
        arrancarEnPrimerPlano(app)
        app.servidores.arrancar()
        // Al prender el equipo el servicio arranca antes de que haya red: la
        // notificación se actualiza sola cuando la IP aparece o cambia.
        app.red.ip.drop(1)
            .onEach { ip ->
                (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                    .notify(ID_NOTIFICACION, notificacion(app, ip))
            }
            .launchIn(alcance)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // START_STICKY: si el sistema lo mata por memoria, que lo vuelva a levantar.
        return START_STICKY
    }

    override fun onDestroy() {
        alcance.cancel()
        (applicationContext as PuenteApp).servidores.detener()
        super.onDestroy()
    }

    private fun notificacion(app: PuenteApp, ip: String?): Notification {
        val cfg = app.puente.config.value
        val detalle = "${ip ?: "sin red local"} · tickets ${cfg.de(Rol.TICKETS).puerto} · etiquetas ${cfg.de(Rol.ETIQUETAS).puerto}"

        val abrir = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CANAL)
            .setContentTitle("Puente de impresión activo")
            .setContentText(detalle)
            .setSmallIcon(R.drawable.ic_notificacion)
            .setContentIntent(abrir)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun arrancarEnPrimerPlano(app: PuenteApp) {
        val inicial = notificacion(app, app.red.ip.value)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(ID_NOTIFICACION, inicial, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        } else {
            startForeground(ID_NOTIFICACION, inicial)
        }
    }

    private fun crearCanal() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val canal = NotificationChannel(CANAL, "Puente de impresión", NotificationManager.IMPORTANCE_LOW).apply {
            description = "Mantiene abiertos los puertos de impresión"
        }
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
            .createNotificationChannel(canal)
    }

    companion object {
        fun arrancar(context: Context) {
            val intent = Intent(context, ServicioPuente::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }
    }
}
