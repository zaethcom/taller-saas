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

## Si la impresora solo tiene USB (sin Ethernet/WiFi)

No hace falta escribir un cliente USB en Node. Ya existe una app
Android para esto: [smart-food-label](https://github.com/zaethcom/smart-food-label),
`PrintServer.kt` — corre en el dispositivo que tiene la impresora
conectada por USB de verdad, escucha por red en el puerto 9100, y
reenvía los bytes tal cual por USB (sin reinterpretar PPLB/ZPL/ESC-POS).

Para usarla: instala esa app en el dispositivo con la impresora,
ábrela para que el `PrintServer` arranque, y en `config.json` de esta
estación pon `"protocolo": "puente_android"` en esa impresora:

```json
"tickets": { "host": "192.168.20.191", "puerto": 9100, "protocolo": "puente_android" }
```

Importante: ese protocolo **no es** el mismo que `"crudo"` (raw/JetDirect)
aunque los dos usen por convención el puerto 9100 — el puente antepone
4 bytes de longitud al payload y espera una confirmación `OK`/`ERR:...`.
Ponerle `"crudo"` a una impresora que en realidad está detrás del
puente (o viceversa) rompe la impresión de forma silenciosa. Un
`PrintServer` solo reenvía a **una** impresora (la que esa app tenga
marcada como predeterminada) — si tickets y etiquetas están las dos
por USB en el mismo dispositivo, hoy hace falta una segunda instancia
en otro puerto, o resolver la impresora predeterminada distinto según
qué app la abra.

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
