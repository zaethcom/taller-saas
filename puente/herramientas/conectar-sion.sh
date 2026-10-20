#!/usr/bin/env bash
# Conectar por ADB al equipo del puente, sin tener que mirar el puerto en pantalla.
#
# La depuración inalámbrica de Android 11+ cambia el puerto de conexión cada vez
# que se reinicia el equipo o se apaga y enciende la opción. Leerlo a mano en
# Ajustes cada vez es la fricción que hace que nadie use ADB. Este script lo
# descubre solo por mDNS, que es como el propio adb lo anuncia en la red.
#
#   ./conectar-sion.sh                    # descubre y conecta
#   ./conectar-sion.sh 192.168.20.89      # a una IP concreta
#   ./conectar-sion.sh --instalar app.apk # conecta e instala
#
# Si esto no encuentra nada, ver "ADB en puerto fijo" en puente/README.md: en un
# equipo fijo conviene más dejar el 5555 abierto de una vez y olvidarse del mDNS.
set -euo pipefail

IP="192.168.20.89"
APK=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --instalar)
      APK="${2:-}"
      [[ -n "$APK" ]] || { echo "--instalar necesita la ruta del APK" >&2; exit 1; }
      shift 2
      ;;
    *)
      IP="$1"
      shift
      ;;
  esac
done

command -v adb >/dev/null || { echo "No hay adb en el PATH. Instala Android SDK Platform Tools." >&2; exit 1; }

echo "Buscando el equipo en la red…"

# 1) El puerto fijo, si alguien ya lo dejó configurado: es el camino sin sorpresas.
if adb connect "$IP:5555" 2>/dev/null | grep -qE "^connected|already connected"; then
  DESTINO="$IP:5555"
  echo "Conectado por el puerto fijo 5555."
else
  # 2) mDNS: adb anuncia el puerto real de la depuración inalámbrica.
  DESTINO="$(adb mdns services 2>/dev/null \
    | grep "_adb-tls-connect._tcp" \
    | grep -F "$IP" \
    | awk '{print $NF}' \
    | head -1 || true)"

  if [[ -z "$DESTINO" ]]; then
    cat >&2 <<AYUDA

No se encontró el equipo.

  - ¿Está encendida la Depuración inalámbrica en Ajustes → Opciones de
    desarrollador? Tiene que estar activa, no solo las opciones de desarrollador.
  - ¿Ya emparejaste este computador alguna vez? La primera vez hace falta:
        adb pair $IP:PUERTO_DE_EMPAREJAMIENTO
    El puerto de emparejamiento NO es el mismo que el de conexión: sale en
    "Vincular dispositivo con código de vinculación", junto al código de 6 dígitos.
  - Algunas redes bloquean mDNS. Si es el caso, lee el puerto en la pantalla de
    Depuración inalámbrica y conéctate a mano:
        adb connect $IP:PUERTO
  - Para dejar de pelear con esto en un equipo fijo, ver "ADB en puerto fijo"
    en puente/README.md.

AYUDA
    exit 1
  fi

  echo "Encontrado en $DESTINO"
  adb connect "$DESTINO"
fi

echo
adb devices -l

if [[ -n "$APK" ]]; then
  [[ -f "$APK" ]] || { echo "No existe el archivo $APK" >&2; exit 1; }
  echo
  echo "Instalando $APK…"
  adb -s "$DESTINO" install -r "$APK"
  echo "Abriendo la app…"
  adb -s "$DESTINO" shell am start -n com.zaethcom.puente/.MainActivity
fi

echo
echo "Listo. Para ver los logs del puente:"
echo "  adb -s $DESTINO logcat -s PuenteTcp PuenteHttp"
