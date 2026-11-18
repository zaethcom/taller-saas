package com.zaethcom.puente

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.usb.UsbDevice
import android.hardware.usb.UsbManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zaethcom.puente.core.*
import com.zaethcom.puente.net.ClienteWeb
import com.zaethcom.puente.net.EstadoWeb
import com.zaethcom.puente.usb.UsbRawTransport
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    /** El resultado no cambia nada: si el usuario dice que no, el servicio sigue
     *  corriendo, solo que sin notificación visible. */
    private val pedirNotificaciones =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val app = applicationContext as PuenteApp

        // Android 13+ no muestra la notificación del servicio en primer plano sin
        // este permiso, y sin notificación visible el sistema es más agresivo
        // matando el proceso.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            pedirNotificaciones.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        ServicioPuente.arrancar(this)
        alConectarUsb(intent)

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    Pantalla(app)
                }
            }
        }
    }

    /** Al volver a la pantalla, la IP se lee de nuevo por si la red cambió mientras tanto. */
    override fun onResume() {
        super.onResume()
        (applicationContext as PuenteApp).red.refrescar()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        alConectarUsb(intent)
    }

    /**
     * Android abre la app al enchufar una impresora y, si se acepta su aviso, ya
     * deja el permiso USB concedido. Si esa impresora no está en ningún rol y hay
     * uno libre, se asigna aquí mismo: aceptar el aviso basta para dejarla guardada.
     */
    private fun alConectarUsb(intent: Intent?) {
        if (intent?.action != UsbManager.ACTION_USB_DEVICE_ATTACHED) return
        val dispositivo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE, UsbDevice::class.java)
        } else {
            @Suppress("DEPRECATION")
            intent.getParcelableExtra(UsbManager.EXTRA_DEVICE)
        } ?: return
        val puente = (applicationContext as PuenteApp).puente
        val config = puente.config.value
        val yaAsignada = Rol.entries.any {
            val cfg = config.de(it)
            cfg.vendorId == dispositivo.vendorId && cfg.productId == dispositivo.productId
        }
        if (yaAsignada) {
            puente.anotar("Conectada ${descripcion(dispositivo)}")
            return
        }
        val libre = Rol.entries.firstOrNull { !config.de(it).asignada } ?: run {
            puente.anotar("Conectada ${descripcion(dispositivo)}: los dos roles ya tienen impresora; usa «Elegir impresora» para cambiarla")
            return
        }
        puente.actualizar(
            config.de(libre).copy(
                vendorId = dispositivo.vendorId,
                productId = dispositivo.productId,
                descripcion = descripcion(dispositivo)
            )
        )
        puente.anotar("${libre.etiqueta}: asignada ${descripcion(dispositivo)} al conectarla")
    }
}

@Composable
private fun Pantalla(app: PuenteApp) {
    val puente = app.puente
    val config by puente.config.collectAsState()
    val bitacora by puente.bitacora.collectAsState()
    val alcance = rememberCoroutineScope()
    val contexto = LocalContext.current

    var eligiendoPara by remember { mutableStateOf<Rol?>(null) }
    // Antes: remember { ipLocal() }, leída una sola vez. Si la pantalla se abría
    // antes de que hubiera red (al prender el equipo), se quedaba en «Sin red».
    val ip by app.red.ip.collectAsState()
    val escucha by app.servidores.escucha.collectAsState()
    val estadoWeb by app.web.estado.collectAsState()
    val version = remember { versionInstalada(contexto) }

    // En un equipo de mostrador la pantalla es ancha: las tarjetas se centran con
    // un ancho máximo en vez de quedar cada una de un tamaño distinto.
    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.TopCenter) {
        Column(
            modifier = Modifier
                .widthIn(max = 760.dp)
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Cabecera(version, estadoWeb, config, escucha)

            TarjetaWeb(estadoWeb, app.web)

            Rol.entries.forEach { rol ->
                TarjetaImpresora(
                    cfg = config.de(rol),
                    puertoEscuchando = escucha[rol],
                    alAsignar = { eligiendoPara = rol },
                    alCambiarPuerto = { nuevo ->
                        puente.actualizar(config.de(rol).copy(puerto = nuevo))
                        app.servidores.reiniciar()
                    },
                    alProbar = {
                        alcance.launch { puente.imprimir(rol, Pruebas.para(rol)) }
                    },
                    // Solo etiquetas: si la impresora no reacciona, puede ser que
                    // hable otro idioma. Un botón por dialecto lo resuelve sin
                    // tener que averiguar el modelo.
                    alProbarDialecto = if (rol == Rol.ETIQUETAS) {
                        { d: Dialecto -> alcance.launch { puente.imprimir(rol, PruebasEtiqueta.de(d)) } }
                    } else null,
                    alAbrirCajon = if (rol == Rol.TICKETS) {
                        { alcance.launch { puente.imprimir(rol, Pruebas.abrirCajon()) } }
                    } else null
                )
            }

            TarjetaRedLocal(
                ip = ip,
                config = config,
                webEnLinea = estadoWeb.vinculo != null && estadoWeb.conectado,
                alBuscar = { app.red.refrescar() }
            )

            TarjetaHttp(
                secreto = config.secretoHttp,
                puerto = config.puertoHttp,
                alGuardar = { secreto, puerto ->
                    puente.actualizarHttp(secreto, puerto)
                    app.servidores.reiniciar()
                }
            )

            Bitacora(bitacora)
        }
    }

    eligiendoPara?.let { rol ->
        DialogoDispositivos(
            transporte = UsbRawTransport(contexto),
            alElegir = { dispositivo ->
                // Se guarda primero y el permiso se pide después, sin esperar la
                // respuesta: el diálogo de Android abre otra pantalla y, si esta se
                // recrea mientras tanto (girar, poca memoria), la asignación que
                // esperaba el «Aceptar» se perdía y la impresora quedaba sin guardar.
                puente.actualizar(
                    config.de(rol).copy(
                        vendorId = dispositivo.vendorId,
                        productId = dispositivo.productId,
                        descripcion = descripcion(dispositivo)
                    )
                )
                puente.anotar("${rol.etiqueta}: asignada ${descripcion(dispositivo)}")
                val transporte = UsbRawTransport(contexto)
                if (!transporte.tienePermiso(dispositivo)) transporte.pedirPermisoSinEsperar(dispositivo)
                eligiendoPara = null
            },
            alCerrar = { eligiendoPara = null }
        )
    }
}

private fun descripcion(d: UsbDevice): String {
    val nombre = listOfNotNull(d.manufacturerName, d.productName)
        .filter { it.isNotBlank() }
        .joinToString(" ")
        .ifBlank { "Dispositivo USB" }
    return "$nombre (${d.vendorId}:${d.productId})"
}

/** Colores de estado. Material 3 no trae un "verde de éxito", así que se fijan aquí. */
private val VERDE = Color(0xFF4CAF50)
private val AMBAR = Color(0xFFFFB300)

/** Un punto de color + texto: se lee de un vistazo desde lejos del mostrador. */
@Composable
private fun FilaEstado(color: Color, titulo: String, detalle: String) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.size(12.dp).background(color, CircleShape))
        Text(titulo, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
        if (detalle.isNotBlank()) {
            Text(
                detalle,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                // Un mensaje de error largo envuelve en vez de salirse de la tarjeta.
                modifier = Modifier.weight(1f, fill = false)
            )
        }
    }
}

/**
 * Resumen de todo en una sola tarjeta: ¿está conectado con la web? ¿cada impresora
 * está lista? Antes la cabecera solo mostraba la IP de la red local, que es lo menos
 * importante desde que el puente imprime directo desde la web, y un «Sin red» grande
 * hacía pensar que no funcionaba aunque estuviera en línea.
 */
@Composable
private fun Cabecera(version: String, web: EstadoWeb, config: ConfigPuente, escucha: Map<Rol, Int?>) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.Bottom) {
                Text("Puente de impresión", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                // Para poder responder "¿quedó instalada la nueva?" mirando la
                // pantalla, en vez de adivinando.
                Text(
                    "compilación $version",
                    fontFamily = FontFamily.Monospace,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            val vinculo = web.vinculo
            when {
                vinculo == null ->
                    FilaEstado(MaterialTheme.colorScheme.onSurfaceVariant, "Web", "sin vincular — escribe el código abajo")
                web.esError ->
                    FilaEstado(MaterialTheme.colorScheme.error, "Web", web.mensaje.ifBlank { "error de conexión" })
                web.conectado ->
                    FilaEstado(VERDE, "Web", "en línea · ${vinculo.sedeNombre}")
                else ->
                    FilaEstado(AMBAR, "Web", "conectando con ${vinculo.sedeNombre}…")
            }

            Rol.entries.forEach { rol ->
                val cfg = config.de(rol)
                when {
                    !cfg.asignada -> FilaEstado(AMBAR, rol.etiqueta, "sin impresora asignada")
                    escucha[rol] == null -> FilaEstado(MaterialTheme.colorScheme.error, rol.etiqueta, "puerto ${cfg.puerto} cerrado")
                    else -> FilaEstado(VERDE, rol.etiqueta, "lista")
                }
            }
        }
    }
}

/**
 * La IP solo hace falta para una estación de PC que le mande trabajos por la red del
 * local (config.json). Va aparte y marcada como opcional: no es lo que hace
 * funcionar el puente cuando está vinculado con la web.
 */
@Composable
private fun TarjetaRedLocal(ip: String?, config: ConfigPuente, webEnLinea: Boolean, alBuscar: () -> Unit) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Red local (opcional)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                "Solo para un PC del local que imprima aquí con la estación. Estas direcciones van en su config.json." +
                    if (webEnLinea) " Con la conexión con la web en línea, no hace falta." else "",
                style = MaterialTheme.typography.bodySmall
            )
            if (ip != null) {
                Rol.entries.forEach { rol ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            "$ip:${config.de(rol).puerto}",
                            fontFamily = FontFamily.Monospace,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = MaterialTheme.colorScheme.primary
                        )
                        Spacer(Modifier.width(12.dp))
                        Text(rol.etiqueta.lowercase(), style = MaterialTheme.typography.bodyMedium)
                    }
                }
            } else {
                Text(
                    "Este equipo no está en una red WiFi o de cable en este momento.",
                    style = MaterialTheme.typography.bodyMedium,
                    // Sin web, la red local es el único camino: ahí sí es un problema.
                    color = if (webEnLinea) MaterialTheme.colorScheme.onSurfaceVariant
                    else MaterialTheme.colorScheme.error
                )
                OutlinedButton(onClick = alBuscar) { Text("Buscar de nuevo") }
            }
        }
    }
}

/** El versionName del APK instalado -- "0.1.0-157f600". */
private fun versionInstalada(contexto: Context): String =
    runCatching {
        contexto.packageManager.getPackageInfo(contexto.packageName, 0).versionName ?: "desconocida"
    }.getOrDefault("desconocida")

@Composable
private fun TarjetaImpresora(
    cfg: ImpresoraCfg,
    /** Puerto donde el servidor quedó escuchando de verdad; null si no se pudo abrir. */
    puertoEscuchando: Int?,
    alAsignar: () -> Unit,
    alCambiarPuerto: (Int) -> Unit,
    alProbar: () -> Unit,
    alAbrirCajon: (() -> Unit)?,
    alProbarDialecto: ((Dialecto) -> Unit)? = null,
) {
    var textoPuerto by remember(cfg.puerto) { mutableStateOf(cfg.puerto.toString()) }

    // Los puertos por debajo de 1024 son privilegiados y Android no deja enlazarlos.
    val puertoValido = textoPuerto.toIntOrNull()?.takeIf { it in 1024..65535 }
    val hayCambio = puertoValido != null && puertoValido != cfg.puerto

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(cfg.rol.etiqueta, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Spacer(Modifier.weight(1f))
                AssistChip(
                    onClick = {},
                    label = { Text(if (cfg.asignada) "Asignada" else "Sin asignar") }
                )
            }

            Text(
                if (cfg.asignada) cfg.descripcion else "Ninguna impresora asignada todavía",
                style = MaterialTheme.typography.bodyMedium,
                fontFamily = if (cfg.asignada) FontFamily.Monospace else FontFamily.Default
            )

            // El puerto NO se aplica mientras se teclea. Al escribir "9101" el campo
            // pasa por 9, 91 y 910: guardarlos y reiniciar los servidores en cada
            // tecla dejaba el puente sin oyente (los tres primeros ni se pueden
            // enlazar) mientras la cabecera seguía mostrando el puerto viejo. Se
            // aplica con el botón, y solo si el valor es válido.
            OutlinedTextField(
                value = textoPuerto,
                onValueChange = { nuevo -> textoPuerto = nuevo.filter { it.isDigit() }.take(5) },
                label = { Text("Puerto") },
                singleLine = true,
                isError = textoPuerto.isNotEmpty() && puertoValido == null,
                supportingText = {
                    when {
                        textoPuerto.isNotEmpty() && puertoValido == null ->
                            Text("Tiene que estar entre 1024 y 65535")
                        hayCambio -> Text("Sin aplicar — pulsa Aplicar")
                        puertoEscuchando == cfg.puerto -> Text("Escuchando en ${cfg.puerto}")
                        else -> Text(
                            "No se pudo abrir el puerto ${cfg.puerto} — mira la Actividad",
                            color = MaterialTheme.colorScheme.error
                        )
                    }
                },
                modifier = Modifier.fillMaxWidth()
            )

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = alAsignar) { Text("Elegir impresora") }
                if (alProbarDialecto == null) {
                    OutlinedButton(onClick = alProbar, enabled = cfg.asignada) { Text("Probar") }
                }
                if (alAbrirCajon != null) {
                    OutlinedButton(onClick = alAbrirCajon, enabled = cfg.asignada) { Text("Cajón") }
                }
            }

            if (alProbarDialecto != null) {
                Text(
                    "Probar en cada idioma. El que imprima es el que habla tu etiquetadora.",
                    style = MaterialTheme.typography.bodySmall
                )
                FlowRowSimple {
                    Dialecto.entries.forEach { d ->
                        OutlinedButton(
                            onClick = { alProbarDialecto(d) },
                            enabled = cfg.asignada,
                        ) { Text(d.etiqueta) }
                    }
                }
            }

            if (hayCambio) {
                Button(
                    onClick = { alCambiarPuerto(puertoValido!!) },
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Aplicar puerto $puertoValido y reiniciar") }
            }
        }
    }
}

/** Fila que envuelve. Se escribe a mano en vez de usar FlowRow de Compose
 *  porque esa API sigue siendo experimental y esto son cuatro botones. */
@Composable
private fun FlowRowSimple(contenido: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { contenido() }
    }
}

/**
 * Vincular este equipo con la web usando el código de Sedes. Va arriba porque es
 * lo primero que se hace en una sede nueva: con esto ya no hace falta un PC.
 */
@Composable
private fun TarjetaWeb(estado: EstadoWeb, web: ClienteWeb) {
    val alcance = rememberCoroutineScope()
    var codigo by remember { mutableStateOf("") }
    var trabajando by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val vinculo = estado.vinculo

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Conexión con la web", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)

            if (vinculo == null) {
                Text(
                    "En la web: Sedes → Estación de impresión → «Código para la app Android». " +
                        "Escribe aquí ese código. No hace falta computador.",
                    style = MaterialTheme.typography.bodySmall
                )
                OutlinedTextField(
                    value = codigo,
                    onValueChange = { codigo = it.uppercase().take(9) },
                    label = { Text("Código (ej. ABCD-EFGH)") },
                    singleLine = true,
                    isError = error != null,
                    supportingText = { error?.let { Text(it) } },
                    modifier = Modifier.fillMaxWidth()
                )
                Button(
                    enabled = !trabajando && codigo.isNotBlank(),
                    onClick = {
                        trabajando = true
                        error = null
                        alcance.launch {
                            error = web.vincular(codigo, Build.MODEL ?: "Android")
                            trabajando = false
                            if (error == null) codigo = ""
                        }
                    }
                ) { Text(if (trabajando) "Vinculando…" else "Vincular") }
            } else {
                Text("Sede: ${vinculo.sedeNombre}", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Bold)
                FilaEstado(
                    color = when {
                        estado.esError -> MaterialTheme.colorScheme.error
                        estado.conectado -> VERDE
                        else -> AMBAR
                    },
                    titulo = when {
                        estado.esError -> "Con error"
                        estado.conectado -> "En línea"
                        else -> "Conectando"
                    },
                    // «En línea con Local 1» repetiría el título; el resto sí informa.
                    detalle = if (estado.conectado && !estado.esError) "" else estado.mensaje
                )
                Text(
                    "Los trabajos de la web llegan por internet. No hace falta la red local ni un PC.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                OutlinedButton(onClick = { web.desvincular() }) { Text("Desvincular") }
            }
        }
    }
}

@Composable
private fun TarjetaHttp(secreto: String, puerto: Int, alGuardar: (String, Int) -> Unit) {
    var textoSecreto by remember(secreto) { mutableStateOf(secreto) }
    var textoPuerto by remember(puerto) { mutableStateOf(puerto.toString()) }

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Servidor HTTP (opcional)", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Text(
                "Solo hace falta para imprimir desde fuera de la red local. Sin secreto, el puerto no se abre.",
                style = MaterialTheme.typography.bodySmall
            )
            OutlinedTextField(
                value = textoSecreto,
                onValueChange = { textoSecreto = it },
                label = { Text("Secreto") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            OutlinedTextField(
                value = textoPuerto,
                onValueChange = { textoPuerto = it.filter { c -> c.isDigit() }.take(5) },
                label = { Text("Puerto HTTP") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Button(onClick = { alGuardar(textoSecreto.trim(), textoPuerto.toIntOrNull() ?: 8090) }) {
                Text("Guardar y reiniciar servidores")
            }
        }
    }
}

@Composable
private fun Bitacora(lineas: List<Linea>) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Actividad", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            if (lineas.isEmpty()) {
                Text("Todavía no ha pasado nada.", style = MaterialTheme.typography.bodySmall)
            } else {
                lineas.asReversed().take(40).forEach { linea ->
                    Text(
                        "${linea.cuando}  ${linea.texto}",
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        color = if (linea.esError) MaterialTheme.colorScheme.error
                        else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }
}

@Composable
private fun DialogoDispositivos(
    transporte: UsbRawTransport,
    alElegir: (UsbDevice) -> Unit,
    alCerrar: () -> Unit
) {
    val dispositivos = remember { transporte.dispositivos() }

    AlertDialog(
        onDismissRequest = alCerrar,
        title = { Text("Elegir impresora USB") },
        text = {
            if (dispositivos.isEmpty()) {
                Text("No se ve ningún dispositivo USB. Revisa el cable y que la impresora esté encendida.")
            } else {
                LazyColumn {
                    items(dispositivos) { d ->
                        ListItem(
                            headlineContent = { Text(descripcion(d)) },
                            supportingContent = { Text("VID ${d.vendorId} · PID ${d.productId}") },
                            modifier = Modifier.clickable { alElegir(d) }
                        )
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = alCerrar) { Text("Cerrar") } }
    )
}
