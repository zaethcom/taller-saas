# Puente de impresión

App Android que corre en el equipo que tiene las impresoras conectadas por USB.
Escucha por red, recibe bytes ya renderizados y los reenvía tal cual al puerto USB
que corresponda. No interpreta el protocolo: quien generó el trabajo ya decidió si
era ESC/POS, ZPL o PPLB.

Nace de un límite concreto de [smart-food-label](https://github.com/zaethcom/smart-food-label),
cuyo `PrintServer.kt` hace justo esto pero contra **una sola** impresora — la
predeterminada del dispositivo (`printerRepository.getDefault()`). Con la Epson de
recibos y la etiquetadora en el mismo equipo, eso no alcanza.

## Por qué un puerto por rol

La forma obvia sería meterle un campo de rol al protocolo. No se hizo, a propósito.

El protocolo ya existe y hay un cliente hablándolo en producción
(`DestinoPuenteAndroid`, en `estacion/destino.ts`): cuatro bytes de longitud en
big-endian, el payload, y una línea de respuesta `OK` o `ERR:<motivo>`. Cambiarlo
obligaría a versionarlo y a desplegar cliente y servidor a la vez, en dos equipos
distintos de un local que está atendiendo.

Un segundo puerto no cambia nada para quien ya apuntaba al 9100, y del lado de la
estación es editar un número: `config.json` ya tiene `puerto` por impresora.

| Rol | Puerto | Qué imprime |
|---|---|---|
| Tickets | 9100 | Recibos de venta, comprobantes, cierre de caja, apertura de cajón |
| Etiquetas | 9101 | Etiquetas de artículo y de orden |

Los puertos se pueden cambiar en la app. El servidor HTTP es la excepción: ahí el
rol sí viaja en el JSON, porque no cuesta nada y evita exponer dos puertos hacia
afuera.

## Instalar

El APK se compila solo en GitHub Actions (`.github/workflows/puente-apk.yml`) cada
vez que cambia algo de `puente/`. Se descarga desde la pestaña **Actions** del
repositorio, en los artefactos de la ejecución — no hace falta Android Studio en el
equipo de la sede.

1. Instalar el APK y abrirlo.
2. Conectar las dos impresoras por USB. Si tienen fuente propia, mejor: un hub sin
   alimentación no siempre las sostiene.
3. Para cada rol, **Elegir impresora** y aceptar el permiso USB que pide Android.
4. Anotar la dirección que muestra la app arriba: esa es la que va en el
   `config.json` de la estación.
5. **Probar** en cada rol. Debe salir papel.

La app arranca un servicio en primer plano con notificación permanente. Es lo que
impide que Android mate el proceso cuando la pantalla lleva rato apagada —
smart-food-label deja esto explícitamente pendiente y por eso depende de que nadie
cierre la app.

## Configurar la estación contra este puente

En `estacion/config.json`, las dos impresoras apuntan al mismo equipo y difieren en
el puerto:

```json
"impresoras": {
  "tickets":   { "host": "192.168.20.89", "puerto": 9100, "protocolo": "puente_android" },
  "etiquetas": { "host": "192.168.20.89", "puerto": 9101, "protocolo": "puente_android" }
}
```

Si la estación corre en el mismo equipo que las impresoras, `127.0.0.1` en vez de la
IP: se ahorra la vuelta por la red y deja de depender de que el equipo conserve su
dirección.

## Conectarse por ADB al equipo

Para instalar sin tocar el aparato, o para leer los logs en vivo, hace falta ADB.
Hay dos formas, y la primera es mejor para un equipo fijo.

### ADB en puerto fijo (recomendado)

La depuración inalámbrica de Android 11+ cambia el puerto de conexión en cada
reinicio, y obliga a emparejar con un código. Para un equipo de mostrador que no
se mueve, eso es fricción sin beneficio: el ADB clásico usa siempre el 5555 y no
pide emparejamiento.

En el equipo, con permisos de superusuario:

```sh
setprop service.adb.tcp.port 5555
stop adbd
start adbd
```

Desde entonces, y desde cualquier máquina de la red:

```sh
adb connect 192.168.20.89:5555
```

Eso no sobrevive a un reinicio salvo que el build honre `persist.adb.tcp.port`
-- se prueba poniendo ese en vez del otro. Si no lo honra, queda repetir las tres
líneas tras cada arranque, o dejarlas en el script de inicio del equipo.

**Esto abre el ADB a toda la red local sin autenticación.** En la red de un local
cerrado es aceptable; en una red compartida con clientes, no.

### Depuración inalámbrica, descubriendo el puerto solo

Si se prefiere no tocar propiedades del sistema, `herramientas/conectar-sion.sh`
(o `.ps1` en Windows) descubre el puerto por mDNS en vez de obligar a leerlo en
la pantalla:

```sh
./herramientas/conectar-sion.sh                      # descubre y conecta
./herramientas/conectar-sion.sh --instalar app.apk   # además instala y abre
```

La primera vez sigue haciendo falta emparejar a mano, una sola vez por
computador: `adb pair <ip>:<puerto de emparejamiento>` con el código de seis
dígitos. Ese puerto **no** es el de conexión -- son dos números distintos en dos
pantallas distintas, y es donde se atasca todo el mundo.

## Los dos protocolos

**TCP (por rol, un puerto cada uno).** Cuatro bytes de longitud big-endian, luego el
payload. Respuesta: una línea, `OK` o `ERR:<motivo>`. El motivo viaja tal cual hasta
la consola de la estación, así que está escrito para que se entienda ahí.

**HTTP (opcional, un solo puerto).** Solo si hace falta imprimir desde fuera de la
red local:

```
POST /imprimir
X-Puente-Secreto: <el secreto configurado en la app>
{"rol": "tickets", "payload_base64": "<bytes ya renderizados>"}
```

Falla cerrado: sin secreto configurado no abre el puerto. Un servidor de impresión
abierto en la red de un local es, en el mejor caso, papel que cualquiera gasta; en el
peor, un cajón monedero que cualquiera abre.

## Cómo se verifica sin impresoras

El protocolo TCP tiene que seguir siendo byte a byte el que `estacion/destino.ts` ya
manda, y esa es la parte que más caro sale romper. Por eso los servidores dependen de
la interfaz [`Impresor`] y no de la implementación que toca el USB: con eso el
protocolo se prueba en la JVM, con sockets reales, sin emulador ni hardware.

`./gradlew testDebugUnitTest` cubre, entre otras cosas: que el payload llegue intacto
byte a byte, que un payload de 300 KB no se corte, que una cabecera que declara 500 MB
se rechace sin intentar reservarlos, que un `nc -z` no tumbe el servidor, que cada rol
salga por su puerto, que un puerto ocupado se reporte al arrancar y no en silencio, y
que el servidor HTTP no imprima nada sin el secreto correcto.

Lo que esto **no** cubre: que el USB abra la impresora de verdad, que Android conceda
el permiso, y que el servicio sobreviva la pantalla apagada. Eso solo lo dice el equipo
de la sede con las impresoras conectadas.

## Qué NO hace

- **No renderiza.** No sabe de plantillas, ni de anchos de etiqueta, ni de dpi. Eso
  vive en quien genera el trabajo (`estacion/plantillas/` para los recibos).
- **No reintenta.** Un fallo se devuelve al cliente y él decide. La cola de
  `taller-saas` ya reintenta cinco veces antes de marcar un trabajo como perdido.
- **No descubre impresoras solo.** La asignación de rol a dispositivo USB es manual y
  se guarda por VID/PID, así que sobrevive a desenchufar y volver a conectar.
