# Taller SaaS

POS y servicio técnico trazable por QR, para talleres con dos sedes.
Una sola aplicación web con tres puertas — POS, la app del técnico, y el
portal del cliente — más un servidor de impresión que corre en el
Android fijo de cada sede.

Este repositorio nace de un plano de construcción de trece semanas.
Este README cubre cómo levantar lo que ya existe; el plano completo
(arquitectura, modelo de negocio, fases) vive en las conversaciones que
lo originaron y en los comentarios de cabecera de cada archivo.

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
├─ (admin)/      # escritorio: ordenes, inventario, compras, usuarios, reportes
├─ (publico)/    # seguimiento/[token] -- sin sesión
└─ api/          # rutas de servidor que las páginas y la estación consumen

lib/
├─ estados.ts        # la máquina de estados de la orden -- fuente única
├─ permisos.ts        # qué rol puede qué
├─ impresion.ts        # encolar trabajos -- la web nunca habla de bytes
├─ caja.ts            # cálculos de turno y saldo
├─ estacion-auth.ts    # autenticación de las estaciones de impresión
├─ dian/               # interfaz de facturación, con proveedor real pendiente
└─ supabase/           # clientes de navegador y de servidor

estacion/       # el servidor de impresión -- NO se despliega en Vercel
supabase/
├─ migrations/  # el esquema completo, 0001 a 0008
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
npm test         # 44 pruebas: estados.ts, caja.ts, escpos.ts, etiqueta.ts
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
- **La facturación DIAN es un stub a propósito.** `lib/dian/proveedor.ts`
  lanza `DianNoConfiguradoError` hasta que se elija un integrador real.
  Nunca se implementa la DIAN a mano.

## Qué falta (a propósito)

Estas páginas existen como esqueleto navegable, con un comentario que
dice exactamente qué construir y contra qué ruta de API:

- `app/(pos)/recibir`, `app/(pos)/entregar`, `app/(pos)/turno`
- `app/(taller)/orden/[id]/evidencia`, `.../diagnostico`, `.../repuestos`
- `app/(admin)/reportes`

Y dos piezas de infraestructura que son decisión de negocio, no de
código, y por eso no están resueltas aquí:

- **Un integrador DIAN.** Cotizar antes de implementar.
- **Login y sesión de usuario.** Las rutas ya asumen `auth.getUser()`
  de Supabase Auth; falta la pantalla de login y el middleware que
  refresca la sesión en cada request.
