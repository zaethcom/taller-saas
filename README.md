# Taller SaaS

POS y servicio técnico trazable por QR, para talleres con dos sedes.
Una sola aplicación web con tres puertas — POS, la app del técnico, y el
portal del cliente — más un servidor de impresión que corre en el
Android fijo de cada sede.

Este repositorio nace de un plano de construcción de trece semanas.
Este README cubre cómo levantar lo que ya existe; el plano completo
(arquitectura, modelo de negocio, fases) vive en las conversaciones que
lo originaron y en los comentarios de cabecera de cada archivo.

## Por qué es una web y no una app nativa

Cajero y taller trabajan desde tablets o celulares Android (y el
cajero, si prefiere, desde un PC con Windows). Esta app funciona en
los tres por ser web -- un solo código sirve a cualquier navegador, en
vez de mantener una app de Android y otra de Windows por separado.

En Android/Chrome se puede **instalar** desde el navegador (menú →
"Agregar a pantalla de inicio" o el aviso que Chrome ofrece solo):
queda con su propio ícono y abre en pantalla completa, sin la barra
del navegador -- se siente como una app nativa aunque no lo sea. Eso
lo habilita `public/manifest.json` + `metadata.manifest` en
`app/layout.tsx`.

Lo único que **no** es una página web es el servidor de impresión
(`estacion/`) -- ver más abajo -- porque un navegador no puede
hablarle a una impresora USB ni abrir un cajón monedero. Es el único
programa del proyecto que se instala aparte, en el Android o PC fijo
de cada sede.

## Las dos promesas del proyecto

1. **El técnico escanea el QR de un equipo y ve su historial completo.**
   `app/(taller)/escanear` → `app/(taller)/orden/[id]`.
2. **El cliente entra a un enlace y sabe en qué va su equipo**, sin
   cuenta y sin ver nada interno.
   `app/(publico)/seguimiento/[token]`.

Todo lo demás — POS, inventario, impresión — existe para sostener esas
dos cosas.

## Estructura

```
app/
├─ (pos)/        # caja: vender, recibir, entregar, turno
├─ (taller)/     # la PWA del técnico: escanear, orden/[id]
├─ (admin)/      # escritorio: ordenes, inventario, categorias, traslados, compras,
│                 #   usuarios, metodos-pago, reportes, recepcion-mercancia
├─ (publico)/    # seguimiento/[token] -- sin sesión
├─ superadmin/   # NO es grupo de rutas -- la plataforma, no una empresa más
└─ api/          # rutas de servidor que las páginas y la estación consumen

lib/
├─ estados.ts        # la máquina de estados de la orden -- fuente única
├─ permisos.ts        # qué rol puede qué
├─ impresion.ts        # encolar trabajos -- la web nunca habla de bytes
├─ caja.ts            # cálculos de turno y saldo
├─ estacion-auth.ts    # autenticación de las estaciones de impresión
├─ dian/               # interfaz de facturación, con proveedor real pendiente
├─ mensajeria/         # avisar al cliente -- correo real, WhatsApp pendiente
└─ supabase/           # clientes de navegador y de servidor

estacion/       # el servidor de impresión -- NO se despliega en Vercel
supabase/
├─ migrations/  # el esquema completo
└─ seed.sql     # datos de prueba: dos empresas, para probar el aislamiento

pruebas/        # estados.ts y caja.ts
estacion/*.test.ts  # escpos.ts y etiqueta.ts, bytes exactos
```

Los paréntesis en las carpetas de `app/` son grupos de rutas de
Next.js: organizan el código pero **no aparecen en la URL**. Por eso
`app/(pos)/vender/page.tsx` sirve en `/vender`, no en `/pos/vender`.

## Arrancar en local

Requiere Node 20+ y una cuenta de [Supabase](https://supabase.com)
(la capa gratuita alcanza para todo el desarrollo).

```bash
npm install
cp .env.example .env.local   # completar con las claves de tu proyecto Supabase
```

### Base de datos

Con el [CLI de Supabase](https://supabase.com/docs/guides/cli) instalado:

```bash
supabase init            # si el proyecto no está vinculado todavía
supabase db push          # aplica supabase/migrations/*.sql en orden
psql "$DATABASE_URL" -f supabase/seed.sql   # datos de prueba
```

Las migraciones son el orden de verdad del esquema — no editar tablas
desde el panel de Supabase sin escribir la migración correspondiente.

### La aplicación

```bash
npm run dev      # http://localhost:3000
npm test         # 50 pruebas: estados.ts, caja.ts, escpos.ts, etiqueta.ts
npm run build    # build de producción -- correr esto antes de cada push
```

### La estación de impresión

No se instala junto con la app. Ver [`estacion/instalar.md`](estacion/instalar.md)
para el despliegue en el Android (o PC) fijo de cada sede.

```bash
cd estacion
npm install
cp config.ejemplo.json config.json   # completar sedeId, apiBase, credencial, IPs
npm start
```

## Variables de entorno

| Variable | Dónde se usa | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador y servidor | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador y servidor | respeta RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | solo servidor | se salta RLS -- nunca exponer al navegador |
| `RESEND_API_KEY`, `RESEND_FROM` | solo servidor | correo al recibir un equipo (`lib/mensajeria/correo.ts`) |
| `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_PHONE_ID_SECUNDARIO` | solo servidor | pendientes -- ver más abajo |

## Decisiones que ya están tomadas (y por qué)

- **Next.js + Supabase, no ERPNext.** El POS y el servicio técnico son
  el 85% del valor y no existen en ninguna plataforma; construirlos a
  medida cuesta menos que adaptar una plataforma ajena a un dominio
  que ella no modela. Ver el hilo de decisión completo en los
  comentarios de cabecera de `lib/dian/proveedor.ts`.
- **Aislamiento entre empresas en Postgres (RLS), no en el código.**
  `supabase/migrations/0002_rls.sql`. Es la diferencia entre "confiamos
  en que el programador filtró bien" y "la base no devuelve el dato
  aunque el código se equivoque".
- **La estación de impresión es un programa aparte, no parte de la
  web.** Un navegador no puede hablarle a una impresora USB ni abrir
  un cajón. Ver `estacion/README` (más abajo) y `lib/impresion.ts`.
- **La máquina de estados vive en un solo archivo.** `lib/estados.ts`.
  Ninguna pantalla ni ninguna ruta debe escribir `estado = 'x'` por su
  cuenta — todo pasa por `transicionar()`.
- **Caja e inventario ya son por sede desde el primer día**
  (`turno_caja.sede_id`, `venta.sede_id`, `existencia.sede_id`, en
  `0004_caja.sql`), no algo que haya que "agregar" para tener aperturas,
  cierres y existencias independientes en la tienda y en el taller. Lo
  que sí faltaba -- y ya existe -- es cómo la mercancía pasa de una sede
  a la otra: **`traslado`/`traslado_item`** (`0014_traslados.sql`) es el
  papel de esa cadena de custodia. Enviar descuenta el inventario de
  origen de inmediato (`consumir_repuesto`, la misma función que usa una
  venta de mostrador); recibir es un paso aparte y deliberado
  (`sumar_existencia`) para que el destino nunca sume algo que todavía
  no tiene en la mano. Página real: `app/(admin)/traslados`. Cada
  traslado también imprime su propio comprobante
  (`comprobante_traslado`) que viaja físicamente con la mercancía.
  Con esto, el taller (sede tipo `'taller'`) puede vender productos de
  mostrador de verdad y no solo cobrar servicios -- antes tenía POS
  (`vender` ya no distingue por tipo de sede) pero cero existencia
  propia si nadie le trasladaba nada desde el almacén.
- **Mercancía individualizada (patinetas, teléfonos) es una tabla
  aparte de `repuesto`.** `repuesto`/`existencia` solo llevan cantidad
  -- sirven para tornillos y pastillas de freno, no para algo que hay
  que poder rastrear como unidad única. `articulo` (`0016_articulos_inventario.sql`)
  es esa unidad: nace en `app/(admin)/recepcion-mercancia`, que
  registra un artículo y encola su etiqueta **en el mismo paso** --
  no hay un botón "imprimir" aparte que alguien pueda saltarse. El
  formulario se limpia y el foco vuelve solo al primer campo para el
  siguiente artículo de la caja, y una lista de "esta sesión" queda
  visible para poder contar contra la caja física. El QR de la
  etiqueta codifica el código del artículo (`ART-000123`), no una URL
  -- todavía no hay una pantalla pública de seguimiento para
  inventario, a diferencia de la orden de reparación.
- **Un artículo individualizado se puede vender o trasladar como
  unidad, no solo como cantidad.** `venta_item` y `traslado_item`
  (`0018_articulos_en_venta_y_traslado.sql`) referencian `repuesto_id`
  O `articulo_id`, nunca los dos (`check` que lo exige, no una
  convención de la aplicación). Vender un artículo (`/vender`) lo pasa
  de `en_stock` a `vendido` -- validado ANTES de crear la venta, porque
  vender dos veces la misma unidad física es un error real, distinto a
  un descuadre de cantidad que se corrige después. Trasladarlo
  (`/traslados`) lo pasa a `trasladado` al enviar y de vuelta a
  `en_stock` -- ya en la sede destino -- al confirmar la recepción.
  Con esto, `articulo.estado` cuenta la historia completa de una unidad:
  `en_stock` (recepción) → `trasladado` (en tránsito, opcional) →
  `en_stock` en otra sede → `vendido`.
- **Superadministrador de la plataforma** (`0020_superadmin.sql`,
  `app/superadmin/`): quien crea y suspende empresas desde fuera del
  aislamiento normal. Deliberadamente NO es una fila de `perfil` con un
  rol nuevo -- `perfil` modela "empleado de una empresa" y su RLS exige
  `empresa_actual()`; forzar ahí a alguien que no pertenece a ninguna
  empresa habría significado mentir sobre a cuál pertenece, o aflojar
  la tabla de la que depende el aislamiento de todo el negocio. Es una
  tabla aparte (`superadmin`), con una sola política -- ver la propia
  fila -- y ninguna de escritura: no existe un POST que cree un
  superadmin nuevo, eso es SQL directo o `clienteAdmin()` desde fuera
  de la aplicación, a propósito. `app/superadmin/` es una carpeta real,
  no un grupo de rutas -- queda en `/superadmin`, no escondida como las
  otras tres puertas, porque esto no es una empresa más.

  Crear una empresa (`POST /api/superadmin/empresas`) arma en un solo
  paso la empresa, su primera sede, y su primer usuario admin vía la
  Auth Admin API -- si algo falla a medio camino, se revierte lo ya
  insertado. Suspenderla (`PATCH .../[id]`) es lo más fuerte que tiene
  este sistema: `empresa.activa` ahora es parte de `empresa_actual()`,
  la función de la que depende CADA política RLS de CADA tabla del
  negocio -- una empresa suspendida deja de ver absolutamente nada, en
  toda la aplicación, sin que ninguna pantalla tenga que acordarse de
  revisarlo. `lib/perfil.ts` ni siquiera necesitó un chequeo aparte
  para esto: la fila de un usuario de una empresa suspendida deja de
  ser visible por RLS, sola.
- **Personalización visual por empresa** (`0021_empresa_config.sql`,
  `/configuracion`): logo, color de marca, tema (claro/oscuro/alto
  contraste), y los datos que aparecen en cada recibo impreso
  (dirección, teléfono, mensaje al pie). No se pre-llena una fila por
  empresa -- `GET /api/configuracion` devuelve valores por defecto
  hasta que un admin guarda algo por primera vez, momento en el que
  nace la fila (upsert).

  El logo vive en un bucket de Storage **público** (`logos`), a
  diferencia de `evidencia` -- se muestra en `/login` antes de que
  exista sesión, así que no puede depender de RLS para leerse. El
  color se aplica como variable CSS (`--accent`) puesta inline en
  `<html>` desde el layout raíz (que ahora es async: consulta perfil +
  configuración en cada request); el tema alterna un pequeño grupo de
  variables (`--ink`, `--ground`, `--surface`, `--rule`) vía
  `[data-tema]` en `globals.css`. Esto cambia el fondo/texto/bordes
  por defecto de toda la aplicación, pero **no** repinta cada color
  fijo que ya existía en el estilo en línea de una pantalla puntual
  (un rojo de error, por ejemplo) -- eso es un rediseño pantalla por
  pantalla, no una personalización, y queda fuera de este alcance a
  propósito. La puerta del taller sigue siempre oscura sin importar el
  tema elegido (visibilidad y batería en un celular usado con una
  mano, sí toma la marca de la empresa).

  Los recibos impresos (venta, recepción, cierre de caja, traslado)
  reciben el nombre/dirección/teléfono/pie de la empresa automáticamente
  -- `encolarImpresion()` (`lib/impresion.ts`) los agrega él solo para
  esos cuatro tipos, sin que cada ruta que encola un trabajo tenga que
  pedirlos. Las etiquetas pequeñas (`etiqueta_qr`, `etiqueta_articulo`)
  no llevan esto -- no hay espacio.
- **Menú lateral como estructura estándar de la plataforma**
  (`componentes/ui/barra-lateral.tsx`): la barra superior con enlaces
  en línea de `(pos)`, `(taller)` y `(admin)` se reemplazó por un menú
  lateral fijo, igual para cualquier empresa -- lo que cambia por
  empresa sigue siendo su logo y su color (`lib/configuracion.ts`), ya
  no su estructura de navegación. Cada puerta arma su propia lista de
  enlaces con ícono (`lucide-react`) según lo que ya podía hacer antes
  -- no se agregó ninguna página nueva, solo se reorganizó dónde vive
  la navegación. La cabecera de la barra (logo + nombre de empresa +
  qué puerta es) reemplaza al componente `Marca`, que quedó sin uso y
  se eliminó. Bajo ~640px de ancho la barra se reduce a un riel de solo
  íconos (`title` como tooltip) en vez de ocultarse -- un menú fijo de
  220px en un celular se comería más de la mitad de la pantalla, algo
  especialmente grave en la puerta del taller, pensada para usarse con
  una sola mano. La barra superior que queda en cada puerta se redujo a
  lo que de verdad funciona: selector de puertas, nombre de quien tiene
  la sesión, y cerrar sesión -- a propósito **no** se agregó una barra
  de búsqueda ni una campana de notificaciones decorativas (como las de
  la referencia visual de Polaco Scooter) porque ninguna de las dos
  tiene una función real detrás todavía. Las imágenes de producto en
  las tarjetas de `/vender` e `/inventario` de esa misma referencia
  también quedaron fuera de este cambio: `repuesto`/`articulo` no
  tienen columna de imagen ni existe ninguna pantalla para subirlas --
  es una funcionalidad aparte, más grande, pendiente de decidir.
- **Foto de producto para repuesto y artículo** (`0022_imagen_producto.sql`,
  `componentes/ui/foto-producto.tsx`): la funcionalidad aparte que
  quedó pendiente en el punto anterior. `/vender` e `/inventario`
  muestran ahora una tarjeta con foto por cada repuesto y cada
  artículo, en vez de una fila de texto -- sin foto, la tarjeta cae en
  un ícono según el tipo, mismo patrón que el logo de empresa cayendo
  en su inicial. La foto se sube a un bucket público `productos`
  (mismo motivo que `logos`: se ve dentro de la sesión, no hay nada
  sensible en ella) con la misma convención de aislamiento por carpeta
  de empresa.

  A propósito, esto **no** creó un formulario de alta/edición de
  repuestos: seguía sin existir uno (el catálogo de `repuesto` sigue
  siendo cosa de `seed.sql`, ver "Qué falta") y agregar solo la foto no
  ameritaba construirlo -- `PATCH /api/repuestos/[id]` recibe
  únicamente `imagenUrl`, nada más del repuesto es editable desde la
  aplicación todavía. Para `articulo`, que sí nace desde la aplicación
  (`/recepcion-mercancia`), la foto se agrega después y desde
  `/inventario`, no durante la recepción -- ese formulario es
  deliberadamente un bucle sin mouse (ver su comentario de cabecera) y
  meterle un selector de archivo ahí lo habría hecho más lento sin que
  nadie lo pidiera.
- **Fase "POS y taller" de la expansión a SaaS multiempresa**
  (`0019_codigo_categoria_metodo_pago.sql`): código corto por
  cajero/técnico (`perfil.codigo`, para recibos y reportes -- nunca un
  mecanismo de sesión aparte de Supabase Auth), categorías de producto
  (`categoria`, con pestañas de filtro en `/vender`), y métodos de pago
  configurables por empresa (`metodo_pago`, reemplaza el check
  constraint fijo de tres valores) con calculadora de cambio por
  denominación en `/vender` cuando el método es efectivo. De paso se
  corrigió un bug real que este trabajo dejó al descubierto: nada en
  todo el proyecto asignaba `orden.tecnico_id`, así que el requisito
  `tiene_tecnico` de `en_diagnostico` nunca se podía cumplir -- ahora
  quien mueve la orden a `en_diagnostico` se autoasigna como su
  técnico, lo que además es de donde sale la nueva tabla de
  productividad por técnico en `/reportes`.
- **La facturación DIAN es un stub a propósito.** `lib/dian/proveedor.ts`
  lanza `DianNoConfiguradoError` hasta que se elija un integrador real.
  Nunca se implementa la DIAN a mano.
- **El correo al cliente es real (Resend); el WhatsApp es un stub, mismo
  patrón que la DIAN.** Al recibir un equipo, `POST /api/ordenes` llama
  a `lib/mensajeria/notificarCliente()`, que manda el correo con el
  enlace de seguimiento y, en paralelo, intenta el WhatsApp. Ninguno de
  los dos puede tumbar la recepción -- si falla, solo queda en el log.
  El WhatsApp está pendiente de que exista la cuenta de WhatsApp
  Business Platform (Meta); ver el porqué y qué falta en el comentario
  de cabecera de `lib/mensajeria/whatsapp.ts` -- en corto: es una
  llamada de servidor a la API de Meta, no una app de WhatsApp instalada
  en ningún dispositivo, así que **no** necesita nada en la estación
  Android (esa sigue siendo solo para imprimir). El "segundo WhatsApp"
  para celulares recibidos sin WhatsApp propio es, con la Cloud API,
  solo un segundo número dentro de la misma cuenta de Meta -- no un
  segundo servidor.

## Qué falta (a propósito)

Con esto, ninguna página del MVP queda como esqueleto. Ya son reales:

- **`app/(taller)/orden/[id]/diagnostico`**: líneas de repuestos y
  servicios con total en vivo, mano de obra, y un botón que crea la
  cotización, mueve la orden a `esperando_aprobacion`
  (`POST /api/ordenes/[id]/cotizacion`) y entrega el enlace de
  seguimiento para copiar y mandar por WhatsApp.
- **`app/(taller)/orden/[id]/repuestos`**: buscar en el catálogo con
  existencia por sede y consumir (descuenta inventario de verdad vía
  `consumir_repuesto`, y deja rastro en `orden_repuesto`), o marcar
  faltante -- lo que aparece de inmediato en `/compras`, que dejó de
  ser de solo lectura: el botón "marcar recibido" cierra el ciclo de
  la sección 4 del documento original.
- **`app/(taller)/orden/[id]/evidencia`**: foto o video en cualquier
  fase (entrada, salida o general), con casilla de visibilidad para
  el cliente. El video estaba contemplado en el esquema desde el
  principio pero el plano lo dejaba fuera de la v1 por peso y por la
  red del taller -- se activó a pedido, con un límite de 50MB por
  archivo en el bucket (`0012_limite_evidencia.sql`) para que no se
  coma la cuota gratuita de Storage.
- **`app/(admin)/reportes`**: tres de las cuatro métricas de éxito del
  piloto, calculadas de datos reales -- % de órdenes entregadas con
  evidencia de entrada y salida, tiempo promedio hasta la aprobación
  de la cotización, y % de faltantes resueltos en menos de 48 horas
  (`0013_recibido_en.sql` agregó el timestamp que faltaba para poder
  calcular esta última). La cuarta -- tiempo de recepción bajo 3
  minutos -- no tiene de dónde salir de la base de datos: se muestra
  como instrucción para cronometrar a mano durante el piloto, nunca
  como un número inventado.

El resto de `(pos)` ya es real, de principio a fin, sin datos de
relleno:

- **`vender`** busca repuestos a granel y artículos individualizados por
  separado (dos catálogos distintos, ver más arriba) y arma un carrito
  con ambos; al cobrar, cada línea sale del inventario a su manera
  (`POST /api/ventas`) y encola el recibo. No siempre tuvo esto -- nació
  como una pantalla con carrito pero sin ninguna forma real de
  agregarle nada.
- **`recibir`** busca cliente por documento y equipo por serial, crea
  la orden con `POST /api/ordenes`, e imprime comprobante + etiqueta.
- **`turno`** abre con base inicial, muestra el resumen en vivo
  (`GET /api/turno/actual`) y cierra comparando lo contado contra
  `lib/caja.ts` (`POST /api/turno/cerrar`), con su comprobante impreso.
- **`entregar`** busca la orden por número, cobra el saldo pendiente si
  lo hay, captura firma (canvas, sin librería) y foto de salida, sube
  ambas a Storage (`lib/subir-evidencia.ts`) y solo entonces intenta la
  transición a `entregada` -- que el servidor rechaza si falta
  cualquiera de los tres requisitos reales.

Y una pieza que es decisión de negocio, no de código, y por eso no está
resuelta aquí:

- **Un integrador DIAN.** Cotizar antes de implementar -- ver
  `lib/dian/proveedor.ts`.

Login, sesión y guardas de rol por puerta ya están conectados:
`middleware.ts` refresca la sesión en cada request, `/login` autentica
contra Supabase Auth y redirige según el rol (`lib/perfil.ts`), y cada
layout de `(pos)`, `(taller)`, `(admin)` verifica con
`puedeEntrarA()` antes de mostrar nada. Falta crear los usuarios reales
-- hoy solo existen en `seed.sql` como filas de `perfil` sin una cuenta
de Supabase Auth detrás; crearlos es responsabilidad del admin desde
el panel de Supabase o con la Auth Admin API.

### Crear el primer superadmin

No hay -- a propósito -- ningún formulario ni endpoint que cree un
superadmin: es la única cuenta con acceso a través de todas las
empresas, así que nace fuera de la aplicación. Con un usuario ya creado
en Supabase Auth (panel → Authentication, o `admin.auth.admin.createUser`),
insertar su fila de `superadmin` por SQL:

```sql
insert into superadmin (id, nombre) values ('<uuid del usuario>', 'Nombre y apellido');
```

Desde ahí, ese correo entra por `/login` y cae en `/superadmin/empresas`
-- no tiene fila en `perfil`, así que ninguna de las tres puertas de
una empresa lo reconoce ni lo dejaría entrar por error.
