# Levanta la estación de impresión de una sede contra el puente en Sion.
#
# Hace, en orden: conecta el ADB, actualiza el repositorio, instala el APK
# del puente, escribe el config.json y arranca la estación. Todo lo que
# hasta ahora había que hacer a mano en cinco pasos distintos.
#
#   .\estacion\herramientas\arrancar-estacion.ps1
#
# La clave del servicio se pide por pantalla y se escribe solo en
# estacion/config.json, que está en .gitignore. No se pasa por argumento
# para que no quede en el historial de PowerShell.

param(
  [string]$Ip = "192.168.20.89",
  [string]$PuertoAdb = "46727",
  [string]$SedeId = "293be221-9886-42a8-ba20-cbbec74d135a",
  [string]$ApiBase = "https://taller-saas-mvp.vercel.app"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

function Paso($n, $texto) { Write-Host "`n[$n] $texto" -ForegroundColor Cyan }

# --- 1. Herramientas -------------------------------------------------
Paso 1 "Comprobando herramientas"
foreach ($cmd in @("adb", "node", "npm", "git")) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Write-Host "  falta '$cmd' en el PATH" -ForegroundColor Red
    exit 1
  }
  Write-Host "  $cmd OK"
}

# --- 2. ADB ----------------------------------------------------------
# El puerto de la depuración inalámbrica cambia en cada reinicio de
# Android. Si el que trae el script ya no vale, se prueba el 5555 fijo.
Paso 2 "Conectando con el equipo del puente"
adb connect "${Ip}:${PuertoAdb}" | Write-Host
$dispositivos = (adb devices) -join "`n"
if ($dispositivos -notmatch [regex]::Escape($Ip)) {
  Write-Host "  no respondió en el $PuertoAdb, probando el 5555" -ForegroundColor Yellow
  adb connect "${Ip}:5555" | Write-Host
  $dispositivos = (adb devices) -join "`n"
}
if ($dispositivos -notmatch [regex]::Escape($Ip)) {
  Write-Host "  sin conexión ADB. Mira el puerto en Sion:" -ForegroundColor Red
  Write-Host "  Opciones de desarrollador -> Depuracion inalambrica" -ForegroundColor Red
  Write-Host "  y vuelve a lanzar con:  -PuertoAdb <el que salga>" -ForegroundColor Red
  exit 1
}
Write-Host "  conectado" -ForegroundColor Green

# --- 3. Instalar el APK ---------------------------------------------
# -r reinstala encima. Sin eso, un APK con el mismo applicationId falla
# con "ya existe" y se queda corriendo la versión vieja -- que es
# exactamente lo que pasó en la sede la primera vez.
Paso 3 "Instalando el puente"
$apk = Join-Path $HOME "Downloads\puente.apk"
if (Test-Path $apk) {
  adb install -r $apk | Write-Host
  adb shell am start -n com.zaethcom.puente/.MainActivity | Write-Host
  Write-Host "  comprueba en la pantalla de Sion que la cabecera diga la compilacion nueva" -ForegroundColor Yellow
} else {
  Write-Host "  no esta $apk -- se salta la instalacion" -ForegroundColor Yellow
  Write-Host "  bajalo de: https://github.com/zaethcom/taller-saas/releases/download/puente-dev/puente.apk"
}

# --- 4. Configuración ------------------------------------------------
# host es la IP de Sion, no 127.0.0.1: la estación corre en este PC y el
# puente está en el otro equipo. Las dos impresoras están conectadas al
# mismo Sion, así que comparten IP y se distinguen por el puerto: el
# puente atiende tickets en el 9100 y etiquetas en el 9101.
Paso 4 "Escribiendo la configuracion"
$rutaConfig = Join-Path $repo "estacion\config.json"
if (Test-Path $rutaConfig) {
  Write-Host "  ya existe $rutaConfig -- se conserva" -ForegroundColor Yellow
} else {
  $clave = Read-Host "  Pega la servicioClave de esta sede"
  if ([string]::IsNullOrWhiteSpace($clave)) {
    Write-Host "  sin clave no hay nada que hacer" -ForegroundColor Red
    exit 1
  }
  $cfg = @"
{
  "sedeId": "$SedeId",
  "apiBase": "$ApiBase",
  "servicioClave": "$clave",
  "intervaloMs": 2000,
  "impresoras": {
    "tickets": { "host": "$Ip", "puerto": 9100, "protocolo": "puente_android" },
    "etiquetas": { "host": "$Ip", "puerto": 9101, "protocolo": "puente_android" }
  }
}
"@
  Set-Content -Path $rutaConfig -Value $cfg -Encoding UTF8
  Write-Host "  escrito $rutaConfig" -ForegroundColor Green
}

# --- 5. Arrancar -----------------------------------------------------
Paso 5 "Arrancando la estacion (Ctrl+C para parar)"
Set-Location (Join-Path $repo "estacion")
npm install --silent
npx tsx index.ts .\config.json
