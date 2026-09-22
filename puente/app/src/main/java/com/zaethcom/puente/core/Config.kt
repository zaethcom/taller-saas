package com.zaethcom.puente.core

import android.content.Context
import org.json.JSONObject

/**
 * A qué dispositivo USB va un rol. `vendorId`/`productId` identifican la impresora
 * física: sobreviven a desenchufarla y volverla a conectar, que es justamente lo que
 * pasa en un mostrador.
 */
data class ImpresoraCfg(
    val rol: Rol,
    val vendorId: Int? = null,
    val productId: Int? = null,
    val descripcion: String = "",
    val puerto: Int = rol.puertoPorDefecto
) {
    val asignada: Boolean get() = vendorId != null && productId != null
}

/** Config completa del puente. Se guarda en SharedPreferences como un JSON pequeño. */
data class ConfigPuente(
    val impresoras: Map<Rol, ImpresoraCfg>,
    val secretoHttp: String = "",
    val puertoHttp: Int = 8090
) {
    fun de(rol: Rol): ImpresoraCfg = impresoras[rol] ?: ImpresoraCfg(rol)

    fun con(cfg: ImpresoraCfg): ConfigPuente =
        copy(impresoras = impresoras + (cfg.rol to cfg))

    companion object {
        fun vacia() = ConfigPuente(Rol.entries.associateWith { ImpresoraCfg(it) })
    }
}

class AlmacenConfig(context: Context) {
    private val prefs = context.getSharedPreferences("puente", Context.MODE_PRIVATE)

    fun cargar(): ConfigPuente {
        val crudo = prefs.getString(CLAVE, null) ?: return ConfigPuente.vacia()
        return try {
            val raiz = JSONObject(crudo)
            val impresoras = Rol.entries.associateWith { rol ->
                val o = raiz.optJSONObject(rol.name) ?: return@associateWith ImpresoraCfg(rol)
                ImpresoraCfg(
                    rol = rol,
                    vendorId = if (o.has("vid")) o.getInt("vid") else null,
                    productId = if (o.has("pid")) o.getInt("pid") else null,
                    descripcion = o.optString("desc", ""),
                    puerto = o.optInt("puerto", rol.puertoPorDefecto)
                )
            }
            ConfigPuente(
                impresoras = impresoras,
                secretoHttp = raiz.optString("secretoHttp", ""),
                puertoHttp = raiz.optInt("puertoHttp", 8090)
            )
        } catch (e: Exception) {
            // Config corrupta: mejor arrancar en blanco que no arrancar.
            ConfigPuente.vacia()
        }
    }

    fun guardar(config: ConfigPuente) {
        val raiz = JSONObject()
        config.impresoras.forEach { (rol, cfg) ->
            val o = JSONObject()
            cfg.vendorId?.let { o.put("vid", it) }
            cfg.productId?.let { o.put("pid", it) }
            o.put("desc", cfg.descripcion)
            o.put("puerto", cfg.puerto)
            raiz.put(rol.name, o)
        }
        raiz.put("secretoHttp", config.secretoHttp)
        raiz.put("puertoHttp", config.puertoHttp)
        prefs.edit().putString(CLAVE, raiz.toString()).apply()
    }

    private companion object { const val CLAVE = "config_v1" }
}
