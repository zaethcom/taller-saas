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
import com.zaethcom.puente.net.ipLocal

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

    override fun onCreate() {
        super.onCreate()
        crearCanal()
        val app = applicationContext as PuenteApp
        arrancarEnPrimerPlano(app)
        app.servidores.arrancar()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // START_STICKY: si el sistema lo mata por memoria, que lo vuelva a levantar.
        return START_STICKY
    }

    override fun onDestroy() {
        (applicationContext as PuenteApp).servidores.detener()
        super.onDestroy()
    }

    private fun arrancarEnPrimerPlano(app: PuenteApp) {
        val cfg = app.puente.config.value
        val ip = ipLocal() ?: "sin red"
        val detalle = "$ip · tickets ${cfg.de(Rol.TICKETS).puerto} · etiquetas ${cfg.de(Rol.ETIQUETAS).puerto}"

        val abrir = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )

        val notificacion: Notification = NotificationCompat.Builder(this, CANAL)
            .setContentTitle("Puente de impresión activo")
            .setContentText(detalle)
            .setSmallIcon(R.drawable.ic_puente)
            .setContentIntent(abrir)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(ID_NOTIFICACION, notificacion, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
        } else {
            startForeground(ID_NOTIFICACION, notificacion)
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
