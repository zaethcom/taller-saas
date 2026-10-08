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
3. En la web, **Administrador → Sedes**, en la sede de este local:
   - Configurar las impresoras (IP, puerto y si es «Red por IP» o
     «Local por USB»). La estación las lee de ahí al arrancar y vuelve a
     mirarlas cada minuto, así que un cambio de IP no exige ir al local.
   - **Vincular estación de impresión → Generar clave → Descargar
     config.json.** Ese archivo ya trae `sedeId`, `apiBase` (la URL desde
     la que lo descargaste) y `servicioClave`. Ponlo en la carpeta
     `estacion/` del aparato.

   La clave aparece **una sola vez**: `estacion_credencial` guarda solo su
   sha256, así que no hay forma de volver a verla. Si se pierde, se
   genera otra — y la anterior deja de aceptarse, con lo que el equipo que
   la tenga puesta deja de imprimir hasta que le pongas el config.json
   nuevo.

   Si prefieres armarlo a mano, `config.ejemplo.json` muestra los campos;
   `impresoras` ahí es solo un respaldo para cuando la web no responde al
   arrancar.

   `config.json` lleva esa clave **en claro**, así que está en
   `.gitignore`. Si copiaste solo la carpeta `estacion/` a otro sitio
   versionado, excluirlo también ahí — o dejar el archivo fuera del
   repositorio y pasarle la ruta: `npm start -- /ruta/a/config.json`
   (`index.ts` lee el primer argumento, y si no hay usa `./config.json`).
4. Probar en primer plano: `npm start` — debe quedar imprimiendo sin
   errores en la consola. En /sedes la sede debe pasar a **En línea** en
   menos de un minuto. Encolar una etiqueta de prueba desde la app y
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

En **/sedes**, debajo de las impresoras de cada sede:

- **En línea**: consultó la cola hace menos de dos minutos.
- **Sin conexión desde …**: el aparato está apagado, sin red, o el
  proceso murió (en Android, casi siempre la optimización de batería).
- **Vinculada, todavía no se ha conectado**: se generó la clave pero el
  config.json nuevo no está puesto, o la estación no se reinició.
- **Sin vincular**: nadie generó clave para esta sede; nada de lo que se
  encole va a imprimirse.

Al lado dice cuántas impresiones están esperando. Si la consola de la
estación muestra un 401, la clave no es la vigente: descarga un
config.json nuevo.

## Un aviso de la sección de trampas del plano

Esta pantalla (o el teléfono que la corre) **no es la tablet del POS**.
Es un aparato aparte, barato, enchufado permanentemente. Si la impresión
dependiera de la tablet del cajero, se muere cada vez que alguien se la
lleva, la deja sin batería o la bloquea.
