# Instalar la estación de impresión en una sede

La estación es un programa aparte que corre en un Android (o un PC) fijo
y siempre encendido en cada local. No se despliega en Vercel — vive en
la máquina física de la sede.

## Qué necesita el aparato

- Node.js 18 o superior (en Android: Termux).
- Estar en la misma red que las impresoras (o que ellas tengan IP fija
  alcanzable).
- Las dos impresoras configuradas con **IP fija** — sin eso, la estación
  pierde la impresora cada vez que el router reparte otra IP por DHCP.

## Pasos

1. Clonar el repositorio o copiar solo la carpeta `estacion/`.
2. `cd estacion && npm install`
3. Copiar `config.ejemplo.json` a `config.json` y completar:
   - `sedeId`: el UUID de la sede en la tabla `sede` (Local 1 o Local 2).
   - `apiBase`: la URL de la aplicación desplegada en Vercel.
   - `servicioClave`: la clave de servicio de esta estación (se genera
     desde el panel de administración — ver sección "Rutas API" del
     código, `app/api/impresion/`).
   - `impresoras.tickets.host` / `impresoras.etiquetas.host`: las IPs
     fijas de cada impresora en la red del local.
4. Probar en primer plano: `npm start` — debe quedar imprimiendo sin
   errores en la consola. Encolar una etiqueta de prueba desde la app y
   confirmar que sale.
5. Dejarlo corriendo siempre:
   - **Termux (Android):** instalar `Termux:Boot` desde F-Droid y poner
     `npm start` en `~/.termux/boot/estacion.sh`. Desactivar la
     optimización de batería de Termux en los ajustes de Android —
     si no, el sistema mata el proceso al rato de apagar la pantalla.
   - **PC (systemd en Linux):** crear un servicio que ejecute
     `node --import tsx index.ts` con `Restart=always`.

## Cómo saber si está viva

`GET /api/impresion/pendientes?sede=<id>` con la clave de esa sede
responde `200` aunque no haya trabajos — un `401` significa clave mal
puesta, y ningún error de red en la consola de la estación es la señal
de que sigue consultando cada dos segundos.

## Un aviso de la sección de trampas del plano

Esta pantalla (o el teléfono que la corre) **no es la tablet del POS**.
Es un aparato aparte, barato, enchufado permanentemente. Si la impresión
dependiera de la tablet del cajero, se muere cada vez que alguien se la
lleva, la deja sin batería o la bloquea.
