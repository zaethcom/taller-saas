# Conectar por ADB al equipo del puente desde Windows, sin mirar el puerto en pantalla.
#
# La depuración inalámbrica de Android 11+ cambia el puerto de conexión cada vez que
# se reinicia el equipo. Leerlo a mano en Ajustes cada vez es la fricción que hace
# que nadie use ADB; aquí se descubre por mDNS, que es como adb lo anuncia en la red.
#
#   .\conectar-sion.ps1
#   .\conectar-sion.ps1 -Ip 192.168.20.89
#   .\conectar-sion.ps1 -Apk .\puente.apk
#
# Si no encuentra nada, ver "ADB en puerto fijo" en puente/README.md: en un equipo
# fijo conviene más dejar el 5555 abierto de una vez y olvidarse del mDNS.

param(
  [string]$Ip = "192.168.20.89",
  [string]$Apk = ""
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command adb -ErrorAction SilentlyContinue)) {
  Write-Error "No hay adb en el PATH. Descarga Android SDK Platform Tools y añade su carpeta al PATH."
  exit 1
}

Write-Host "Buscando el equipo en la red..."

$destino = $null

# 1) El puerto fijo, si ya está configurado: el camino sin sorpresas.
$fijo = & adb connect "${Ip}:5555" 2>$null
if ($fijo -match "^connected|already connected") {
  $destino = "${Ip}:5555"
  Write-Host "Conectado por el puerto fijo 5555."
}

# 2) mDNS: adb anuncia el puerto real de la depuración inalámbrica.
if (-not $destino) {
  $linea = & adb mdns services 2>$null |
    Where-Object { $_ -match "_adb-tls-connect\._tcp" -and $_ -match [regex]::Escape($Ip) } |
    Select-Object -First 1

  if ($linea) {
    $destino = ($linea -split "\s+")[-1]
    Write-Host "Encontrado en $destino"
    & adb connect $destino | Out-Host
  }
}

if (-not $destino) {
  Write-Host ""
  Write-Host "No se encontró el equipo." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "  - Depuración inalámbrica tiene que estar ENCENDIDA en Ajustes ->"
  Write-Host "    Opciones de desarrollador. No basta con las opciones de desarrollador."
  Write-Host "  - La primera vez hay que emparejar:"
  Write-Host "        adb pair ${Ip}:PUERTO_DE_EMPAREJAMIENTO"
  Write-Host "    Ese puerto NO es el de conexión: sale en 'Vincular dispositivo con"
  Write-Host "    código de vinculación', junto al código de 6 dígitos."
  Write-Host "  - Algunas redes bloquean mDNS. Lee el puerto en pantalla y usa:"
  Write-Host "        adb connect ${Ip}:PUERTO"
  Write-Host "  - Para no repetir esto nunca más, ver 'ADB en puerto fijo' en el README."
  exit 1
}

Write-Host ""
& adb devices -l | Out-Host

if ($Apk) {
  if (-not (Test-Path $Apk)) { Write-Error "No existe el archivo $Apk"; exit 1 }
  Write-Host ""
  Write-Host "Instalando $Apk..."
  & adb -s $destino install -r $Apk | Out-Host
  Write-Host "Abriendo la app..."
  & adb -s $destino shell am start -n com.zaethcom.puente/.MainActivity | Out-Host
}

Write-Host ""
Write-Host "Listo. Para ver los logs del puente:"
Write-Host "  adb -s $destino logcat -s PuenteTcp PuenteHttp"
