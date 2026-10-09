# Instalar el puente por USB cuando el equipo "no deja instalar nada".
#
# Ese síntoma tiene cinco causas distintas en Android y cada una se arregla
# distinto; el mensaje de adb es el que las distingue. Este script lo lee y
# aplica el remedio que corresponde, en vez de dejar a alguien probando a
# ciegas frente al mostrador.
#
#   .\instalar-usb.ps1                  # baja el APK de la release y lo instala
#   .\instalar-usb.ps1 -Apk .\otro.apk  # instala uno que ya tengas
#   .\instalar-usb.ps1 -Desinstalar     # borra la app antes (pierde su config)
#
# Requiere: depuración USB activada en el equipo, y adb en el PATH.

param(
  [string]$Apk = "",
  [switch]$Desinstalar
)

$ErrorActionPreference = "Stop"
$paquete = "com.zaethcom.puente"
$urlApk  = "https://github.com/zaethcom/taller-saas/releases/download/puente-dev/puente.apk"

function Paso($n, $texto) { Write-Host "`n[$n] $texto" -ForegroundColor Cyan }

# --- 1. Herramientas --------------------------------------------------
Paso 1 "Comprobando adb"
if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  Write-Host "  No hay adb en el PATH." -ForegroundColor Red
  Write-Host "  Descarga 'Android SDK Platform Tools' y agrega su carpeta al PATH."
  exit 1
}
Write-Host "  ok" -ForegroundColor Green

# --- 2. El equipo ------------------------------------------------------
# `adb devices` distingue tres fallos que desde la pantalla se ven igual:
# que no aparezca (cable de solo carga, driver, depuración apagada), que
# aparezca 'unauthorized' (falta aceptar la huella RSA en el equipo) y que
# aparezca 'offline' (el equipo arrancó pero adbd todavía no responde).
Paso 2 "Buscando el equipo"
adb start-server 2>$null | Out-Null
# @() obliga a arreglo: con una sola linea, Where-Object devuelve una cadena
# y $lineas[0] daria su primer CARACTER en vez de la linea.
$lineas = @((adb devices) -split "`r?`n" | Where-Object { $_ -match "\S" -and $_ -notmatch "^List of devices" })

if (-not $lineas) {
  Write-Host "  No aparece ningun equipo." -ForegroundColor Red
  Write-Host "  Revisa, en este orden:"
  Write-Host "    - El cable: uno de solo carga no sirve, no lleva datos."
  Write-Host "    - En el equipo: Ajustes > Opciones de desarrollador > Depuracion por USB."
  Write-Host "    - En el equipo: al conectar, elegir modo 'Transferencia de archivos', no 'Solo carga'."
  exit 1
}

$estado = ($lineas[0] -split "\s+")[1]
Write-Host "  $($lineas[0])"

if ($estado -eq "unauthorized") {
  Write-Host "  El equipo NO autorizo a este PC." -ForegroundColor Yellow
  Write-Host "  Mira su pantalla: debe salir 'Permitir depuracion por USB'. Acepta y marca"
  Write-Host "  'Permitir siempre'. Si no sale, en Opciones de desarrollador toca"
  Write-Host "  'Revocar autorizaciones de depuracion USB', desconecta y vuelve a conectar."
  exit 1
}
if ($estado -ne "device") {
  Write-Host "  El equipo esta en estado '$estado', no listo." -ForegroundColor Yellow
  Write-Host "  Espera a que termine de arrancar y vuelve a correr esto."
  exit 1
}
Write-Host "  listo" -ForegroundColor Green

# --- 3. El APK --------------------------------------------------------
Paso 3 "Preparando el APK"
if (-not $Apk) {
  $Apk = Join-Path $PWD "puente.apk"
  Write-Host "  bajando la ultima compilacion..."
  # Se baja siempre: en la release quedaron APK viejos con el hash en el
  # nombre, y bajar el equivocado ya costo una tarde una vez.
  Invoke-WebRequest -Uri $urlApk -OutFile $Apk
}
if (-not (Test-Path $Apk)) {
  Write-Host "  no existe $Apk" -ForegroundColor Red
  exit 1
}
Write-Host "  $Apk ($([math]::Round((Get-Item $Apk).Length / 1MB, 1)) MB)" -ForegroundColor Green

$instalada = (adb shell dumpsys package $paquete 2>$null | Select-String -Pattern "versionName=" | Select-Object -First 1)
if ($instalada) {
  Write-Host "  ya instalada: $($instalada.ToString().Trim())"
} else {
  Write-Host "  no hay ninguna version instalada todavia"
}

# --- 4. Instalar, y resolver lo que salga -----------------------------
Paso 4 "Instalando"

if ($Desinstalar) {
  Write-Host "  desinstalando la anterior (pierde su configuracion)..." -ForegroundColor Yellow
  adb uninstall $paquete 2>$null | Out-Null
}

function Intentar($argumentos, $etiqueta) {
  Write-Host "  $etiqueta"
  $salida = (& adb @argumentos 2>&1) -join "`n"
  Write-Host "    $($salida.Trim())"
  return $salida
}

$salida = Intentar @("install", "-r", $Apk) "adb install -r"

# Cada rama de abajo es un fallo real con un remedio distinto. Se aplican
# solo los que no pierden datos; desinstalar se pide a mano con -Desinstalar.
if ($salida -match "INSTALL_FAILED_VERSION_DOWNGRADE|INSTALL_FAILED_UPDATE_INCOMPATIBLE.*downgrade") {
  Write-Host "  La instalada tiene un versionCode MAS ALTO que este APK." -ForegroundColor Yellow
  Write-Host "  Se reinstala permitiendo bajar de version (-d), que no pierde datos."
  $salida = Intentar @("install", "-r", "-d", $Apk) "adb install -r -d"
}

if ($salida -match "INSTALL_FAILED_VERIFICATION_FAILURE|INSTALL_FAILED_VERIFICATION_TIMEOUT") {
  Write-Host "  La verificacion de Play Protect esta bloqueando la instalacion." -ForegroundColor Yellow
  Write-Host "  Se desactiva SOLO para instalaciones por adb y se reintenta."
  adb shell settings put global verifier_verify_adb_installs 0 2>$null | Out-Null
  $salida = Intentar @("install", "-r", $Apk) "adb install -r (sin verificacion)"
}

if ($salida -match "INSTALL_FAILED_INSUFFICIENT_STORAGE") {
  Write-Host "  No hay espacio en el equipo." -ForegroundColor Red
  adb shell df /data 2>$null
  Write-Host "  Libera espacio en el equipo y vuelve a correr esto."
  exit 1
}

if ($salida -match "INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match") {
  Write-Host "  Hay una version instalada firmada con OTRA clave." -ForegroundColor Yellow
  Write-Host "  Android no deja reemplazarla sin borrarla. Corre:"
  Write-Host "    .\instalar-usb.ps1 -Desinstalar" -ForegroundColor White
  exit 1
}

if ($salida -notmatch "Success") {
  Write-Host "  La instalacion no termino bien. El mensaje de arriba es la causa." -ForegroundColor Red
  exit 1
}

# --- 5. Confirmar QUE quedo instalado ---------------------------------
# El paso que faltaba la vez que se perdio media hora: que "Success" no
# alcanza, hay que leer la version que quedo.
Paso 5 "Comprobando que quedo instalada"
$ahora = (adb shell dumpsys package $paquete 2>$null | Select-String -Pattern "versionName=" | Select-Object -First 1)
if ($ahora) {
  Write-Host "  $($ahora.ToString().Trim())" -ForegroundColor Green
  Write-Host "`nListo. Abre el puente en el equipo: su cabecera debe mostrar esa misma compilacion."
} else {
  Write-Host "  Instalo pero no se puede leer la version. Abre la app y mira su cabecera." -ForegroundColor Yellow
}
