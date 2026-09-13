package com.zaethcom.puente

import android.Manifest
import android.content.pm.PackageManager
import android.hardware.usb.UsbDevice
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.clickable
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.zaethcom.puente.core.*
import com.zaethcom.puente.net.ipLocal
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

        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                Surface(modifier = Modifier.fillMaxSize()) {
                    Pantalla(app)
                }
            }
        }
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
    val ip = remember { ipLocal() }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Cabecera(ip, config)

        Rol.entries.forEach { rol ->
            TarjetaImpresora(
                cfg = config.de(rol),
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

    eligiendoPara?.let { rol ->
        DialogoDispositivos(
            transporte = UsbRawTransport(contexto),
            alElegir = { dispositivo ->
                alcance.launch {
                    val transporte = UsbRawTransport(contexto)
                    if (!transporte.tienePermiso(dispositivo)) {
                        val ok = transporte.pedirPermiso(dispositivo)
                        if (!ok) {
                            puente.anotar("Permiso USB denegado para ${dispositivo.productName}", esError = true)
                            eligiendoPara = null
                            return@launch
                        }
                    }
                    puente.actualizar(
                        config.de(rol).copy(
                            vendorId = dispositivo.vendorId,
                            productId = dispositivo.productId,
                            descripcion = descripcion(dispositivo)
                        )
                    )
                    puente.anotar("${rol.etiqueta}: asignada ${descripcion(dispositivo)}")
                    eligiendoPara = null
                }
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

@Composable
private fun Cabecera(ip: String?, config: ConfigPuente) {
    Card {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Puente de impresión", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(
                "Esta es la dirección que va en el config.json de la estación:",
                style = MaterialTheme.typography.bodySmall
            )
            Text(
                ip ?: "Sin red — conecta el equipo",
                fontFamily = FontFamily.Monospace,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary
            )
            Text(
                "tickets → puerto ${config.de(Rol.TICKETS).puerto}   ·   " +
                    "etiquetas → puerto ${config.de(Rol.ETIQUETAS).puerto}",
                fontFamily = FontFamily.Monospace,
                style = MaterialTheme.typography.bodySmall
            )
        }
    }
}

@Composable
private fun TarjetaImpresora(
    cfg: ImpresoraCfg,
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

    Card {
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
                        else -> Text("Escuchando en ${cfg.puerto}")
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

@Composable
private fun TarjetaHttp(secreto: String, puerto: Int, alGuardar: (String, Int) -> Unit) {
    var textoSecreto by remember(secreto) { mutableStateOf(secreto) }
    var textoPuerto by remember(puerto) { mutableStateOf(puerto.toString()) }

    Card {
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
    Card {
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
