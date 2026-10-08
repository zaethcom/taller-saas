# Puente Android sin PC: lo que tiene que hacer la app

Con esto, una sede nueva se vincula sin computador ni Node: el admin abre
Sedes → «Estación de impresión» → «Código para la app Android», y escribe
ese código en la app del puente. La app guarda la clave y desde ahí pide
los trabajos directo a la web.

## 1. Vincular (una vez)

```
POST {apiBase}/api/estacion/vincular
Content-Type: application/json
{ "codigo": "ABCD-EFGH", "nombre": "Android del mostrador" }
```

Respuesta `200`: `{ "clave": "...", "sedeId": "...", "sedeNombre": "Local 1" }`.
Guardar `sedeId` y `clave` en el dispositivo; no mostrar la clave.
El código vence en 15 minutos y sirve una vez. Vincular deja sin efecto la
clave anterior de esa sede (la de un PC, si había).

## 2. Pedir trabajos (cada 2 s)

```
GET {apiBase}/api/impresion/pendientes?sede={sedeId}&formato=bytes
Authorization: Bearer {clave}
```

Respuesta: lista de hasta 5 trabajos:

```json
[{ "id": "...", "tipo": "recibo_venta", "destino": "tickets", "bytes": "<base64>" },
 { "id": "...", "tipo": "etiqueta_qr", "error": "no se pudo preparar la impresión" }]
```

- `destino` es `tickets` o `etiquetas`: mandar los bytes decodificados tal
  cual por USB a esa impresora. La web ya los tradujo a ESC/POS, PPLB o ZPL
  según lo elegido en Configurar impresoras; la app no interpreta nada.
- `401`: la clave ya no sirve (se generó otra). Mostrar «Vincular de nuevo».

## 3. Reportar cada trabajo

```
POST {apiBase}/api/impresion/{id}/resultado
Authorization: Bearer {clave}
{ "ok": true }            // o { "ok": false, "error": "mensaje" }
```

Un trabajo que llega con `error` se reporta con `ok: false` y ese mensaje.

Cada consulta deja la sede «En línea» en /sedes. `apiBase` es
`https://taller-saas-mvp.vercel.app`.
