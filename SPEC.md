# SPEC — Toyota Taller Perú
### Plataforma de e-commerce de repuestos + agente conversacional de ventas y agenda

| Campo | Valor |
|---|---|
| **Versión del spec** | 1.0 |
| **Fecha** | 22 de agosto de 2026 |
| **Autor** | conversandoapp@gmail.com |
| **Estado** | Aprobado para implementar (pendiente credenciales) |
| **Tipo** | Trabajo final — Curso Agentic Engineer |

> **Aviso legal:** proyecto académico de demostración. No está afiliado, patrocinado ni avalado por Toyota Motor Corporation. Todos los datos de repuestos, precios, stock y mantenimientos son ficticios. El branding se usa con fines educativos y debe incluir un disclaimer visible en el pie de página del sitio.

---

## 1. Resumen ejecutivo

Una web pública donde un cliente puede:

1. **Navegar un catálogo de repuestos Toyota** con fotos, fichas técnicas, compatibilidad por modelo/año, precio y stock.
2. **Comprar** mediante una pasarela de pagos *dummy* (simulada, sin cobro real).
3. **Conversar en lenguaje natural con un agente vendedor** que entiende la intención y la canaliza hacia cuatro capacidades:
   - **F1 — Inventario:** identifica a qué repuesto se refiere el cliente (preguntando si hay ambigüedad), consulta Supabase y responde disponibilidad y precio.
   - **F2 — Agenda:** consulta Google Calendar, valida la ventana L–V 09:00–17:00 (America/Lima), ofrece los espacios libres, registra la cita (1 hora por atención) y **envía un correo de confirmación** con fecha, hora y dirección del taller.
   - **F3 — Conocimiento:** responde preguntas sobre repuestos y mantenimiento **de autos Toyota únicamente**. Otras marcas y temas ajenos se rechazan con cortesía.
   - **F4 — Gestión de citas:** si el cliente olvidó si agendó o cuándo, **busca sus citas usando el correo electrónico como llave** y, si lo pide, las cancela liberando el horario.
4. **Consultar los 3 tipos de mantenimiento** que ofrece el taller y agendarlos.

El agente **no adivina**: todo dato de precio, stock o disponibilidad de agenda proviene de una *tool* ejecutada en el servidor.

---

## 2. Objetivos y no-objetivos

### 2.1 Objetivos

| # | Objetivo | Métrica de éxito |
|---|---|---|
| O1 | El agente resuelve consultas de stock/precio sin intervención humana | ≥ 90 % de las consultas del set de pruebas responden con dato real de BD |
| O2 | El agente agenda una cita end-to-end desde el chat | Cita creada en Supabase **y** evento visible en Google Calendar |
| O3 | El agente nunca responde por marcas distintas a Toyota | 100 % de los 12 casos negativos del set de pruebas rechazados con cortesía |
| O4 | El agente nunca inventa precios ni stock | 0 respuestas con cifras no provenientes de una tool |
| O5 | Compra simulada completa | Pedido persistido con estado `pagado` y código de confirmación |
| O6 | Toda cita confirmada genera un correo al cliente | Email entregado con código, servicio, fecha, hora y dirección del taller |
| O7 | El cliente recupera sus citas solo con su correo | «¿tengo una cita?» + email → el agente lista sus citas futuras y pasadas recientes |

### 2.2 No-objetivos (fuera de alcance v1)

- Cobro real de tarjetas; integración con Culqi/Niubiz/Stripe en modo producción.
- Login de clientes, historial de pedidos por usuario, recuperación de contraseña.
- Panel de administración (CRUD de repuestos/citas). Se opera por SQL o Supabase Studio.
- Envío de WhatsApp o SMS. **Sí hay correo transaccional** (ver §11).
- **Reprogramar** una cita desde el chat. Se puede consultar y cancelar; para mover una cita, el cliente cancela y agenda de nuevo.
- Recordatorio automático el día previo a la cita (requiere un cron; se documenta como mejora v2).
- Multi-idioma. Todo el producto es en **español (es-PE)**.
- Multi-sede o múltiples bahías simultáneas (v1 = **1 bahía**, 1 cita por hora).
- Voz o entrada por imagen en el chat.
- Búsqueda vectorial / embeddings (v1 usa full-text search en español + trigramas).

---

## 3. Decisiones técnicas cerradas

| Decisión | Elección | Motivo |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript + Tailwind CSS 4** | Front y backend en un repo; las credenciales viven en Route Handlers del servidor y nunca llegan al navegador |
| Base de datos | **Supabase (PostgreSQL)** | Requisito del enunciado; RLS + SQL editor + storage disponibles |
| LLM | **NVIDIA NIM** — `https://integrate.api.nvidia.com/v1`, modelo `meta/muse-glimmer-30b` | Endpoint **compatible con OpenAI** → se usa el SDK `openai` con `baseURL` sobreescrita |
| Agenda | **Google Calendar API v3 con Service Account** | Sin login interactivo; el calendario del taller se comparte con el email de la cuenta de servicio |
| Imágenes | **Fotos reales genéricas** (sin marca Toyota), de fuentes de licencia abierta (Wikimedia Commons / Openverse), descargadas a `/public/` en tiempo de autoría | Sin hotlinking: funciona offline en runtime igual que los placeholders. Atribución en `public/CREDITOS-IMAGENES.md`. Los ítems sin foto confiable conservan el placeholder SVG de respaldo |
| Moneda / zona | **PEN (S/), `America/Lima`, IGV 18 %** | Mercado peruano |
| Cuentas | **Sin login.** Invitado; datos capturados al agendar o pagar | Demo enfocada en el agente |
| Identidad del cliente | **El correo electrónico es la llave.** Sin contraseña | El cliente recupera sus citas escribiendo su email en el chat o en `/mis-citas` |
| Email transaccional | **Brevo** (API HTTP), 300 correos/día gratis | Sin dominio propio ni tarjeta; remitente = Gmail verificado; envía a cualquier destinatario, a diferencia de Resend sin dominio verificado |
| UI del chat | Widget flotante en todas las páginas + página dedicada `/chat` | El agente debe estar siempre a un clic |
| Entrega de repuestos | **Recojo en tienda (gratis) o delivery en Lima** (S/ 15, gratis desde S/ 300) | El cliente elige en el checkout; da contenido real al correo de pedido |
| Hosting | **Render — Web Service (Node)** | Proceso persistente: SSE sin límites de serverless, rate limit en memoria viable y Secret Files para la clave de Google |
| Pruebas | **Vitest** (unitarias) + **evals conversacionales** del agente | Los criterios de aceptación se ejecutan, no solo se revisan a mano (§16.1) |
| Dirección de arte | **Catálogo técnico**: ficha de orden de trabajo, Archivo + IBM Plex Sans/Mono, gris cemento y tinta | El producto vende confianza en el dato; el lenguaje visual del manual de servicio lo respalda (§13.1) |
| Nombre del agente | **Toño** | Así se llama en el Perú al mecánico de confianza; además comparte las dos primeras letras de Toyota (§9.1) |

### 3.1 Datos del taller (ficticios, usados en emails, footer y prompt)

| Campo | Valor |
|---|---|
| **Razón social** | Toyota Taller Perú S.A.C. |
| **Dirección** | Av. Javier Prado Este 4520, Santiago de Surco, Lima 15023 |
| **Referencia** | A media cuadra del óvalo Monitor Huáscar, frente al grifo Primax |
| **Teléfono** | (01) 715-4820 |
| **WhatsApp** | +51 987 456 123 |
| **Horario** | Lunes a viernes, 09:00 – 17:00. Sábados, domingos y feriados: cerrado |
| **Google Maps** | `https://maps.google.com/?q=Av.+Javier+Prado+Este+4520,+Surco,+Lima` |

Estos valores viven en un solo módulo, `src/server/lib/taller.ts`, y se consumen desde el system prompt, las plantillas de correo, la descripción del evento de Calendar y el footer del sitio. **No se duplican como literales en ningún otro lugar.**

---

## 4. Arquitectura

```
┌──────────────────────────── Navegador ────────────────────────────┐
│  Next.js (React Server Components + Client Components)            │
│  / · /repuestos · /repuestos/[slug] · /mantenimientos             │
│  /agenda · /carrito · /checkout · /chat  +  <ChatWidget/>         │
└───────────────┬───────────────────────────────────┬───────────────┘
                │ fetch / SSE                       │ fetch
┌───────────────▼───────────────────────────────────▼───────────────┐
│               Next.js Route Handlers  (servidor)                  │
│                                                                   │
│   POST /api/chat  ──►  AgentRuntime (bucle de tool-calling)       │
│                          ├─► tools/catalogo.ts                    │
│                          ├─► tools/inventario.ts                  │
│                          ├─► tools/agenda.ts                      │
│                          ├─► tools/citas.ts   (consulta/cancela)  │
│                          └─► tools/conocimiento.ts                │
│                                                                   │
│   GET/POST /api/repuestos · /api/agenda · /api/citas              │
│   POST /api/checkout       (mismos servicios que usa el agente)   │
└────┬────────────────┬──────────────────┬─────────────────┬────────┘
     │ supabase-js    │ googleapis       │ openai SDK      │ fetch
     │ (service_role) │ (JWT svc. acct.) │ (baseURL NIM)   │ (API v3)
┌────▼─────────┐ ┌────▼───────────┐ ┌────▼──────────┐ ┌────▼────────┐
│   Supabase   │ │Google Calendar │ │  NVIDIA NIM   │ │    Brevo    │
│  PostgreSQL  │ │  (taller@…)    │ │muse-glimmer-30│ │ email 300/d │
└──────────────┘ └────────────────┘ └───────────────┘ └─────────────┘
```

**Principio rector:** la lógica de negocio vive en `src/server/services/*`. Las *tools* del agente y los endpoints REST de la UI son dos fachadas sobre **los mismos servicios**. Nunca se duplica lógica; si la UI y el agente difieren en una respuesta, es un bug.

### 4.1 Estructura de carpetas

```
Agente-taller/
├─ SPEC.md
├─ .env.example
├─ README.md
├─ supabase/
│  ├─ 01_schema.sql          # DDL, índices, funciones, triggers, RLS
│  ├─ 02_seed.sql            # datos de prueba
│  └─ 99_reset.sql           # drop en cascada (solo desarrollo)
├─ public/
│  ├─ repuestos/*.svg        # 24 placeholders generados
│  ├─ mantenimientos/*.svg
│  └─ brand/logo-taller.svg
└─ src/
   ├─ app/
   │  ├─ layout.tsx  page.tsx  globals.css
   │  ├─ repuestos/page.tsx · [slug]/page.tsx
   │  ├─ mantenimientos/page.tsx
   │  ├─ agenda/page.tsx
   │  ├─ mis-citas/page.tsx    # consulta por email + cancelación
   │  ├─ carrito/page.tsx
   │  ├─ checkout/page.tsx · confirmacion/[codigo]/page.tsx
   │  ├─ chat/page.tsx
   │  └─ api/
   │     ├─ chat/route.ts
   │     ├─ repuestos/route.ts · [slug]/route.ts
   │     ├─ mantenimientos/route.ts
   │     ├─ agenda/disponibilidad/route.ts
   │     ├─ citas/route.ts            # POST crear · GET ?email=
   │     ├─ citas/[codigo]/cancelar/route.ts
   │     └─ checkout/route.ts
   ├─ components/
   │  ├─ chat/ChatWidget.tsx · MessageList.tsx · ToolBadge.tsx
   │  ├─ catalogo/ProductCard.tsx · Filtros.tsx · StockBadge.tsx
   │  ├─ agenda/SlotPicker.tsx · TarjetaCita.tsx
   │  └─ ui/  (Button, Card, Badge, Input, Modal…)
   ├─ server/
   │  ├─ agent/
   │  │  ├─ runtime.ts        # bucle de tool-calling + streaming
   │  │  ├─ prompt.ts         # system prompt y plantillas de rechazo
   │  │  ├─ tools.ts          # definiciones JSON Schema + dispatcher
   │  │  ├─ guardrails.ts     # detector de marca / off-topic
   │  │  └─ llm.ts            # cliente OpenAI-compatible → NVIDIA NIM
   │  ├─ services/
   │  │  ├─ catalogo.ts · inventario.ts · agenda.ts
   │  │  ├─ citas.ts          # consulta por email, cancelación
   │  │  └─ conocimiento.ts · pedidos.ts
   │  ├─ email/
   │  │  ├─ enviar.ts         # fachada con reintento e idempotencia
   │  │  └─ plantillas/
   │  │     ├─ cita-confirmada.ts
   │  │     ├─ cita-cancelada.ts
   │  │     └─ pedido-confirmado.ts
   │  ├─ integrations/
   │  │  ├─ supabase.ts       # cliente admin (service_role)
   │  │  ├─ google-calendar.ts
   │  │  └─ brevo.ts          # POST https://api.brevo.com/v3/smtp/email
   │  └─ lib/  (fechas.ts, moneda.ts, taller.ts, rate-limit.ts, errores.ts)
   └─ types/  (db.ts generado por `supabase gen types`, dominio.ts)
```

---

## 5. Variables de entorno

`.env.local` nunca se commitea. `.env.example` sí se versiona, con los valores en blanco.

```bash
# ── LLM (NVIDIA NIM, compatible OpenAI) ─────────────────────────────
NVIDIA_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_MODEL=meta/muse-glimmer-30b
NVIDIA_API_KEY=                      # nvapi-...
AGENT_TOOL_MODE=auto                 # auto | native | json   (ver §9.5)
AGENT_MAX_TOOL_ITERATIONS=5
AGENT_TEMPERATURE=0.3

# ── Supabase ────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=       # solo lectura del catálogo (RLS)
SUPABASE_SERVICE_ROLE_KEY=           # SOLO servidor. Nunca NEXT_PUBLIC_

# ── Google Calendar (Service Account) ───────────────────────────────
GOOGLE_SERVICE_ACCOUNT_EMAIL=        # taller-agente@proyecto.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=                  # "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_CALENDAR_ID=                  # ej. taller.toyota.demo@gmail.com
CALENDAR_PROVIDER=google             # google | mock  (ver §10.6)

# ── Email transaccional (Brevo) ─────────────────────────────────────
EMAIL_PROVIDER=brevo                 # brevo | consola  (ver §11.6)
BREVO_API_KEY=                       # xkeysib-...
EMAIL_REMITENTE=                     # remitente VERIFICADO en Brevo (tu Gmail)
EMAIL_REMITENTE_NOMBRE=Toyota Taller Perú
EMAIL_RESPONDER_A=                   # opcional, Reply-To
EMAIL_COPIA_TALLER=                  # opcional, BCC interno de cada cita

# ── Datos del taller (§3.1) ─────────────────────────────────────────
TALLER_NOMBRE=Toyota Taller Perú
TALLER_DIRECCION=Av. Javier Prado Este 4520, Santiago de Surco, Lima 15023
TALLER_REFERENCIA=A media cuadra del óvalo Monitor Huáscar, frente al grifo Primax
TALLER_TELEFONO=(01) 715-4820
TALLER_WHATSAPP=+51 987 456 123
TALLER_MAPS_URL=https://maps.google.com/?q=Av.+Javier+Prado+Este+4520,+Surco,+Lima

# ── Negocio ─────────────────────────────────────────────────────────
TZ_TALLER=America/Lima
HORA_APERTURA=9
HORA_CIERRE=17
DURACION_CITA_MIN=60
DIAS_LABORABLES=1,2,3,4,5            # ISO: 1=lunes … 5=viernes
ANTICIPACION_MINIMA_HORAS=2
VENTANA_AGENDA_DIAS=30
IGV_PORCENTAJE=18
ENVIO_COSTO_LIMA=15
ENVIO_GRATIS_DESDE=300

# ── App ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_SITE_URL=http://localhost:3000   # en Render: https://<app>.onrender.com
PORT=3000                                    # Render lo inyecta; no fijarlo allí
RATE_LIMIT_CHAT_POR_MINUTO=15
RATE_LIMIT_CITAS_POR_MINUTO=5
RATE_LIMIT_AGENDAR_POR_HORA=3
```

**Regla de oro:** `SUPABASE_SERVICE_ROLE_KEY`, `NVIDIA_API_KEY`, `GOOGLE_PRIVATE_KEY` y `BREVO_API_KEY` solo se leen dentro de `src/server/**`. Un check de CI debe fallar si aparecen fuera de esa carpeta.

> **Nota sobre `EMAIL_REMITENTE`:** Brevo exige un remitente verificado. Con una cuenta Gmail gratuita se verifica la propia dirección (un correo de confirmación de Brevo). Los correos saldrán como *Toyota Taller Perú &lt;tu-correo@gmail.com&gt;*, lo cual es correcto para la demo. Un remitente tipo `citas@toyotatallerperu.pe` requeriría comprar el dominio y configurar SPF/DKIM.

> **Nota sobre `GOOGLE_PRIVATE_KEY`:** guardar con `\n` literales entre comillas y normalizar en código con `.replace(/\\n/g, '\n')`.

---

## 6. Modelo de datos (Supabase)

### 6.1 Diagrama lógico

```
categorias ──< repuestos >── inventario (1:1)
                  │
                  └──< repuesto_compatibilidad >── modelos_toyota
repuestos ──< pedido_items >── pedidos
mantenimientos ──< citas          (citas.email = llave del cliente)
conversaciones ──< mensajes
emails_enviados  (bitácora e idempotencia del envío transaccional)
faq_toyota       (independiente, base de conocimiento de F3)
```

### 6.2 Tablas

| Tabla | Propósito | Escrituras |
|---|---|---|
| `categorias` | 8 familias de repuestos | seed |
| `modelos_toyota` | Modelos vendidos en Perú | seed |
| `repuestos` | Catálogo maestro con precio y ficha | seed |
| `repuesto_compatibilidad` | Repuesto ↔ modelo ↔ rango de años | seed |
| `inventario` | Stock por repuesto (1:1) | seed + descuento en compra |
| `mantenimientos` | Los 3 servicios del taller | seed |
| `citas` | Reservas, con `google_event_id` y `email` como llave del cliente | agente / web |
| `pedidos`, `pedido_items` | Compras dummy | checkout |
| `emails_enviados` | Bitácora de correos e idempotencia del envío | servidor |
| `conversaciones`, `mensajes` | Traza del chat y de las tools ejecutadas | agente |
| `faq_toyota` | Base de conocimiento de F3 | seed |

### 6.3 Reglas de integridad relevantes

- `citas`: índice único parcial sobre `inicio` **solo para `estado = 'confirmada'`** ⇒ imposible el doble booking, y cancelar una cita **libera automáticamente el horario** sin borrar el registro histórico.
- `citas.email` se normaliza a minúsculas y sin espacios **antes** de guardar (trigger), y tiene índice: es la llave con la que el cliente recupera sus citas.
- `citas`: trigger `fn_validar_horario_cita` valida L–V, 09:00–16:00 como hora de inicio (última cita 16:00–17:00) en `America/Lima`, y que `fin = inicio + 60 min`. Se usa **trigger y no CHECK** porque `AT TIME ZONE` es `STABLE` y PostgreSQL rechaza expresiones no inmutables en constraints.
- `inventario.stock_disponible` = `stock - stock_reservado` (columna generada).
- Precios en `numeric(10,2)`, **IGV incluido**. El desglose se calcula al emitir el pedido.

---

## 7. SQL — `supabase/01_schema.sql`

```sql
-- ═══════════════════════════════════════════════════════════════════
--  TOYOTA TALLER PERÚ — Esquema
--  Ejecutar completo en el SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";
create extension if not exists "pg_trgm";

-- unaccent() es STABLE; se envuelve para poder indexarla.
create or replace function public.f_unaccent(text)
returns text
language sql immutable strict parallel safe
as $$ select extensions.unaccent('extensions.unaccent', $1) $$;

-- ─────────────────────────── Catálogo ──────────────────────────────

create table public.categorias (
  id          serial primary key,
  slug        text not null unique,
  nombre      text not null,
  descripcion text,
  icono       text,
  orden       int  not null default 0
);

create table public.modelos_toyota (
  id          serial primary key,
  slug        text not null unique,
  nombre      text not null,
  carroceria  text,                      -- sedán, SUV, pickup, hatchback
  anio_desde  int  not null,
  anio_hasta  int
);

create table public.repuestos (
  id              uuid primary key default gen_random_uuid(),
  sku             text not null unique,
  slug            text not null unique,
  nombre          text not null,
  descripcion     text not null,
  categoria_id    int  not null references public.categorias(id),
  numero_parte    text,                  -- número de parte Toyota
  marca_repuesto  text not null default 'Toyota Genuine Parts',
  precio          numeric(10,2) not null check (precio >= 0),  -- PEN, IGV incl.
  moneda          text not null default 'PEN',
  imagen_url      text not null,
  garantia_meses  int  not null default 12,
  especificaciones jsonb not null default '{}'::jsonb,
  destacado       boolean not null default false,
  activo          boolean not null default true,
  creado_en       timestamptz not null default now(),
  busqueda tsvector generated always as (
    to_tsvector('spanish',
      public.f_unaccent(
        coalesce(nombre,'') || ' ' || coalesce(descripcion,'') || ' ' ||
        coalesce(sku,'')   || ' ' || coalesce(numero_parte,'')
      )
    )
  ) stored
);

create index repuestos_busqueda_idx  on public.repuestos using gin (busqueda);
create index repuestos_nombre_trgm   on public.repuestos using gin (public.f_unaccent(nombre) gin_trgm_ops);
create index repuestos_categoria_idx on public.repuestos (categoria_id);

create table public.repuesto_compatibilidad (
  repuesto_id uuid not null references public.repuestos(id) on delete cascade,
  modelo_id   int  not null references public.modelos_toyota(id) on delete cascade,
  anio_desde  int,
  anio_hasta  int,
  primary key (repuesto_id, modelo_id)
);

create table public.inventario (
  repuesto_id    uuid primary key references public.repuestos(id) on delete cascade,
  stock          int not null default 0 check (stock >= 0),
  stock_reservado int not null default 0 check (stock_reservado >= 0),
  stock_disponible int generated always as (stock - stock_reservado) stored,
  stock_minimo   int not null default 2,
  ubicacion      text,                   -- ej. 'A-03-12'
  dias_reposicion int not null default 7,
  actualizado_en timestamptz not null default now()
);

-- ────────────────────────── Mantenimientos ─────────────────────────

create table public.mantenimientos (
  id               serial primary key,
  slug             text not null unique,
  nombre           text not null,
  descripcion      text not null,
  duracion_minutos int  not null default 60,
  precio           numeric(10,2) not null,
  intervalo_km     int,
  incluye          text[] not null default '{}',
  imagen_url       text,
  orden            int not null default 0,
  activo           boolean not null default true
);

-- ─────────────────────────────  Citas  ─────────────────────────────

create table public.citas (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique,
  nombre_cliente   text not null,
  email            text not null,
  telefono         text not null,
  modelo_vehiculo  text not null,
  anio_vehiculo    int,
  placa            text,
  mantenimiento_id int not null references public.mantenimientos(id),
  inicio           timestamptz not null,
  fin              timestamptz not null,
  estado           text not null default 'confirmada'
                   check (estado in ('confirmada','cancelada','atendida','no_asistio')),
  google_event_id  text,
  notas            text,
  origen           text not null default 'chat' check (origen in ('chat','web')),
  creado_en        timestamptz not null default now(),
  cancelada_en     timestamptz,
  motivo_cancelacion text
);

-- Un solo box de atención: prohibido el doble booking.
-- El filtro por estado hace que CANCELAR libere el horario automáticamente.
create unique index citas_slot_unico
  on public.citas (inicio)
  where estado = 'confirmada';

create index citas_inicio_idx on public.citas (inicio);

-- El email es la llave con la que el cliente recupera sus citas.
create index citas_email_idx on public.citas (email);

create or replace function public.fn_normalizar_email_cita()
returns trigger language plpgsql as $$
begin
  new.email := lower(btrim(new.email));
  if new.email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'EMAIL_INVALIDO: %', new.email;
  end if;
  return new;
end $$;

create trigger trg_normalizar_email_cita
  before insert or update of email on public.citas
  for each row execute function public.fn_normalizar_email_cita();

-- Horario laboral: L-V, inicio entre 09:00 y 16:00 hora de Lima, 60 min.
create or replace function public.fn_validar_horario_cita()
returns trigger language plpgsql as $$
declare
  v_local  timestamp;
  v_dow    int;
  v_hora   int;
begin
  v_local := new.inicio at time zone 'America/Lima';
  v_dow   := extract(isodow from v_local);
  v_hora  := extract(hour   from v_local);

  if v_dow > 5 then
    raise exception 'El taller solo atiende de lunes a viernes (día recibido: %)', v_dow;
  end if;
  if v_hora < 9 or v_hora > 16 then
    raise exception 'Horario fuera de rango: la atención es de 09:00 a 17:00 (hora recibida: %)', v_hora;
  end if;
  if extract(minute from v_local) <> 0 or extract(second from v_local) <> 0 then
    raise exception 'Las citas inician en horas exactas';
  end if;
  if new.fin <> new.inicio + interval '60 minutes' then
    raise exception 'Toda atención dura exactamente 60 minutos';
  end if;
  return new;
end $$;

create trigger trg_validar_horario_cita
  before insert or update of inicio, fin on public.citas
  for each row execute function public.fn_validar_horario_cita();

-- Código legible: CITA-2026-0001
create sequence if not exists public.seq_codigo_cita start 1;
create or replace function public.fn_codigo_cita()
returns trigger language plpgsql as $$
begin
  if new.codigo is null then
    new.codigo := 'CITA-' || to_char(now(),'YYYY') || '-' ||
                  lpad(nextval('public.seq_codigo_cita')::text, 4, '0');
  end if;
  return new;
end $$;

create trigger trg_codigo_cita before insert on public.citas
  for each row execute function public.fn_codigo_cita();

-- ─────────────────────────── E-commerce ────────────────────────────

create table public.pedidos (
  id               uuid primary key default gen_random_uuid(),
  codigo           text not null unique,
  nombre_cliente   text not null,
  email            text not null,
  telefono         text not null,
  modalidad_entrega text not null default 'recojo'
                   check (modalidad_entrega in ('recojo','delivery')),
  direccion        text,                 -- obligatorio si modalidad='delivery'
  distrito         text,
  ciudad           text default 'Lima',
  referencia_entrega text,
  -- Los precios de catálogo YA incluyen IGV.
  --   monto_items = Σ pedido_items.subtotal
  --   total       = monto_items + costo_envio
  --   subtotal    = total / 1.18   (base imponible)
  --   igv         = total - subtotal
  monto_items      numeric(10,2) not null,
  costo_envio      numeric(10,2) not null default 0,
  subtotal         numeric(10,2) not null,
  igv              numeric(10,2) not null,
  total            numeric(10,2) not null,
  constraint direccion_requerida_en_delivery check (
    modalidad_entrega = 'recojo'
    or (direccion is not null and btrim(direccion) <> '')
  ),
  estado           text not null default 'pagado'
                   check (estado in ('pendiente','pagado','rechazado','anulado')),
  metodo_pago      text not null default 'tarjeta_demo',
  referencia_pago  text,                 -- ej. DEMO-TXN-8F2A91
  ultimos4         text,                 -- SOLO los 4 últimos dígitos
  creado_en        timestamptz not null default now()
);

create sequence if not exists public.seq_codigo_pedido start 1;
create or replace function public.fn_codigo_pedido()
returns trigger language plpgsql as $$
begin
  if new.codigo is null then
    new.codigo := 'TTP-' || to_char(now(),'YYYY') || '-' ||
                  lpad(nextval('public.seq_codigo_pedido')::text, 5, '0');
  end if;
  return new;
end $$;

create trigger trg_codigo_pedido before insert on public.pedidos
  for each row execute function public.fn_codigo_pedido();

create table public.pedido_items (
  id              bigserial primary key,
  pedido_id       uuid not null references public.pedidos(id) on delete cascade,
  repuesto_id     uuid not null references public.repuestos(id),
  sku             text not null,
  nombre          text not null,
  precio_unitario numeric(10,2) not null,
  cantidad        int not null check (cantidad > 0),
  subtotal        numeric(10,2) not null
);

-- ─────────────────── Bitácora de correos enviados ──────────────────

create table public.emails_enviados (
  id             bigserial primary key,
  tipo           text not null
                 check (tipo in ('cita_confirmada','cita_cancelada','pedido_confirmado')),
  destinatario   text not null,
  asunto         text not null,
  referencia     text not null,        -- codigo de cita o de pedido
  clave_idem     text not null,        -- tipo + referencia  → evita duplicados
  proveedor      text not null default 'brevo',
  proveedor_id   text,                 -- messageId devuelto por Brevo
  estado         text not null default 'enviado'
                 check (estado in ('enviado','fallido')),
  error_detalle  text,
  intentos       int not null default 1,
  creado_en      timestamptz not null default now()
);

-- Idempotencia: un mismo correo no se envía dos veces por la misma causa.
create unique index emails_clave_idem_unica
  on public.emails_enviados (clave_idem)
  where estado = 'enviado';

create index emails_destinatario_idx on public.emails_enviados (destinatario);

-- ──────────────────────── Traza del agente ─────────────────────────

create table public.conversaciones (
  id         uuid primary key default gen_random_uuid(),
  session_id text not null,
  creado_en  timestamptz not null default now(),
  meta       jsonb not null default '{}'::jsonb
);

create table public.mensajes (
  id              bigserial primary key,
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  rol             text not null check (rol in ('user','assistant','tool','system')),
  contenido       text,
  tool_nombre     text,
  tool_payload    jsonb,
  tool_resultado  jsonb,
  latencia_ms     int,
  creado_en       timestamptz not null default now()
);

create index mensajes_conv_idx on public.mensajes (conversacion_id, creado_en);

-- ─────────────────── Base de conocimiento (F3) ─────────────────────

create table public.faq_toyota (
  id        serial primary key,
  pregunta  text not null,
  respuesta text not null,
  categoria text not null,               -- mantenimiento | repuestos | garantia | general
  modelos   text[] not null default '{}',
  tags      text[] not null default '{}',
  busqueda tsvector generated always as (
    to_tsvector('spanish',
      public.f_unaccent(coalesce(pregunta,'') || ' ' || coalesce(respuesta,'')))
  ) stored
);

create index faq_busqueda_idx on public.faq_toyota using gin (busqueda);

-- ═══════════════════════ Funciones de consulta ═════════════════════

-- Búsqueda de repuestos: full-text en español + trigramas (tolera typos)
create or replace function public.buscar_repuestos(
  p_consulta  text default null,
  p_modelo    text default null,
  p_anio      int  default null,
  p_categoria text default null,
  p_limite    int  default 8
)
returns table (
  id uuid, sku text, slug text, nombre text, descripcion text,
  categoria text, precio numeric, imagen_url text,
  stock_disponible int, estado_stock text,
  compatibilidad text[], relevancia real
)
language sql stable as $$
  with base as (
    select r.id, r.sku, r.slug, r.nombre, r.descripcion,
           c.nombre as categoria, r.precio, r.imagen_url,
           coalesce(i.stock_disponible, 0) as stock_disponible,
           array(
             select m.nombre from public.repuesto_compatibilidad rc
             join public.modelos_toyota m on m.id = rc.modelo_id
             where rc.repuesto_id = r.id order by m.nombre
           ) as compatibilidad,
           case
             when p_consulta is null or p_consulta = '' then 1.0::real
             else ts_rank(r.busqueda,
                    plainto_tsquery('spanish', public.f_unaccent(p_consulta)))
                  + similarity(public.f_unaccent(r.nombre), public.f_unaccent(p_consulta))
           end as relevancia
    from public.repuestos r
    join public.categorias c on c.id = r.categoria_id
    left join public.inventario i on i.repuesto_id = r.id
    where r.activo
      and (p_categoria is null or c.slug = p_categoria)
      and (
        p_consulta is null or p_consulta = ''
        or r.busqueda @@ plainto_tsquery('spanish', public.f_unaccent(p_consulta))
        or public.f_unaccent(r.nombre) % public.f_unaccent(p_consulta)
      )
      and (
        p_modelo is null
        or exists (
          select 1 from public.repuesto_compatibilidad rc
          join public.modelos_toyota m on m.id = rc.modelo_id
          where rc.repuesto_id = r.id
            and public.f_unaccent(lower(m.nombre)) = public.f_unaccent(lower(p_modelo))
            and (p_anio is null
                 or (p_anio >= coalesce(rc.anio_desde, 1900)
                 and  p_anio <= coalesce(rc.anio_hasta, 2100)))
        )
      )
  )
  select id, sku, slug, nombre, descripcion, categoria, precio, imagen_url,
         stock_disponible,
         case when stock_disponible = 0 then 'agotado'
              when stock_disponible <= 2 then 'ultimas_unidades'
              else 'disponible' end as estado_stock,
         compatibilidad, relevancia
  from base
  order by relevancia desc, nombre
  limit greatest(1, least(p_limite, 20));
$$;

-- Búsqueda en la base de conocimiento (F3)
create or replace function public.buscar_conocimiento(
  p_consulta text,
  p_limite   int default 4
)
returns table (id int, pregunta text, respuesta text, categoria text, relevancia real)
language sql stable as $$
  select f.id, f.pregunta, f.respuesta, f.categoria,
         ts_rank(f.busqueda, plainto_tsquery('spanish', public.f_unaccent(p_consulta))) as relevancia
  from public.faq_toyota f
  where f.busqueda @@ plainto_tsquery('spanish', public.f_unaccent(p_consulta))
  order by relevancia desc
  limit greatest(1, least(p_limite, 10));
$$;

-- Descuento de stock transaccional al confirmar un pedido
create or replace function public.descontar_stock(p_repuesto_id uuid, p_cantidad int)
returns int language plpgsql as $$
declare v_restante int;
begin
  update public.inventario
     set stock = stock - p_cantidad, actualizado_en = now()
   where repuesto_id = p_repuesto_id and stock >= p_cantidad
   returning stock into v_restante;
  if not found then
    raise exception 'STOCK_INSUFICIENTE';
  end if;
  return v_restante;
end $$;

-- Citas de un cliente, buscadas por su correo (F4)
create or replace function public.citas_por_email(
  p_email       text,
  p_incluir_pasadas boolean default true,
  p_limite      int default 10
)
returns table (
  codigo text, estado text, inicio timestamptz,
  servicio text, precio numeric, duracion_minutos int,
  modelo_vehiculo text, placa text, es_futura boolean
)
language sql stable as $$
  select c.codigo, c.estado, c.inicio,
         m.nombre as servicio, m.precio, m.duracion_minutos,
         c.modelo_vehiculo, c.placa,
         (c.inicio > now()) as es_futura
  from public.citas c
  join public.mantenimientos m on m.id = c.mantenimiento_id
  where c.email = lower(btrim(p_email))
    and (p_incluir_pasadas or c.inicio > now())
  order by (c.inicio > now()) desc, c.inicio asc
  limit greatest(1, least(p_limite, 20));
$$;

-- Cancelación: libera el slot por el índice único parcial
create or replace function public.cancelar_cita(
  p_codigo text,
  p_email  text,
  p_motivo text default null
)
returns table (codigo text, google_event_id text, inicio timestamptz, servicio text)
language plpgsql as $$
declare v_id uuid;
begin
  select c.id into v_id
    from public.citas c
   where c.codigo = upper(btrim(p_codigo))
     and c.email  = lower(btrim(p_email))
     and c.estado = 'confirmada';

  if v_id is null then
    raise exception 'CITA_NO_CANCELABLE';
  end if;

  update public.citas
     set estado = 'cancelada',
         cancelada_en = now(),
         motivo_cancelacion = p_motivo
   where id = v_id;

  return query
    select c.codigo, c.google_event_id, c.inicio, m.nombre
      from public.citas c
      join public.mantenimientos m on m.id = c.mantenimiento_id
     where c.id = v_id;
end $$;

-- ══════════════════════════════ RLS ════════════════════════════════
-- Catálogo: lectura pública (clave anon). Escrituras y datos de
-- clientes: solo service_role, que ignora RLS por diseño.

alter table public.categorias              enable row level security;
alter table public.modelos_toyota          enable row level security;
alter table public.repuestos               enable row level security;
alter table public.repuesto_compatibilidad enable row level security;
alter table public.inventario              enable row level security;
alter table public.mantenimientos          enable row level security;
alter table public.faq_toyota              enable row level security;
alter table public.citas                   enable row level security;
alter table public.pedidos                 enable row level security;
alter table public.pedido_items            enable row level security;
alter table public.emails_enviados         enable row level security;
alter table public.conversaciones          enable row level security;
alter table public.mensajes                enable row level security;

create policy "lectura publica" on public.categorias              for select using (true);
create policy "lectura publica" on public.modelos_toyota          for select using (true);
create policy "lectura publica" on public.repuestos               for select using (activo);
create policy "lectura publica" on public.repuesto_compatibilidad for select using (true);
create policy "lectura publica" on public.inventario              for select using (true);
create policy "lectura publica" on public.mantenimientos          for select using (activo);
create policy "lectura publica" on public.faq_toyota              for select using (true);

-- citas, pedidos, pedido_items, emails_enviados, conversaciones y
-- mensajes quedan SIN políticas: nadie con la clave anon puede leerlos
-- ni escribirlos. La búsqueda por email SIEMPRE pasa por el servidor,
-- que usa service_role y aplica su propio rate limit (§15).
```

---

## 8. SQL — `supabase/02_seed.sql` (datos de prueba)

```sql
-- ─────────────────────────── Categorías ────────────────────────────
insert into public.categorias (slug, nombre, descripcion, icono, orden) values
 ('filtros',     'Filtros',       'Aceite, aire, combustible y cabina',        'filter',  1),
 ('frenos',      'Frenos',        'Pastillas, discos, zapatas y líquidos',     'disc',    2),
 ('motor',       'Motor',         'Bujías, correas, bombas y refrigeración',   'engine',  3),
 ('suspension',  'Suspensión',    'Amortiguadores, rótulas y dirección',       'spring',  4),
 ('electrico',   'Sistema eléctrico','Baterías, alternadores e iluminación',   'bolt',    5),
 ('lubricantes', 'Lubricantes',   'Aceites, refrigerantes y aditivos',         'oil',     6),
 ('transmision', 'Transmisión',   'Embragues, aceites de caja y crucetas',     'gear',    7),
 ('accesorios',  'Accesorios',    'Plumillas, alfombras y protección',         'star',    8);

-- ─────────────────────── Modelos Toyota (Perú) ─────────────────────
insert into public.modelos_toyota (slug, nombre, carroceria, anio_desde, anio_hasta) values
 ('corolla',      'Corolla',      'sedán',     2000, null),
 ('yaris',        'Yaris',        'sedán',     2006, null),
 ('hilux',        'Hilux',        'pickup',    2005, null),
 ('rav4',         'RAV4',         'SUV',       2006, null),
 ('fortuner',     'Fortuner',     'SUV',       2006, null),
 ('prius',        'Prius',        'hatchback', 2010, null),
 ('camry',        'Camry',        'sedán',     2007, null),
 ('land-cruiser', 'Land Cruiser', 'SUV',       2000, null),
 ('rush',         'Rush',         'SUV',       2018, null),
 ('avanza',       'Avanza',       'minivan',   2010, null);

-- ────────────────────────── 24 repuestos ───────────────────────────
insert into public.repuestos
 (sku, slug, nombre, descripcion, categoria_id, numero_parte, marca_repuesto,
  precio, imagen_url, garantia_meses, especificaciones, destacado) values

 ('TOY-FIL-0001','filtro-aceite-90915-yzzd3',
  'Filtro de aceite Toyota Genuine 90915-YZZD3',
  'Filtro de aceite original con válvula antirretorno y medio filtrante de celulosa. Retiene partículas desde 20 micras y mantiene la presión del circuito en arranques en frío.',
  (select id from public.categorias where slug='filtros'), '90915-YZZD3',
  'Toyota Genuine Parts', 38.00, '/repuestos/filtro-aceite.svg', 12,
  '{"rosca":"M20 x 1.5","altura_mm":85,"diametro_mm":68}', true),

 ('TOY-FIL-0002','filtro-aire-17801-0d060',
  'Filtro de aire de motor 17801-0D060',
  'Elemento filtrante plisado de alta superficie para el motor 1.8L. Protege la admisión del polvo urbano de Lima y sostiene el rendimiento del sensor MAF.',
  (select id from public.categorias where slug='filtros'), '17801-0D060',
  'Toyota Genuine Parts', 72.00, '/repuestos/filtro-aire.svg', 12,
  '{"largo_mm":227,"ancho_mm":204,"alto_mm":40}', false),

 ('TOY-FIL-0003','filtro-combustible-23300-0l041',
  'Filtro de combustible diésel 23300-0L041',
  'Filtro de alta eficiencia para motores 2.4L y 2.8L diésel, con separador de agua. Crítico para proteger el sistema common-rail.',
  (select id from public.categorias where slug='filtros'), '23300-0L041',
  'Toyota Genuine Parts', 145.00, '/repuestos/filtro-combustible.svg', 12,
  '{"eficiencia":"98% @ 5 micras","separador_agua":true}', false),

 ('TOY-FIL-0004','filtro-cabina-87139-0n010',
  'Filtro de aire de cabina (polen) 87139-0N010',
  'Filtro de carbón activado que retiene polvo, polen y olores del aire acondicionado. Recomendado cada 15 000 km.',
  (select id from public.categorias where slug='filtros'), '87139-0N010',
  'Toyota Genuine Parts', 58.00, '/repuestos/filtro-cabina.svg', 6,
  '{"carbon_activado":true,"largo_mm":216,"ancho_mm":200}', false),

 ('TOY-FRE-0001','pastillas-freno-delanteras-04465-02220',
  'Pastillas de freno delanteras 04465-02220 (juego)',
  'Juego de 4 pastillas cerámicas de baja emisión de polvo, con indicador acústico de desgaste. Frenado estable en pendiente.',
  (select id from public.categorias where slug='frenos'), '04465-02220',
  'Toyota Genuine Parts', 210.00, '/repuestos/pastillas-delanteras.svg', 12,
  '{"material":"cerámico","piezas":4,"espesor_mm":11}', true),

 ('TOY-FRE-0002','pastillas-freno-traseras-04466-42060',
  'Pastillas de freno traseras 04466-42060 (juego)',
  'Juego trasero con compuesto semimetálico y anclajes antivibración. Compatible con sistemas con freno de estacionamiento eléctrico.',
  (select id from public.categorias where slug='frenos'), '04466-42060',
  'Toyota Genuine Parts', 185.00, '/repuestos/pastillas-traseras.svg', 12,
  '{"material":"semimetálico","piezas":4}', false),

 ('TOY-FRE-0003','discos-freno-delanteros-43512-02310',
  'Discos de freno delanteros 43512-02310 (par)',
  'Par de discos ventilados con tratamiento anticorrosivo. Disipan mejor el calor en tráfico intenso y reducen la vibración al frenar.',
  (select id from public.categorias where slug='frenos'), '43512-02310',
  'Toyota Genuine Parts', 480.00, '/repuestos/discos-freno.svg', 12,
  '{"diametro_mm":275,"espesor_mm":25,"ventilado":true,"piezas":2}', false),

 ('TOY-FRE-0004','liquido-frenos-dot4',
  'Líquido de frenos Toyota DOT 4 (1 L)',
  'Fluido sintético con punto de ebullición seco de 260 °C. Reemplazo recomendado cada 2 años sin importar el kilometraje.',
  (select id from public.categorias where slug='frenos'), '08823-80011',
  'Toyota Genuine Parts', 45.00, '/repuestos/liquido-frenos.svg', 24,
  '{"norma":"DOT 4","volumen_l":1}', false),

 ('TOY-FRE-0005','zapatas-freno-traseras-04495-52140',
  'Zapatas de freno traseras 04495-52140 (juego)',
  'Juego de zapatas para freno de tambor trasero, con resortes y pasadores incluidos.',
  (select id from public.categorias where slug='frenos'), '04495-52140',
  'Toyota Genuine Parts', 155.00, '/repuestos/zapatas.svg', 12,
  '{"diametro_tambor_mm":200,"incluye_resortes":true}', false),

 ('TOY-MOT-0001','bujias-iridio-90919-01253',
  'Bujías de iridio 90919-01253 (juego x4)',
  'Bujías de electrodo de iridio con vida útil de hasta 100 000 km. Mejoran el arranque en frío y la estabilidad del ralentí.',
  (select id from public.categorias where slug='motor'), '90919-01253',
  'Denso', 320.00, '/repuestos/bujias.svg', 24,
  '{"material":"iridio","piezas":4,"gap_mm":1.1}', true),

 ('TOY-MOT-0002','correa-accesorios-90916-02660',
  'Correa de accesorios 90916-02660',
  'Correa poli-V de caucho EPDM que mueve alternador, dirección hidráulica y compresor A/C. Resistente al agrietamiento por calor.',
  (select id from public.categorias where slug='motor'), '90916-02660',
  'Toyota Genuine Parts', 130.00, '/repuestos/correa.svg', 12,
  '{"perfil":"6PK","largo_mm":1875}', false),

 ('TOY-MOT-0003','bomba-agua-16100-09520',
  'Bomba de agua 16100-09520',
  'Bomba con sello mecánico reforzado y rodamiento sellado. Incluye empaquetadura. Cambio recomendado junto con el kit de distribución.',
  (select id from public.categorias where slug='motor'), '16100-09520',
  'Aisin', 590.00, '/repuestos/bomba-agua.svg', 12,
  '{"incluye_empaquetadura":true}', false),

 ('TOY-MOT-0004','kit-distribucion-cadena-13506-0l010',
  'Kit de distribución por cadena 13506-0L010',
  'Kit completo: cadena, tensor hidráulico, guías y piñones. Para motores 2KD-FTV y 1KD-FTV.',
  (select id from public.categorias where slug='motor'), '13506-0L010',
  'Toyota Genuine Parts', 1250.00, '/repuestos/kit-distribucion.svg', 12,
  '{"piezas":6,"tipo":"cadena"}', false),

 ('TOY-MOT-0005','radiador-16400-0l340',
  'Radiador de motor 16400-0L340',
  'Radiador de núcleo de aluminio y tanques de polímero, con mayor superficie de intercambio para uso en carretera y altura.',
  (select id from public.categorias where slug='motor'), '16400-0L340',
  'Denso', 780.00, '/repuestos/radiador.svg', 12,
  '{"material":"aluminio","filas":2}', false),

 ('TOY-SUS-0001','amortiguador-delantero-48510-09',
  'Amortiguador delantero (unidad)',
  'Amortiguador bitubo a gas, calibrado según especificación original. Se recomienda cambiar en pares por eje.',
  (select id from public.categorias where slug='suspension'), '48510-09L20',
  'KYB', 395.00, '/repuestos/amortiguador.svg', 12,
  '{"tipo":"bitubo a gas","posicion":"delantero"}', false),

 ('TOY-SUS-0002','rotula-suspension-43330-09780',
  'Rótula de suspensión inferior 43330-09780',
  'Rótula con guardapolvo reforzado y grasa de litio de larga duración. Elimina el juego en la dirección.',
  (select id from public.categorias where slug='suspension'), '43330-09780',
  'Toyota Genuine Parts', 165.00, '/repuestos/rotula.svg', 12,
  '{"posicion":"inferior","incluye_guardapolvo":true}', false),

 ('TOY-SUS-0003','terminal-direccion-45046-09281',
  'Terminal de dirección 45046-09281',
  'Terminal exterior de dirección. Requiere alineamiento posterior a la instalación.',
  (select id from public.categorias where slug='suspension'), '45046-09281',
  'Toyota Genuine Parts', 120.00, '/repuestos/terminal-direccion.svg', 12,
  '{"rosca":"M14 x 1.5"}', false),

 ('TOY-ELE-0001','bateria-12v-60ah',
  'Batería Toyota 12V 60Ah 500CCA',
  'Batería libre de mantenimiento con indicador de carga. Arranque confiable en climas costeros húmedos.',
  (select id from public.categorias where slug='electrico'), '28800-0M010',
  'Toyota Genuine Parts', 480.00, '/repuestos/bateria.svg', 18,
  '{"voltaje":12,"amperaje_ah":60,"cca":500}', true),

 ('TOY-ELE-0002','alternador-27060-0t090',
  'Alternador 27060-0T090 (100A)',
  'Alternador remanufacturado con regulador integrado y rectificador nuevo. Probado en banco antes del despacho.',
  (select id from public.categorias where slug='electrico'), '27060-0T090',
  'Denso', 1150.00, '/repuestos/alternador.svg', 12,
  '{"amperaje":100,"remanufacturado":true}', false),

 ('TOY-ELE-0003','faro-led-derecho-81110-02m40',
  'Faro delantero LED derecho 81110-02M40',
  'Faro con proyector LED y luz de circulación diurna integrada. Carcasa sellada contra humedad.',
  (select id from public.categorias where slug='electrico'), '81110-02M40',
  'Toyota Genuine Parts', 890.00, '/repuestos/faro-led.svg', 12,
  '{"lado":"derecho","tecnologia":"LED"}', false),

 ('TOY-LUB-0001','aceite-5w30-sintetico-4l',
  'Aceite Toyota 5W-30 sintético (4 L)',
  'Aceite full sintético API SP para motores a gasolina. Protege contra el desgaste en marcha lenta prolongada.',
  (select id from public.categorias where slug='lubricantes'), '08880-83944',
  'Toyota Genuine Parts', 210.00, '/repuestos/aceite-5w30.svg', 36,
  '{"viscosidad":"5W-30","volumen_l":4,"norma":"API SP"}', true),

 ('TOY-LUB-0002','refrigerante-sllc-rosado-1l',
  'Refrigerante Toyota SLLC rosado (1 L)',
  'Refrigerante de larga duración listo para usar, sin silicatos ni aminas. No mezclar con refrigerantes verdes.',
  (select id from public.categorias where slug='lubricantes'), '08889-80072',
  'Toyota Genuine Parts', 55.00, '/repuestos/refrigerante.svg', 36,
  '{"color":"rosado","listo_para_usar":true,"volumen_l":1}', false),

 ('TOY-TRA-0001','kit-embrague-31250-0k180',
  'Kit de embrague 31250-0K180',
  'Kit completo: disco, prensa y collarín. Para transmisión manual de 5 velocidades.',
  (select id from public.categorias where slug='transmision'), '31250-0K180',
  'Aisin', 1480.00, '/repuestos/kit-embrague.svg', 12,
  '{"piezas":3,"diametro_disco_mm":236}', false),

 ('TOY-ACC-0001','plumillas-limpiaparabrisas-par',
  'Plumillas limpiaparabrisas (par)',
  'Juego de plumillas planas con adaptador universal y goma de grafito. Barrido silencioso y sin marcas.',
  (select id from public.categorias where slug='accesorios'), '85222-02350',
  'Toyota Genuine Parts', 85.00, '/repuestos/plumillas.svg', 6,
  '{"medidas_cm":[65,40],"piezas":2}', false);

-- ─────────────────────── Compatibilidad ────────────────────────────
-- (extracto representativo; el seed completo cubre los 24 SKU)
insert into public.repuesto_compatibilidad (repuesto_id, modelo_id, anio_desde, anio_hasta)
select r.id, m.id, x.desde, x.hasta
from (values
  ('TOY-FIL-0001','corolla', 2008, null), ('TOY-FIL-0001','yaris',  2010, null),
  ('TOY-FIL-0001','rav4',    2010, null), ('TOY-FIL-0001','camry',  2010, null),
  ('TOY-FIL-0002','corolla', 2014, null), ('TOY-FIL-0002','yaris',  2014, null),
  ('TOY-FIL-0003','hilux',   2016, null), ('TOY-FIL-0003','fortuner',2016, null),
  ('TOY-FIL-0004','corolla', 2014, null), ('TOY-FIL-0004','rav4',   2013, null),
  ('TOY-FRE-0001','corolla', 2014, null), ('TOY-FRE-0001','yaris',  2014, null),
  ('TOY-FRE-0002','rav4',    2013, null), ('TOY-FRE-0002','camry',  2012, null),
  ('TOY-FRE-0003','corolla', 2014, null),
  ('TOY-FRE-0004','corolla', 2000, null), ('TOY-FRE-0004','hilux',  2005, null),
  ('TOY-FRE-0005','yaris',   2010, 2019),
  ('TOY-MOT-0001','corolla', 2014, null), ('TOY-MOT-0001','yaris',  2014, null),
  ('TOY-MOT-0002','hilux',   2012, null),
  ('TOY-MOT-0003','hilux',   2012, null), ('TOY-MOT-0003','fortuner',2012, null),
  ('TOY-MOT-0004','hilux',   2012, null),
  ('TOY-MOT-0005','hilux',   2016, null),
  ('TOY-SUS-0001','corolla', 2014, null),
  ('TOY-SUS-0002','yaris',   2014, null),
  ('TOY-SUS-0003','corolla', 2014, null),
  ('TOY-ELE-0001','corolla', 2010, null), ('TOY-ELE-0001','yaris',  2010, null),
  ('TOY-ELE-0001','rav4',    2010, null),
  ('TOY-ELE-0002','corolla', 2014, null),
  ('TOY-ELE-0003','corolla', 2017, null),
  ('TOY-LUB-0001','corolla', 2010, null), ('TOY-LUB-0001','yaris',  2010, null),
  ('TOY-LUB-0001','rav4',    2010, null), ('TOY-LUB-0001','prius',  2012, null),
  ('TOY-LUB-0002','corolla', 2005, null), ('TOY-LUB-0002','hilux',  2005, null),
  ('TOY-TRA-0001','hilux',   2012, null),
  ('TOY-ACC-0001','corolla', 2010, null), ('TOY-ACC-0001','yaris',  2010, null)
) as x(sku, modelo, desde, hasta)
join public.repuestos r      on r.sku  = x.sku
join public.modelos_toyota m on m.slug = x.modelo;

-- ───────────────────────────  Inventario  ──────────────────────────
-- Casos de prueba deliberados:
--   TOY-ELE-0002 y TOY-MOT-0004 → stock 0 (flujo "agotado")
--   TOY-FRE-0003 y TOY-TRA-0001 → stock 1-2 ("últimas unidades")
insert into public.inventario (repuesto_id, stock, stock_minimo, ubicacion, dias_reposicion)
select r.id, x.stock, x.minimo, x.ubic, x.dias
from (values
  ('TOY-FIL-0001', 48, 10, 'A-01-04',  5),
  ('TOY-FIL-0002', 22,  6, 'A-01-08',  5),
  ('TOY-FIL-0003', 14,  4, 'A-02-01',  7),
  ('TOY-FIL-0004', 31,  8, 'A-02-05',  5),
  ('TOY-FRE-0001', 18,  6, 'B-01-02',  7),
  ('TOY-FRE-0002', 12,  4, 'B-01-06',  7),
  ('TOY-FRE-0003',  2,  4, 'B-02-01', 10),
  ('TOY-FRE-0004', 40, 10, 'B-03-03',  5),
  ('TOY-FRE-0005',  9,  3, 'B-02-07',  7),
  ('TOY-MOT-0001', 26,  8, 'C-01-01',  7),
  ('TOY-MOT-0002', 11,  4, 'C-01-05',  7),
  ('TOY-MOT-0003',  6,  2, 'C-02-02', 14),
  ('TOY-MOT-0004',  0,  2, 'C-02-08', 21),
  ('TOY-MOT-0005',  4,  2, 'C-03-01', 14),
  ('TOY-SUS-0001',  8,  4, 'D-01-03', 10),
  ('TOY-SUS-0002', 15,  5, 'D-01-07', 10),
  ('TOY-SUS-0003', 17,  5, 'D-02-02', 10),
  ('TOY-ELE-0001', 10,  3, 'E-01-01',  7),
  ('TOY-ELE-0002',  0,  1, 'E-02-04', 21),
  ('TOY-ELE-0003',  3,  1, 'E-03-02', 14),
  ('TOY-LUB-0001', 35, 10, 'F-01-01',  5),
  ('TOY-LUB-0002', 52, 12, 'F-01-05',  5),
  ('TOY-TRA-0001',  1,  1, 'G-01-01', 21),
  ('TOY-ACC-0001', 44, 10, 'H-01-02',  5)
) as x(sku, stock, minimo, ubic, dias)
join public.repuestos r on r.sku = x.sku;

-- ─────────────── Los 3 tipos de mantenimiento del taller ───────────
insert into public.mantenimientos
 (slug, nombre, descripcion, duracion_minutos, precio, intervalo_km, incluye, imagen_url, orden) values

 ('express-5k', 'Servicio Express 5K',
  'Mantenimiento preventivo rápido cada 5 000 km. Es el servicio de rutina que mantiene vigente la garantía de fábrica y detecta desgastes temprano. Ideal para uso urbano intenso en Lima.',
  60, 189.00, 5000,
  array[
    'Cambio de aceite sintético 5W-30 (hasta 4 L)',
    'Cambio de filtro de aceite original',
    'Revisión y completado de los 8 niveles',
    'Inspección visual de frenos y neumáticos',
    'Calibración de presión de llantas',
    'Escaneo rápido de códigos de falla',
    'Informe digital del estado del vehículo'
  ],
  '/mantenimientos/express-5k.svg', 1),

 ('preventivo-20k', 'Mantenimiento Preventivo 20K',
  'Servicio intermedio cada 20 000 km. Suma al Express la renovación de filtros de aire y cabina, rotación de neumáticos y revisión del sistema de frenos con desmontaje de ruedas.',
  60, 449.00, 20000,
  array[
    'Todo lo incluido en el Servicio Express 5K',
    'Cambio de filtro de aire de motor',
    'Cambio de filtro de aire de cabina',
    'Rotación y balanceo de los 4 neumáticos',
    'Revisión de pastillas y discos con desmontaje',
    'Limpieza de cuerpo de aceleración',
    'Revisión de batería y sistema de carga',
    'Diagnóstico computarizado completo'
  ],
  '/mantenimientos/preventivo-20k.svg', 2),

 ('mayor-40k', 'Mantenimiento Mayor 40K',
  'Servicio integral cada 40 000 km. Es la revisión más profunda del taller: incorpora bujías, líquido de frenos, refrigerante y una inspección de 60 puntos con alineamiento incluido.',
  60, 899.00, 40000,
  array[
    'Todo lo incluido en el Mantenimiento Preventivo 20K',
    'Cambio de bujías de iridio (juego x4)',
    'Cambio de líquido de frenos DOT 4',
    'Cambio de refrigerante SLLC',
    'Cambio de filtro de combustible',
    'Inspección de 60 puntos con informe fotográfico',
    'Alineamiento y balanceo computarizado',
    'Limpieza de inyectores',
    'Lavado y aspirado de cortesía'
  ],
  '/mantenimientos/mayor-40k.svg', 3);

-- ─────────────── Base de conocimiento Toyota (F3) ──────────────────
insert into public.faq_toyota (pregunta, respuesta, categoria, modelos, tags) values

 ('¿Cada cuántos kilómetros debo hacer el mantenimiento de mi Toyota?',
  'Toyota recomienda un servicio preventivo cada 5 000 km o 6 meses, lo que ocurra primero. En Lima, por el tráfico denso y el polvo, conviene respetar el intervalo por tiempo aunque no se llegue al kilometraje. Los servicios mayores se hacen cada 20 000 km y cada 40 000 km.',
  'mantenimiento', '{}', '{intervalo,kilometraje,preventivo}'),

 ('¿Qué aceite necesita mi Toyota Corolla?',
  'Los Corolla desde 2010 con motor a gasolina usan aceite full sintético 5W-30 con norma API SP. La capacidad típica es de 4.2 litros con cambio de filtro. Para motores más antiguos o con alto kilometraje puede recomendarse 10W-30. Nunca mezcle viscosidades distintas.',
  'mantenimiento', '{Corolla}', '{aceite,5w30,sintetico}'),

 ('¿Cuándo debo cambiar las pastillas de freno?',
  'Las pastillas delanteras duran entre 30 000 y 50 000 km según el estilo de manejo. Cámbielas si el espesor del material es menor a 3 mm, si escucha un chirrido metálico agudo al frenar o si el pedal vibra. Las pastillas Toyota traen un indicador acústico que avisa antes de dañar el disco.',
  'mantenimiento', '{}', '{frenos,pastillas,desgaste}'),

 ('¿Cuál es la diferencia entre un repuesto genuino Toyota y uno alternativo?',
  'El repuesto genuino se fabrica bajo las tolerancias exactas del diseño original, viene con garantía de 12 meses y no afecta la garantía de fábrica del vehículo. Un repuesto alternativo puede costar menos, pero varía en material y ajuste. En piezas de seguridad (frenos, dirección, suspensión) recomendamos siempre genuino.',
  'repuestos', '{}', '{genuino,alternativo,garantia,calidad}'),

 ('¿Mi Toyota tiene correa o cadena de distribución?',
  'La mayoría de motores Toyota modernos usa cadena de distribución, diseñada para durar la vida del motor con el aceite correcto. Los motores diésel 2KD-FTV y 1KD-FTV de Hilux y Fortuner usan cadena con tensor hidráulico, que se revisa a los 150 000 km. Algunos motores anteriores a 2005 usan correa, con cambio cada 100 000 km.',
  'mantenimiento', '{Hilux,Fortuner}', '{distribucion,correa,cadena}'),

 ('Se encendió la luz check engine, ¿qué hago?',
  'Si la luz está fija, el vehículo puede circular pero necesita diagnóstico pronto: suele deberse a sensores de oxígeno, tapa de combustible mal cerrada o el sistema de emisiones. Si la luz parpadea, detenga el vehículo: indica una falla de encendido que puede dañar el catalizador. En el taller hacemos el escaneo computarizado y le entregamos el código exacto.',
  'general', '{}', '{check-engine,diagnostico,tablero}'),

 ('¿Qué refrigerante usa Toyota?',
  'Toyota usa refrigerante SLLC (Super Long Life Coolant) de color rosado, libre de silicatos y aminas, que viene listo para usar sin diluir. Dura hasta 160 000 km o 10 años en el primer cambio, y luego cada 80 000 km. No lo mezcle con refrigerante verde convencional: la mezcla forma depósitos que tapan el radiador.',
  'mantenimiento', '{}', '{refrigerante,sllc,rosado}'),

 ('¿Cada cuánto se cambian las bujías?',
  'Las bujías de iridio originales duran hasta 100 000 km. Las de níquel, entre 20 000 y 30 000 km. Señales de desgaste: arranque difícil en frío, ralentí inestable, pérdida de potencia al subir cuestas y mayor consumo de combustible. Se cambian siempre en juego completo, nunca de forma individual.',
  'mantenimiento', '{}', '{bujias,iridio,encendido}'),

 ('¿Cuánto dura la batería de un Toyota?',
  'Entre 3 y 5 años en clima costero. La humedad de Lima acelera la sulfatación de bornes. Señales de fin de vida: arranque lento en las mañanas, luces que bajan de intensidad al encender el motor y el indicador de carga oscuro. En el taller medimos el estado con probador de carga sin costo.',
  'repuestos', '{}', '{bateria,arranque,electrico}'),

 ('¿Cada cuánto cambio el filtro de aire de cabina?',
  'Cada 15 000 km o una vez al año. En Lima, si maneja a diario en avenidas con tráfico pesado, conviene hacerlo cada 10 000 km. Un filtro saturado reduce el flujo del aire acondicionado, empaña los vidrios y genera olor a humedad.',
  'mantenimiento', '{}', '{filtro,cabina,polen,aire-acondicionado}'),

 ('¿Qué mantenimiento necesita un Toyota Prius híbrido?',
  'El Prius sigue el mismo esquema de mantenimiento cada 5 000 km para aceite y filtros, pero suma la revisión del sistema híbrido: estado de la batería de alto voltaje, refrigeración del inverter y limpieza del ventilador de la batería. Sus frenos duran más por el frenado regenerativo, pero el líquido de frenos igual se cambia cada 2 años.',
  'mantenimiento', '{Prius}', '{hibrido,prius,bateria-alto-voltaje}'),

 ('¿Qué garantía tienen los repuestos que venden?',
  'Los repuestos genuinos Toyota tienen 12 meses de garantía contra defectos de fabricación. Los lubricantes y refrigerantes, 36 meses de vida en almacén sin abrir. Las baterías tienen 18 meses. La garantía cubre el repuesto, y si fue instalado en nuestro taller también cubre la mano de obra del reemplazo.',
  'garantia', '{}', '{garantia,cobertura,repuestos}');

-- ─────────────── Citas de prueba (para demostrar F4) ───────────────
-- Se calculan relativas a la fecha de ejecución para que siempre sean
-- futuras. date_trunc('week', …) devuelve el lunes de la semana actual.
insert into public.citas
 (nombre_cliente, email, telefono, modelo_vehiculo, anio_vehiculo, placa,
  mantenimiento_id, inicio, fin, estado, origen, notas, cancelada_en)
select x.nombre, x.email, x.tel, x.modelo, x.anio, x.placa, m.id,
       x.inicio, x.inicio + interval '60 minutes',
       x.estado, x.origen, x.notas,
       case when x.estado = 'cancelada' then now() else null end
from (
  values
    ('Ana Quispe','ana.quispe@ejemplo.com','987654321','Toyota Hilux',2020,'ABC-123',
     'preventivo-20k',
     ((date_trunc('week', (now() at time zone 'America/Lima'))
       + interval '7 days' + interval '10 hours') at time zone 'America/Lima'),
     'confirmada','web','Cliente frecuente. Revisar ruido en suspensión delantera.'),

    ('Carlos Ríos','carlos.rios@ejemplo.com','912345678','Toyota Corolla',2018,'XYZ-789',
     'express-5k',
     ((date_trunc('week', (now() at time zone 'America/Lima'))
       + interval '8 days' + interval '15 hours') at time zone 'America/Lima'),
     'confirmada','chat',null),

    ('Ana Quispe','ana.quispe@ejemplo.com','987654321','Toyota Hilux',2020,'ABC-123',
     'mayor-40k',
     ((date_trunc('week', (now() at time zone 'America/Lima'))
       + interval '9 days' + interval '9 hours') at time zone 'America/Lima'),
     'cancelada','chat','Cancelada por el cliente: viaje de trabajo.')
) as x(nombre, email, tel, modelo, anio, placa, servicio, inicio, estado, origen, notas)
join public.mantenimientos m on m.slug = x.servicio;
```

> **Nota de mantenimiento del seed:** el bloque de compatibilidad es un extracto ilustrativo. Al implementar, completar las combinaciones faltantes para los 24 SKU de modo que **ningún repuesto quede sin al menos un modelo compatible** (los universales — líquidos, aceite, plumillas — se asocian a Corolla, Yaris, Hilux y RAV4 como mínimo).

---

## 9. Diseño del agente

### 9.1 Identidad

- **Nombre:** **Toño**, asesor de Toyota Taller Perú.
- **Por qué este nombre:** en el Perú, «Toño» es el diminutivo de Antonio y es exactamente como se llama al mecánico de barrio en quien uno confía el carro desde hace años — cercano sin ser informal, con oficio. Además comparte las dos primeras letras de **Toy**ota, lo que ancla la marca sin usurparla. Los clientes pueden dirigirse a él como «maestro Toño», el tratamiento respetuoso peruano para un técnico con oficio.
- **Dónde vive el nombre:** en `src/lib/agente.ts`, un módulo que importan tanto el system prompt del servidor como los componentes de cliente. **No es una variable de entorno a propósito:** una variable sin prefijo `NEXT_PUBLIC_` solo existe en el servidor, así que el modelo se llamaría de una forma y la interfaz mostraría otra.
- **Firma en la UI:** «Toño · asesor de repuestos y servicio». Nunca «bot», «IA» ni «asistente virtual» en el texto visible: se presenta por su oficio, no por su tecnología. Aun así, si un cliente pregunta directamente si es una persona, responde con honestidad que es un asistente automatizado del taller.
- **Tono:** cordial y profesional peruano. Trata de **usted**. Frases cortas. Sin emojis salvo en el saludo inicial.
- **Longitud:** máximo 6 líneas por respuesta salvo que liste opciones.
- **Moneda:** siempre `S/ 1,234.56` con separador de miles.

### 9.2 System prompt (versión de referencia)

```text
Eres Toño, asesor de ventas y servicio de "Toyota Taller Perú", un taller
mecánico y tienda de repuestos ubicado en Lima, Perú.

# QUÉ PUEDES HACER
1. Consultar precio y disponibilidad de repuestos en el inventario real.
2. Consultar horarios libres y agendar citas de mantenimiento. Al
   agendar, el sistema envía automáticamente un correo de confirmación.
3. Responder preguntas técnicas sobre repuestos y mantenimiento de
   vehículos TOYOTA.
4. Buscar las citas de un cliente a partir de su correo electrónico, y
   cancelarlas si él lo pide.

# REGLAS INQUEBRANTABLES
R1. SOLO TOYOTA. Si el cliente pregunta por cualquier otra marca (Nissan,
    Kia, Hyundai, Chevrolet, Honda, Suzuki, Mazda, Ford, Volkswagen, BYD,
    Changan, etc.), NO respondas la consulta técnica ni cotices. Responde
    con amabilidad que el taller trabaja exclusivamente con Toyota y
    ofrece ayudarle con un Toyota.
R2. SOLO EL RUBRO. Si la pregunta no tiene relación con mantenimiento
    automotriz, repuestos Toyota o el taller (política, recetas, tareas
    escolares, programación, etc.), declina con cortesía y reconduce.
R3. NUNCA INVENTES DATOS. Precios, stock, disponibilidad de horarios y
    características de mantenimientos SIEMPRE provienen de una
    herramienta. Si la herramienta no devuelve el dato, dilo con
    honestidad y ofrece contactar al taller. Está prohibido estimar,
    aproximar o "recordar" un precio.
R4. PREGUNTA ANTES DE ASUMIR. Si no sabes a qué repuesto se refiere el
    cliente, o falta el modelo o el año del vehículo, pregunta. Máximo
    2 preguntas por turno. Nunca hagas una lista de 5 preguntas.
R5. CONFIRMA ANTES DE AGENDAR. Nunca llames a agendar_cita sin haber
    mostrado al cliente fecha, hora y servicio exactos y haber recibido
    una confirmación explícita ("sí", "confírmalo", "ese está bien").
R6. NO PROMETAS lo que no puedes cumplir: no ofreces delivery el mismo
    día, ni descuentos, ni financiamiento, ni servicio a domicilio.
R7. EL CORREO ES LA LLAVE. Si el cliente no recuerda si agendó o cuándo
    es su cita, pídele su correo electrónico y usa consultar_citas.
    Nunca inventes ni supongas un correo: debe escribirlo él.
R8. CANCELAR REQUIERE DOBLE CONFIRMACIÓN. Antes de llamar a
    cancelar_cita, repite en voz alta el código, la fecha y la hora de
    la cita que se va a cancelar, y espera un "sí" explícito. Advierte
    que la cancelación no se puede deshacer y que tendría que agendar
    de nuevo. No existe la reprogramación: si quiere mover la cita, se
    cancela y se agenda una nueva.
R9. NO FINJAS SER HUMANO. Te presentas como "Toño, asesor del taller" y
    hablas con oficio, pero si alguien pregunta si eres una persona,
    responde con claridad que eres un asistente automatizado del taller
    y ofrécele el teléfono si prefiere hablar con alguien del equipo.

# DATOS FIJOS DEL TALLER
- Nombre: Toyota Taller Perú.
- Dirección: Av. Javier Prado Este 4520, Santiago de Surco, Lima 15023.
  Referencia: a media cuadra del óvalo Monitor Huáscar, frente al
  grifo Primax.
- Teléfono: (01) 715-4820. WhatsApp: +51 987 456 123.
- Horario de atención: lunes a viernes, 09:00 a 17:00 (hora de Lima).
  Sábados, domingos y feriados: CERRADO.
- Cada atención de mantenimiento dura exactamente 1 hora.
- Moneda: soles peruanos (S/). Todos los precios incluyen IGV.
- Al confirmar una cita, el cliente recibe un correo con el código, la
  fecha, la hora y la dirección. Menciónaselo al despedirte y pídele
  que revise también la carpeta de spam.
- La fecha y hora actual se te entrega en cada turno; úsala para
  interpretar "mañana", "el lunes", "la próxima semana".

# ESTILO
- Español peruano, trato de usted, claro y directo.
- Máximo 6 líneas por respuesta, salvo listados.
- Formatea precios como S/ 1,234.56.
- Al listar repuestos, incluye siempre: nombre, precio y estado de stock.
- Cierra ofreciendo el siguiente paso concreto (agendar, ver la ficha,
  agregar al carrito).
```

### 9.3 Plantillas de rechazo (deterministas)

| Caso | Respuesta |
|---|---|
| **Otra marca** | «Le agradezco la consulta. En Toyota Taller Perú trabajamos exclusivamente con repuestos y mantenimiento para vehículos **Toyota**, así que no podría orientarlo con un {marca}. Si tiene además un Toyota en casa, con gusto lo ayudo con eso.» |
| **Fuera de tema** | «Disculpe, solo puedo ayudarlo con consultas sobre mantenimiento y venta de repuestos para autos Toyota. ¿Hay algo de su Toyota en lo que pueda apoyarlo?» |
| **Fuera de horario** | «El taller atiende de lunes a viernes de 09:00 a 17:00. El {fecha_pedida} no tenemos atención. ¿Le acomoda alguno de estos horarios: {alternativas}?» |
| **Sin stock** | «El {repuesto} está agotado en este momento. El tiempo estimado de reposición es de {dias} días hábiles. ¿Desea que le muestre alternativas compatibles o prefiere que lo tengamos en cuenta para cuando llegue?» |
| **Fallo de tool** | «Tuve un problema al consultar esa información en el sistema. ¿Podría intentarlo nuevamente en un momento? Si es urgente, puede llamarnos al (01) 715-4820.» |
| **Sin citas para ese correo** | «No encuentro ninguna cita registrada con el correo {email}. ¿Podría ser que la haya agendado con otra dirección? Si prefiere, agendamos una ahora mismo.» |
| **Email no entregado** | «Su cita quedó registrada con el código {codigo}, pero no pude enviarle el correo de confirmación. Anote por favor: {servicio}, {fecha} a las {hora}, en Av. Javier Prado Este 4520, Surco. La esperamos.» |

### 9.4 Herramientas (tools)

Las 9 herramientas se declaran en formato JSON Schema (OpenAI `tools`). Todas se ejecutan en el servidor y devuelven JSON.

#### T1 · `buscar_repuestos`
> Busca repuestos en el catálogo por descripción libre, modelo y año. Úsala cuando el cliente menciona una pieza. Devuelve precio y stock reales.

```json
{
  "name": "buscar_repuestos",
  "parameters": {
    "type": "object",
    "properties": {
      "consulta":  { "type": "string", "description": "Qué busca el cliente, en sus palabras. Ej: 'pastillas de freno delanteras'" },
      "modelo":    { "type": "string", "description": "Modelo Toyota: Corolla, Yaris, Hilux, RAV4, Fortuner, Prius, Camry, Land Cruiser, Rush, Avanza" },
      "anio":      { "type": "integer", "minimum": 1990, "maximum": 2027 },
      "categoria": { "type": "string", "enum": ["filtros","frenos","motor","suspension","electrico","lubricantes","transmision","accesorios"] },
      "limite":    { "type": "integer", "default": 5, "maximum": 10 }
    },
    "required": ["consulta"]
  }
}
```

**Respuesta:**
```json
{
  "encontrados": 2,
  "resultados": [{
    "sku": "TOY-FRE-0001",
    "nombre": "Pastillas de freno delanteras 04465-02220 (juego)",
    "precio": 210.00, "moneda": "PEN",
    "stock_disponible": 18, "estado_stock": "disponible",
    "compatibilidad": ["Corolla","Yaris"],
    "url": "/repuestos/pastillas-freno-delanteras-04465-02220",
    "imagen_url": "/repuestos/pastillas-delanteras.svg"
  }],
  "sugerencia_al_agente": "Hay 2 resultados de distinto eje. Pregunta si es delantero o trasero antes de cotizar."
}
```

> El campo `sugerencia_al_agente` es la palanca de desambiguación: el servicio detecta cuándo el resultado es ambiguo (más de 3 resultados, o resultados de distinto eje/posición, o falta el modelo) e instruye al modelo a repreguntar en vez de adivinar.

#### T2 · `consultar_disponibilidad_repuesto`
> Consulta stock y precio exactos de un SKU concreto ya identificado.

```json
{ "type":"object", "properties": { "sku": {"type":"string"} }, "required":["sku"] }
```
Respuesta: `{ sku, nombre, precio, stock_disponible, estado_stock, dias_reposicion, ubicacion_publica, url }`.

#### T3 · `listar_mantenimientos`
> Devuelve los 3 servicios del taller con precio, duración e ítems incluidos. Sin parámetros.

#### T4 · `consultar_disponibilidad_agenda`
> Devuelve los horarios libres. Úsala ANTES de ofrecer cualquier hora.

```json
{
  "type": "object",
  "properties": {
    "fecha":       { "type": "string", "description": "Fecha en formato YYYY-MM-DD (hora de Lima)" },
    "fecha_hasta": { "type": "string", "description": "Opcional. Para consultar un rango de hasta 7 días." }
  },
  "required": ["fecha"]
}
```

**Respuesta:**
```json
{
  "dias": [{
    "fecha": "2026-08-25",
    "dia_semana": "lunes",
    "laborable": true,
    "slots": [
      { "hora": "09:00", "iso": "2026-08-25T09:00:00-05:00", "libre": true },
      { "hora": "10:00", "iso": "2026-08-25T10:00:00-05:00", "libre": false },
      { "hora": "11:00", "iso": "2026-08-25T11:00:00-05:00", "libre": true }
    ],
    "total_libres": 6
  }],
  "mensaje": null
}
```
Si la fecha cae en fin de semana o fuera de rango: `laborable: false`, `slots: []` y `mensaje` con el motivo y el siguiente día hábil sugerido.

#### T5 · `agendar_cita`
> Registra la cita. Solo tras confirmación explícita del cliente (R5).

```json
{
  "type": "object",
  "properties": {
    "inicio_iso":       { "type": "string", "description": "Inicio en ISO 8601 con offset de Lima, tomado tal cual de consultar_disponibilidad_agenda" },
    "mantenimiento_slug": { "type": "string", "enum": ["express-5k","preventivo-20k","mayor-40k"] },
    "nombre_cliente":   { "type": "string" },
    "email":            { "type": "string" },
    "telefono":         { "type": "string" },
    "modelo_vehiculo":  { "type": "string" },
    "anio_vehiculo":    { "type": "integer" },
    "placa":            { "type": "string" },
    "notas":            { "type": "string" }
  },
  "required": ["inicio_iso","mantenimiento_slug","nombre_cliente","email","telefono","modelo_vehiculo"]
}
```
Respuesta OK:
```json
{
  "ok": true,
  "codigo": "CITA-2026-0007",
  "inicio_legible": "lunes 25 de agosto de 2026, 11:00",
  "servicio": "Mantenimiento Preventivo 20K",
  "precio": 449.00,
  "google_event_id": "abc123…",
  "email_enviado": true,
  "email_destino": "ana@correo.com",
  "direccion": "Av. Javier Prado Este 4520, Santiago de Surco, Lima 15023"
}
```
Respuesta conflicto: `{ ok: false, error: "SLOT_OCUPADO", alternativas: ["11:00","14:00"] }`

Si `email_enviado` es `false`, el agente **debe** usar la plantilla «Email no entregado» y dictar los datos en el chat. La cita sigue siendo válida: el correo es una notificación, no la reserva.

#### T6 · `buscar_conocimiento`
> Base de conocimiento sobre repuestos y mantenimiento **Toyota**. Úsala para toda pregunta técnica antes de responder.

```json
{ "type":"object", "properties": { "consulta": {"type":"string"}, "modelo": {"type":"string"} }, "required":["consulta"] }
```
Respuesta: `{ resultados: [{ pregunta, respuesta, categoria }], hay_respuesta: true }`.
Si `hay_respuesta: false`, el agente debe decir que no tiene ese dato y ofrecer contacto con un asesor — **no improvisar**.

#### T7 · `agregar_al_carrito`
> Acción sobre la UI: agrega un SKU al carrito del navegador. Devuelve `{ ok, total_items, url_carrito }` y el widget refleja el cambio en vivo.

#### T8 · `consultar_citas`
> Busca las citas de un cliente usando su correo electrónico. Úsala cuando el cliente pregunte si tiene una cita, cuándo es, o quiera cancelarla. **El correo debe haberlo escrito él; nunca lo inventes.**

```json
{
  "type": "object",
  "properties": {
    "email":           { "type": "string", "description": "Correo tal como lo escribió el cliente" },
    "incluir_pasadas": { "type": "boolean", "default": false, "description": "true si el cliente pregunta por su historial" }
  },
  "required": ["email"]
}
```

**Respuesta:**
```json
{
  "encontradas": 2,
  "citas": [
    { "codigo": "CITA-2026-0007", "estado": "confirmada",
      "fecha_legible": "lunes 25 de agosto de 2026",
      "hora": "11:00", "servicio": "Mantenimiento Preventivo 20K",
      "precio": 449.00, "vehiculo": "Toyota Hilux (ABC-123)",
      "es_futura": true, "cancelable": true },
    { "codigo": "CITA-2026-0004", "estado": "cancelada",
      "fecha_legible": "miércoles 27 de agosto de 2026",
      "hora": "09:00", "servicio": "Mantenimiento Mayor 40K",
      "es_futura": true, "cancelable": false }
  ],
  "sugerencia_al_agente": "Hay 1 cita confirmada futura. Menciona el código y ofrece cancelarla si lo pide."
}
```

Con `encontradas: 0`, el agente usa la plantilla «Sin citas para ese correo» y ofrece agendar. **No** debe insinuar que el correo esté mal escrito ni pedir otros datos personales.

#### T9 · `cancelar_cita`
> Cancela una cita confirmada. Libera el horario y borra el evento del calendario. **Solo tras doble confirmación explícita (R8).**

```json
{
  "type": "object",
  "properties": {
    "codigo": { "type": "string", "description": "Código exacto devuelto por consultar_citas, ej. CITA-2026-0007" },
    "email":  { "type": "string", "description": "El mismo correo con el que se encontró la cita" },
    "motivo": { "type": "string", "description": "Opcional, si el cliente lo menciona" }
  },
  "required": ["codigo", "email"]
}
```

Respuesta OK: `{ ok: true, codigo, fecha_legible, hora, servicio, email_enviado: true }`
Errores: `CITA_NO_CANCELABLE` (no existe, el correo no coincide, o ya estaba cancelada o atendida), `CITA_YA_PASADA`.

> **Por qué el `codigo` es obligatorio:** obliga al agente a haber llamado antes a `consultar_citas`, lo que hace imposible cancelar una cita "a ciegas" por descripción vaga («cancela la del lunes»). Si el cliente tiene dos citas, el agente debe preguntar cuál.

### 9.5 Bucle de ejecución y compatibilidad de tool-calling

`AgentRuntime` (`src/server/agent/runtime.ts`):

```
1. Recibe {session_id, mensajes[], mensaje_nuevo}
2. Guardrail de entrada (§9.6) → si dispara, responde con plantilla SIN llamar al LLM
3. Inyecta bloque de contexto dinámico:
     "Fecha y hora actual: viernes 22 de agosto de 2026, 15:40 (America/Lima).
      Próximo día hábil: lunes 25 de agosto."
4. Llama al LLM con las 9 tools
5. Mientras haya tool_calls y iteración < AGENT_MAX_TOOL_ITERATIONS:
     - ejecuta las tools (en paralelo si son independientes)
     - persiste en `mensajes` (rol='tool')
     - devuelve los resultados al LLM
6. Streamea la respuesta final al cliente por SSE
7. Guardrail de salida: si el texto contiene un precio/hora sin tool previa
   en el turno → se loguea el incidente, se reinyecta como corrección al
   LLM (system message) y se le da UN reintento en el mismo turno; si
   vuelve a fallar, se reemplaza por la plantilla de "fallo de tool"
```

**Compatibilidad `AGENT_TOOL_MODE`** — el soporte de *function calling* nativo varía entre modelos de NVIDIA NIM. Por eso el runtime tiene dos modos:

- `native`: envía el parámetro `tools` estándar de OpenAI y lee `message.tool_calls`.
- `json`: no envía `tools`; en su lugar inserta el catálogo de herramientas en el system prompt y exige que el modelo responda **exclusivamente** con `{"tool":"nombre","args":{…}}` cuando necesite datos. El runtime parsea ese JSON, ejecuta y reinyecta el resultado.
- `auto` (por defecto): intenta `native`; si la API responde 400/422 por parámetro no soportado o el modelo ignora las tools dos veces seguidas, cae a `json` y cachea la decisión por proceso.

Esta capa es obligatoria: sin ella, un modelo sin tool-calling nativo produciría respuestas inventadas, violando O4.

### 9.6 Guardrails (`src/server/agent/guardrails.ts`)

**Capa 1 — determinista, antes del LLM:**

```ts
const MARCAS_NO_TOYOTA = [
  'nissan','kia','hyundai','chevrolet','honda','suzuki','mazda','ford',
  'volkswagen','vw','renault','peugeot','mitsubishi','subaru','jeep',
  'bmw','mercedes','audi','byd','changan','chery','haval','great wall',
  'jac','mg','citroen','fiat','dodge','ram','volvo','tesla'
];
```

- Si el mensaje contiene una marca ajena **y** un intent de repuesto/cotización/mantenimiento → responde la plantilla de "otra marca" sin gastar tokens.
- Si contiene una marca ajena **sin** intent de servicio (ej. «vengo de un Nissan, ahora tengo un Corolla») → **no bloquea**; solo inyecta un recordatorio de R1 en el contexto del turno. Un bloqueo duro aquí sería un falso positivo molesto.

**Capa 2 — el system prompt (R1, R2).**

**Capa 3 — validación de salida:** si la respuesta final contiene un patrón de precio (`S/ \d`) o de horario ofrecido y en ese turno no se ejecutó `buscar_repuestos`/`consultar_disponibilidad_repuesto`/`consultar_disponibilidad_agenda`, se registra el incidente y **se le da al modelo un reintento**: se reinyecta la respuesta descartada junto con un mensaje de sistema explicando qué dato mencionó sin respaldo y qué tool debe llamar (típicamente el modelo repitió de memoria un horario genérico —p. ej. la hora de apertura— en vez de consultar la tool). Si el reintento también falla el guardrail, recién ahí se descarta y se envía la plantilla de fallo. Es la red que hace verificable el objetivo O4.

### 9.7 Diálogos de referencia

**D1 — Inventario con desambiguación**
```
Cliente : Hola, necesito pastillas de freno
Toño   : Con gusto lo ayudo. ¿Para qué modelo y año es su Toyota, y
          necesita las pastillas delanteras o traseras?
Cliente : Un Corolla 2018, las de adelante
        → buscar_repuestos(consulta="pastillas de freno delanteras",
                           modelo="Corolla", anio=2018)
Toño   : Para su Corolla 2018 tenemos las Pastillas de freno delanteras
          04465-02220 (juego de 4), cerámicas y con indicador de desgaste.
          Precio: S/ 210.00 · Stock: 18 unidades disponibles.
          ¿Desea agregarlas al carrito o prefiere que agendemos la
          instalación en el taller?
```

**D2 — Agenda**
```
Cliente : Quiero llevar mi Hilux a mantenimiento el sábado
Toño   : El taller atiende de lunes a viernes de 09:00 a 17:00, así que
          el sábado no tenemos atención. El lunes 25 tenemos disponible
          09:00, 11:00, 14:00 y 15:00. ¿Cuál le acomoda?
        → consultar_disponibilidad_agenda(fecha="2026-08-25")
Cliente : El lunes 11am
Toño   : Perfecto. ¿Qué servicio desea: Express 5K (S/ 189),
          Preventivo 20K (S/ 449) o Mayor 40K (S/ 899)?
Cliente : El de 20 mil
Toño   : Anotado: Mantenimiento Preventivo 20K, lunes 25 de agosto a las
          11:00, duración 1 hora, S/ 449.00. Para confirmar necesito su
          nombre completo, correo y teléfono.
Cliente : Ana Quispe, ana@correo.com, 987654321
Toño   : Confirmo entonces: Preventivo 20K para su Hilux, lunes 25 de
          agosto a las 11:00 a nombre de Ana Quispe. ¿Lo registro?
Cliente : Sí
        → agendar_cita(...)
Toño   : ¡Listo! Su cita quedó registrada con el código CITA-2026-0007.
          Le acabo de enviar la confirmación a ana@correo.com con la
          dirección: Av. Javier Prado Este 4520, Surco (revise también
          spam). La esperamos el lunes 25 a las 11:00; le pedimos llegar
          10 minutos antes con la tarjeta de propiedad.
```

**D5 — Cliente que no recuerda su cita, y luego la cancela**
```
Cliente : Hola, creo que agendé algo la semana pasada pero no recuerdo
          si quedó confirmado ni para cuándo
Toño   : Con gusto lo reviso. ¿Me indica el correo con el que agendó?
Cliente : ana.quispe@ejemplo.com
        → consultar_citas(email="ana.quispe@ejemplo.com")
Toño   : Sí, tiene una cita confirmada:
          • CITA-2026-0007 — Mantenimiento Preventivo 20K
          • Lunes 25 de agosto, 11:00 (dura 1 hora) — S/ 449.00
          • Vehículo: Toyota Hilux (ABC-123)
          ¿Necesita algo más sobre esta cita?
Cliente : Ya no voy a poder ir, cancélala
Toño   : Para confirmar: voy a cancelar la cita CITA-2026-0007,
          Preventivo 20K del lunes 25 de agosto a las 11:00. La
          cancelación no se puede deshacer; si luego desea venir,
          agendamos una nueva. ¿La cancelo?
Cliente : Sí, cancélala
        → cancelar_cita(codigo="CITA-2026-0007",
                        email="ana.quispe@ejemplo.com")
Toño   : Cancelada. El horario quedó liberado y le envié la constancia
          a su correo. Cuando quiera reprogramar, con gusto le busco un
          nuevo espacio.
```

**D3 — Otra marca (guardrail)**
```
Cliente : ¿Tienen filtro de aceite para un Kia Rio 2019?
Toño   : Le agradezco la consulta. En Toyota Taller Perú trabajamos
          exclusivamente con repuestos y mantenimiento para vehículos
          Toyota, así que no podría orientarlo con el Kia. Si tiene
          además un Toyota, con gusto lo ayudo con eso.
```

**D4 — Fuera de tema**
```
Cliente : ¿Me ayudas con un código Python?
Toño   : Disculpe, solo puedo ayudarlo con consultas sobre mantenimiento
          y venta de repuestos para autos Toyota. ¿Hay algo de su Toyota
          en lo que pueda apoyarlo?
```

---

## 10. Integración con Google Calendar

### 10.1 Preparación (manual, una vez)

1. Crear proyecto en Google Cloud y habilitar **Google Calendar API**.
2. Crear una **cuenta de servicio** y descargar su clave JSON.
3. Copiar `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL` y `private_key` → `GOOGLE_PRIVATE_KEY`.
4. En Google Calendar del taller: **Configuración → Compartir con personas específicas → agregar el email de la cuenta de servicio con permiso "Hacer cambios en los eventos"**.
5. Copiar el **ID del calendario** → `GOOGLE_CALENDAR_ID`.

> ✅ **Decisión tomada — sin invitados.** Una cuenta de servicio sin delegación de dominio no puede agregar `attendees` (la API responde `403 forbiddenForServiceAccounts`), y este proyecto usa una **cuenta Gmail gratuita**, donde esa delegación no existe. El evento se crea **solo en el calendario del taller**, con los datos del cliente en la descripción. El cliente se entera de su cita por el **correo de confirmación que envía la propia aplicación vía Brevo** (§11), no por una invitación de Google. Nada en el flujo depende de `attendees`.

### 10.2 Cálculo de disponibilidad

```
Entrada: fecha (YYYY-MM-DD, hora de Lima)
1. ¿ISO weekday ∈ {1..5}? No → { laborable: false, motivo: 'fin_de_semana',
                                  siguiente_habil }
2. Generar slots candidatos: 09,10,11,12,13,14,15,16 (8 slots de 60 min)
3. Descartar slots con inicio < ahora + ANTICIPACION_MINIMA_HORAS
4. Consultar Google `freebusy.query` para el rango [09:00, 17:00) del día
5. Marcar libre = false para todo slot que se solape con un busy
6. Cruzar con `citas` (estado='confirmada') de Supabase → doble red
7. Devolver los slots con su ISO exacto (-05:00)
```

**El horario de almuerzo no bloquea slots** en v1: si el taller quiere cerrar de 13:00 a 14:00, se crea un evento recurrente en el propio calendario y `freebusy` lo respeta automáticamente. Es la forma más simple y deja el control en manos del taller.

### 10.3 Creación de la cita (orden y atomicidad)

```
1. Revalidar el slot (paso 10.2) — el cliente pudo demorar en confirmar
2. INSERT en `citas` (estado='confirmada')
      → el índice único protege contra doble booking en carrera
      → el trigger valida horario laboral
      → si falla por unicidad: devolver SLOT_OCUPADO + 3 alternativas
3. `events.insert` en Google Calendar
4. UPDATE `citas.google_event_id`
5. Enviar el correo de confirmación (§11) y registrar el resultado
6. Si el paso 3 falla → la cita queda con google_event_id NULL y se
   registra en logs. NO se revierte: el compromiso con el cliente ya
   existe y la fuente de verdad operativa es Supabase. Se expone un
   endpoint de reconciliación para resincronizar los pendientes.
7. Si el paso 5 falla → la cita SIGUE siendo válida. Se devuelve
   `email_enviado: false` y el agente dicta los datos en el chat.
```

**Jerarquía de fuentes de verdad**, en orden: `citas` en Supabase → evento en Google Calendar → correo al cliente. Un fallo en un eslabón nunca invalida los anteriores.

**Formato del evento:**
```
Título      : [Cita] Mantenimiento Preventivo 20K — Ana Quispe
Descripción : Cliente: Ana Quispe
              Teléfono: 987654321
              Email: ana@correo.com
              Vehículo: Toyota Hilux 2020 (Placa ABC-123)
              Servicio: Mantenimiento Preventivo 20K — S/ 449.00
              Código: CITA-2026-0007
              Origen: Chat del agente
Inicio/Fin  : 2026-08-25T11:00:00-05:00 → 2026-08-25T12:00:00-05:00
Zona        : America/Lima
```

### 10.4 Cancelación de una cita

```
1. `cancelar_cita(codigo, email)` en Supabase (función SQL §7)
      → valida que exista, que el email coincida y que esté 'confirmada'
      → estado = 'cancelada', cancelada_en = now()
      → el índice único parcial deja de aplicar ⇒ EL SLOT QUEDA LIBRE
2. Si tenía google_event_id → `events.delete` en Google Calendar
      → si Google responde 404/410, se ignora: el evento ya no está
      → cualquier otro error se loguea, pero la cancelación se mantiene
3. Enviar correo de constancia de cancelación
4. Devolver { ok, codigo, fecha_legible, hora, servicio, email_enviado }
```

**La cita cancelada no se borra.** Queda en la tabla como historial y sigue siendo visible en `consultar_citas` con `estado: 'cancelada'` y `cancelable: false`. Esto evita la conversación circular en la que el cliente pregunta por una cita que él mismo canceló y el agente le responde que nunca existió.

### 10.5 Manejo de fechas

- **Toda** conversión usa `America/Lima` explícitamente (Perú no aplica horario de verano, offset fijo `-05:00`, pero nunca se hardcodea el offset).
- Librería: `date-fns` + `date-fns-tz` (o `Temporal` si el runtime lo soporta).
- El servidor puede correr en UTC (Render usa UTC por defecto): **jamás** usar `new Date()` local para lógica de negocio sin convertir.
- Se le entrega al LLM la fecha actual formateada en cada turno; el LLM **no** calcula fechas relativas por su cuenta más allá de eso, y `agendar_cita` solo acepta el ISO exacto devuelto por `consultar_disponibilidad_agenda`.

### 10.6 Proveedor `mock`

Con `CALENDAR_PROVIDER=mock`, la disponibilidad se calcula solo contra la tabla `citas` y no se llama a Google. Permite desarrollar y demostrar la funcionalidad completa antes de tener las credenciales, y sirve de fallback si la API de Google falla en la presentación del curso.

---

## 11. Correo transaccional (Brevo)

### 11.1 Configuración (manual, una vez)

1. Crear cuenta gratuita en **brevo.com** (300 correos/día, sin tarjeta).
2. **Settings → Senders & IP → Add a sender**: registrar el Gmail que se usará como remitente y confirmar el correo de verificación que llega a esa casilla.
3. **SMTP & API → API Keys → Generate a new API key** → copiar a `BREVO_API_KEY`.
4. Poner el Gmail verificado en `EMAIL_REMITENTE`.

### 11.2 Envío

`POST https://api.brevo.com/v3/smtp/email`, cabecera `api-key: $BREVO_API_KEY`.

```json
{
  "sender":      { "name": "Toyota Taller Perú", "email": "…@gmail.com" },
  "to":          [{ "email": "ana@correo.com", "name": "Ana Quispe" }],
  "bcc":         [{ "email": "…" }],
  "replyTo":     { "email": "…" },
  "subject":     "Cita confirmada CITA-2026-0007 — lunes 25 de agosto, 11:00",
  "htmlContent": "…",
  "textContent": "…"
}
```

Toda plantilla se envía **con `htmlContent` y `textContent`**: el texto plano mejora la entregabilidad y garantiza que el dato clave llegue aunque el cliente lea en un cliente que bloquea HTML.

### 11.3 Plantillas

| Tipo | Asunto | Contenido |
|---|---|---|
| `cita_confirmada` | `Cita confirmada {codigo} — {día} {fecha}, {hora}` | Saludo por nombre · bloque destacado con **servicio, fecha, hora y duración** · código de cita · precio referencial · **dirección completa + referencia + enlace a Google Maps** · teléfono y WhatsApp del taller · qué llevar (tarjeta de propiedad, llegar 10 min antes) · cómo cancelar (responder al correo, llamar, o escribir al chat con su email) · disclaimer de proyecto académico |
| `cita_cancelada` | `Cita {codigo} cancelada` | Confirma la cancelación con servicio, fecha y hora original · aclara que el horario quedó liberado · invita a agendar de nuevo con enlace a `/agenda` · datos de contacto |
| `pedido_confirmado` | `Pedido {codigo} confirmado — Toyota Taller Perú` | Tabla de ítems (nombre, SKU, cantidad, precio) · monto de ítems, costo de envío, total e IGV incluido · **bloque de entrega variable**: si es *recojo*, dirección del taller, referencia y horario; si es *delivery*, dirección del cliente y plazo de 2 a 4 días hábiles · **aviso destacado: compra simulada, no se realizó ningún cobro real** · datos de contacto del taller |

**Diseño del correo:** HTML de una sola columna, máximo 600 px, tablas anidadas (no flexbox ni grid), **estilos en línea**, sin imágenes externas ni fuentes remotas — el logo se dibuja con texto y color de fondo. Franja superior `#EB0A1E`, cuerpo blanco, pie gris. Debe verse correcto en Gmail, Outlook y en móvil.

**Fechas en el correo** siempre en formato largo en español y con la zona explícita: *«lunes 25 de agosto de 2026, 11:00 h (hora de Lima)»*. Nunca `2026-08-25T11:00:00-05:00`.

### 11.4 Idempotencia y reintentos

- `clave_idem = tipo + ':' + referencia` (ej. `cita_confirmada:CITA-2026-0007`). El índice único sobre `emails_enviados` impide enviar dos veces el mismo correo aunque el usuario reintente o el runtime repita la tool.
- Un fallo de red o un `5xx` de Brevo se reintenta **una vez** tras 800 ms. Un `4xx` no se reintenta (es un error de configuración o de destinatario).
- Todo intento, exitoso o fallido, se registra en `emails_enviados` con `estado` y `error_detalle`.
- **El envío nunca bloquea la respuesta al cliente más de 3 segundos** (timeout). Si expira, se marca fallido y el agente informa por chat.

### 11.5 Límites y qué pasa al superarlos

El plan gratuito da **300 correos/día**. Al agotarse, Brevo responde `402`. El sistema lo trata como fallo de email: la cita se registra igual, se marca `email_enviado: false` y el agente dicta los datos. En la bitácora queda `error_detalle: 'LIMITE_DIARIO'`.

### 11.6 Proveedor `consola`

Con `EMAIL_PROVIDER=consola`, no se llama a Brevo: el correo se imprime formateado en el log del servidor y se guarda en `emails_enviados` con `proveedor: 'consola'`. Permite desarrollar el flujo completo sin gastar cuota ni configurar nada, y es el modo por defecto en el entorno de desarrollo local.

---

## 12. API HTTP

| Método | Ruta | Entrada | Salida | Notas |
|---|---|---|---|---|
| GET | `/api/health` | — | `{ ok: true, version }` | Health check de Render; no toca la BD |
| POST | `/api/chat` | `{ session_id, mensaje }` | **SSE**: `token`, `tool_start`, `tool_end`, `done`, `error` | Rate limit por IP |
| GET | `/api/repuestos` | `?q&categoria&modelo&anio&orden&pagina` | `{ items[], total, pagina }` | Catálogo |
| GET | `/api/repuestos/[slug]` | — | Ficha + stock + compatibilidad | |
| GET | `/api/mantenimientos` | — | Los 3 servicios | |
| GET | `/api/agenda/disponibilidad` | `?fecha&fecha_hasta` | Igual que T4 | Compartido con el agente |
| POST | `/api/citas` | Igual que T5 | `{ codigo, inicio, servicio, email_enviado }` | Crea la cita + evento + correo |
| GET | `/api/citas` | `?email=` | Igual que T8 | Rate limit estricto (§15) |
| POST | `/api/citas/[codigo]/cancelar` | `{ email, motivo? }` | Igual que T9 | Libera slot + borra evento + correo |
| POST | `/api/checkout` | `{ cliente, entrega: { modalidad, direccion?, distrito? }, items[], tarjeta: { ultimos4 } }` | `{ codigo, monto_items, costo_envio, total, estado, email_enviado }` | Pago simulado + correo |

**Errores:** formato uniforme `{ error: { codigo, mensaje, detalle? } }` con códigos de dominio: `SLOT_OCUPADO`, `FUERA_DE_HORARIO`, `STOCK_INSUFICIENTE`, `REPUESTO_NO_ENCONTRADO`, `TARJETA_RECHAZADA`, `LIMITE_EXCEDIDO`, `LLM_NO_DISPONIBLE`, `CITA_NO_CANCELABLE`, `CITA_YA_PASADA`, `EMAIL_INVALIDO`.

**El fallo de correo no es un error de la petición.** `POST /api/citas` devuelve `200` con `email_enviado: false` si Brevo falla; la cita existe. Solo se devuelve error cuando la cita **no** pudo crearse.

**Validación:** toda entrada pasa por esquemas **Zod** en el borde. Los argumentos de las tools del LLM se validan con **el mismo esquema** que los endpoints REST — un LLM puede alucinar un argumento y no debe llegar nunca crudo a la base de datos.

---

## 13. Interfaz y branding

### 13.1 Dirección de arte

**El problema real del negocio no es que la web sea fea: es la desconfianza.** El cliente teme que le vendan una pieza que no corresponde a su carro, o que le inventen un precio. Toda la dirección de arte responde a eso.

**De dónde sale:** del mundo material del taller — el **manual de servicio y el catálogo de partes**. Números de parte, fichas de orden de trabajo, etiquetas de rack, despieces con líneas guía numeradas, tablas de especificación. Un lenguaje que dice *«acá los datos son verificables»*.

**Lo que se descarta y por qué:** el default del e-commerce contemporáneo —fondo blanco, radios de 12 px, sombras difusas, Inter para todo, degradados suaves— es lo que sale por defecto en cualquier proyecto y no dice nada de este oficio. Un taller no es un SaaS. La versión anterior de este spec pedía exactamente eso; se reemplaza.

#### Paleta

| Token | Hex | Rol |
|---|---|---|
| `--rojo-toyota` | `#EB0A1E` | La marca. Reservado para **acciones** y para la franja de identidad. Nunca decorativo |
| `--negro-motor` | `#0B0B0C` | Bandas estructurales: barra de estado, cabecera de ficha, footer |
| `--gris-taller` | `#EEEFF1` | Fondo de página. Gris cemento frío — ni blanco puro ni crema |
| `--amarillo-senal` | `#F2B705` | Amarillo de señalética de piso de taller. Atención: «últimas unidades», advertencias |
| `--tinta` | `#16181D` | Texto principal. Negro azulado de tinta impresa |
| `--acero` | `#5A5F66` | Texto secundario y datos técnicos |
| `--verde-taller` | `#17795E` | «Disponible». Verde profundo de tinta, no el verde brillante de interfaz |
| `--filete` | `#C9CBD0` | **Solo líneas de 1 px.** Nunca texto |

**Contrastes verificados sobre `--gris-taller`** (no son estimaciones; se calcularon al elegir la paleta):

| Combinación | Ratio | Veredicto |
|---|---|---|
| `--tinta` sobre fondo | 15.2 : 1 | AAA |
| `--acero` sobre fondo | 5.6 : 1 | AA en cualquier tamaño |
| `--verde-taller` sobre fondo | 4.6 : 1 | AA en texto normal |
| Blanco sobre `--rojo-toyota` | 4.6 : 1 | AA — **válido para botones** |
| `--rojo-toyota` sobre fondo | **4.0 : 1** | ❌ **Falla en texto.** Solo bordes, fondos y áreas rellenas |

Dos reglas que se derivan de la tabla y son obligatorias: **el rojo nunca es color de texto** sobre el fondo (solo blanco sobre rojo), y **el amarillo nunca es color de texto** — funciona como fondo o borde con `--tinta` encima. `--acero` se eligió específicamente en `#5A5F66` y no en un gris más claro porque los grises medios habituales se quedan en 4.3 : 1 y no pasan AA.

«Agotado» se marca con `--acero`, no con rojo: el rojo es la acción de comprar, y usarlo para la mala noticia envía señales cruzadas.

#### Tipografía

Tres roles, ninguno de ellos Inter:

| Rol | Familia | Uso |
|---|---|---|
| Display | **Archivo** 700 / 800, tracking −0.02em | Titulares, precios grandes, cifras de la ficha |
| Texto | **IBM Plex Sans** 400 / 500 / 600 | Párrafos, descripciones, formularios, chat |
| Datos | **IBM Plex Mono** 400 / 600 | **Todo identificador del sistema** |

La regla de la monoespaciada es la decisión tipográfica que más peso carga: **cada código que el sistema genera o consulta se ve como un dato de catálogo.** `TOY-FRE-0001`, `04465-02220`, `CITA-2026-0007`, `B-02-01`, `09:00` y `18 unidades` comparten tratamiento. Eso hace que el sitio se lea como un catálogo técnico y refuerza, visualmente, la promesa de que los datos vienen de un sistema y no de una improvisación.

IBM Plex nació como tipografía corporativa de ingeniería y Archivo se diseñó para impresión de alto rendimiento: las dos traen la procedencia correcta. Se cargan con `next/font/google`, subconjunto `latin`, `display: swap`.

Escala: **12 · 14 · 16 · 20 · 28 · 40 · 64**. Interlineado 1.5 en texto, 1.05 en display.

#### Elemento distintivo: la ficha de taller

Repuestos, citas y servicios se presentan como una **ficha de orden de trabajo**:

```
┌──────────────────────────────────╱     ← esquina recortada (clip-path, 14 px)
│ FRENOS               TOY-FRE-0001│     ← banda negra: categoría + SKU en mono
├──────────────────────────────────┤
│                                  │
│         [dibujo de línea]        │
│                                  │
├───────────┬──────────┬───────────┤
│ S/ 210.00 │ 18 disp. │ 12 meses  │     ← tira de datos, filetes de 1 px
└───────────┴──────────┴───────────┘
```

- Radio de esquina **2 px**, no 12. Es una ficha impresa, no una tarjeta de aplicación.
- La **esquina superior derecha recortada** evoca la etiqueta de cartón que cuelga del espejo retrovisor mientras el carro está en el taller. Es el único gesto decorativo de todo el sistema y aparece **solo** en las fichas. Ahí se gasta toda la audacia del diseño; el resto se mantiene callado.
- **Sin sombras difusas.** La separación se consigue con filetes de 1 px `--filete` y con el fondo gris.

#### Barra de estado del taller

Franja `--negro-motor` de 32 px fija en el tope, en mono a 12 px:

```
TOYOTA TALLER PERÚ · LUN–VIE 09:00–17:00 · ● ABIERTO — CIERRA 17:00 · (01) 715-4820
```

El indicador se calcula en vivo con **la misma función de `lib/fechas` que usa la agenda**: `● ABIERTO — CIERRA 17:00` o `● CERRADO — ABRE LUNES 09:00`. No es decoración: es exactamente el mismo dato con el que el agente decide si puede agendar, y tenerlo siempre a la vista respalda lo que Toño dice en el chat.

#### Logo

Las elipses de Toyota **no** se replican. Monograma **TTP** en Archivo 800 sobre cuadro rojo, más el wordmark «TOYOTA TALLER PERÚ» en mono con tracking amplio. El footer lleva el disclaimer de proyecto académico.

#### Modo oscuro

No en v1. La dirección se apoya en la metáfora de papel gris y tinta impresa; una versión oscura exigiría rediseñar la ficha, no invertir tokens. Queda documentado como mejora.

### 13.2 Hero de portada

En vez del titular centrado sobre un degradado, el hero **demuestra la tesis del producto**: los datos son reales y verificables.

```
┌────────────────────────────────────────────────────────────────┐
│ TOYOTA TALLER PERÚ · LUN–VIE 09:00–17:00 · ● ABIERTO           │
├─────────────────────────────┬──────────────────────────────────┤
│                             │          ╭───── 01  precio de hoy│
│  REPUESTOS QUE              │     ╭────┼───── 02  stock real   │
│  SÍ ESTÁN                   │  [despiece de línea del filtro,  │
│  EN EL ALMACÉN              │   con líneas guía numeradas]     │
│                             │     ╰────┼───── 03  compatibilidad│
│  Pregúntele a Toño por una  │          ╰───── 04  rack B-02-01 │
│  pieza y le responde con    │                                  │
│  el precio y el stock de    │                                  │
│  hoy, no con un estimado.   │                                  │
│                             │                                  │
│  [Ver repuestos] [Agendar]  │                                  │
└─────────────────────────────┴──────────────────────────────────┘
```

El despiece con líneas guía numeradas es vernáculo directo del catálogo de partes, y **los cuatro rótulos son exactamente las cuatro cosas que el agente sabe responder**. La numeración `01–04` se justifica porque son llamadas a un diagrama —donde el orden sí porta información—, no una secuencia decorativa.

### 13.3 Imágenes del catálogo

**Fotos reales**, descargadas por `scripts/descargar-imagenes-reales.mjs` a `/public/repuestos/` y `/public/mantenimientos/`:

- **Fuente:** Wikimedia Commons (búsqueda `intitle:"frase exacta"` primero, texto libre después) como fuente primaria; Openverse (agrega Flickr) solo como último recurso, porque trae mucho ruido de fotos de ciclismo/amateur para términos como "brake pads".
- **Licencia:** solo CC0, CC-BY, CC-BY-SA o dominio público, filtradas con `license_type=modification` — se descarta cualquier variante "No Derivatives" porque el script redimensiona/recodifica a JPEG. La atribución de cada foto queda registrada en `public/CREDITOS-IMAGENES.md`.
- **Genéricas, no Toyota:** se buscan repuestos automotrices genéricos, no fotos con marca/logo Toyota — el proyecto no está afiliado a Toyota y evita el riesgo de marca al desplegarse públicamente. Varias fotos con logos de Toyota visibles se descartaron a mano tras revisión.
- **Filtrado de ruido:** además de la licencia, cada candidato pasa una lista de palabras bloqueadas (bicicleta, joyería, maquetas a escala, diagramas técnicos, etc.) y palabras requeridas derivadas del término de búsqueda — la búsqueda automática por texto encuentra coincidencias con la licencia correcta pero el sujeto equivocado (edificios de oficinas, piezas de bicicleta) con más frecuencia de la esperada, así que cada descarga se revisó visualmente antes de aceptarla.
- **Respaldo:** los 24 SVG de línea (papel milimetrado + trazo, generados por `scripts/generar-placeholders.mjs`, ver commits previos) se conservan intactos como red de seguridad. Cinco ítems (`filtro-aire`, `filtro-combustible`, `correa`, `bomba-agua`, `preventivo-20k`) no encontraron una foto confiable dentro del tiempo disponible y se excluyeron a propósito (`EXCLUIDOS_FORZADOS` en el script), así que siguen mostrando el placeholder SVG — ningún ítem del catálogo se queda sin imagen (CA-19).

### 13.4 Páginas

| Ruta | Contenido |
|---|---|
| `/` | Hero-despiece (§13.2) con CTA doble «Ver repuestos» / «Agendar mantenimiento», los 3 mantenimientos como fichas comparables, 4 repuestos destacados, banda negra «Pregúntele a Toño» con las tres cosas que sabe responder, franja de confianza (garantía 12 meses · repuestos genuinos · técnicos certificados), **footer con dirección, teléfono, horario, mapa y disclaimer legal** (§3.1) |
| `/repuestos` | Grilla responsive (1/2/3/4 columnas). Filtros laterales: categoría, modelo, rango de precio, "solo disponibles". Orden: relevancia, precio ↑↓, nombre. Buscador con debounce |
| `/repuestos/[slug]` | Galería (imagen grande), nombre, SKU, número de parte, precio, `StockBadge`, tabla de especificaciones, chips de compatibilidad, selector de cantidad, "Agregar al carrito", "Consultar a Toño sobre este repuesto" (abre el chat con el SKU precargado) |
| `/mantenimientos` | Los 3 servicios en tarjetas comparativas con precio, duración, intervalo km y checklist de lo incluido. CTA "Agendar" hacia `/agenda?servicio=slug` |
| `/agenda` | Selector de servicio, calendario de 4 semanas con días hábiles habilitados, grilla de 8 slots por día (libre/ocupado/pasado), formulario de datos y confirmación con código. Tras confirmar, avisa que se envió el correo y a qué dirección |
| `/mis-citas` | Un solo campo: **correo electrónico**. Lista las citas del cliente (futuras primero, luego historial) en tarjetas con código, servicio, fecha, hora, vehículo y estado. Cada cita confirmada futura tiene botón «Cancelar» con modal de doble confirmación. Enlazada desde el header, el footer y el correo de confirmación |
| `/carrito` | Ítems, cantidades, monto de ítems, aviso de cuánto falta para el envío gratis (S/ 300), total con «Incluye IGV», botón "Ir a pagar" |
| `/checkout` | Dos pasos en una sola página: **entrega** (recojo o delivery, con dirección y distrito si aplica) y **pago** (tarjeta demo), más el resumen lateral con el desglose actualizado en vivo |
| `/checkout/confirmacion/[codigo]` | Código de pedido, resumen, aviso de que es una compra simulada |
| `/chat` | Chat a pantalla completa con historial y sugerencias iniciales |

### 13.5 Widget de chat

- Botón flotante inferior derecho, cuadro rojo con el monograma **TTP** y radio de 2 px, coherente con la ficha. Badge de «1» en la primera visita.
- Panel de `400×620` en escritorio; hoja completa en móvil. Cabecera negra con «Toño · asesor de repuestos y servicio» y el mismo indicador `● ABIERTO / ● CERRADO` de la barra de estado.
- **Estados visibles de las tools:** mientras se ejecuta una herramienta se muestra un badge con su nombre en mono — «Consultando inventario…», «Revisando la agenda…», «Buscando en la guía Toyota…», «Buscando sus citas…». Sin emojis: el mismo tratamiento de dato técnico que el resto del sistema. Esto hace visible el trabajo del agente (valor didáctico para la presentación) y explica la latencia.
- Respuestas en streaming token a token.
- **Chips de sugerencia iniciales:** «¿Tienen filtro de aceite para Corolla?» · «Quiero agendar un mantenimiento» · «¿Cuándo es mi cita?» · «¿Cada cuánto cambio las pastillas?»
- Cuando el agente lista citas, cada una se renderiza como `TarjetaCita` con código, servicio, fecha, hora, estado y —si es cancelable— un botón que precarga en el input «Cancelar la cita CITA-…», de modo que la cancelación siga pasando por la doble confirmación conversacional (R8) y no por un clic suelto.
- Cuando el agente menciona un repuesto, se renderiza una tarjeta compacta con imagen, precio y botón "Agregar al carrito".
- `session_id` en `localStorage` (uuid) para hilar la conversación; el historial se guarda también en `localStorage` con tope de 50 mensajes.

### 13.6 Movimiento

**Principio: el movimiento comunica estado, no adorna.** Un taller transmite confianza por precisión, no por efectos; y el exceso de animación es, además, una de las marcas más reconocibles de una interfaz generada sin criterio. Hay **un solo momento orquestado** —la carga del hero— y, fuera de él, microinteracciones cortas atadas a un cambio de estado real.

#### Tokens

| Token | Valor | Uso |
|---|---|---|
| `--dur-micro` | 120 ms | hover, foco, cambios de color |
| `--dur-elem` | 240 ms | entrada o salida de un elemento, apertura del panel de chat |
| `--dur-secuencia` | 700 ms | la orquestación del hero, una vez por sesión |
| `--ease-entra` | `cubic-bezier(.2,.7,.2,1)` | todo lo que aparece |
| `--ease-sale` | `cubic-bezier(.4,0,1,1)` | todo lo que desaparece |

#### Los cinco momentos con movimiento

1. **Carga del hero (una sola vez).** Las líneas guía del despiece se dibujan con `stroke-dashoffset` en 500 ms y los cuatro rótulos entran escalonados cada 70 ms con `opacity` + `translateY(6px)`. **El titular no se anima:** ya está pintado cuando carga la página, para no castigar el LCP.
2. **La herramienta en curso — el momento más importante.** Mientras el agente ejecuta una tool, su badge muestra un **barrido de 2 px** que recorre el borde inferior en bucle de 1.2 s. Al terminar, el barrido se detiene, el filete se fija y el texto pasa de «Consultando inventario…» a «Inventario consultado» con un cross-fade de 120 ms. Es la animación que **hace legible el trabajo del agente** y la única que justifica plenamente su existencia: convierte una espera muda en una explicación.
3. **Llegada del mensaje.** El bloque del asistente entra con `opacity` y `translateY(4px)` en 240 ms. Los tokens del streaming **no se animan individualmente**: se añaden al DOM y un cursor de bloque de 2 px parpadea cada segundo hasta el cierre. Animar token por token produce un temblor que se lee como ruido.
4. **Slots de la agenda.** Al cambiar de día, los 8 slots entran escalonados cada 25 ms (200 ms en total). Un slot ocupado **no se sacude ni rebota** al intentar seleccionarlo: se queda quieto y aparece el motivo. El error no se celebra con movimiento.
5. **Contador del carrito.** Al agregar un repuesto, el dígito rota verticalmente (`translateY(-100%)` dentro de un `overflow: hidden`) en 240 ms. Se mueve un solo elemento, no toda la barra.

#### Prohibido explícitamente

Parallax · scroll-jacking · contadores que suben solos · carruseles automáticos · confeti al pagar · cualquier transición mayor a 700 ms · y **`animation` sobre elementos que muestren precio o stock**: un dato que se mueve se lee como un dato inestable, justo lo contrario de lo que este producto necesita comunicar.

#### `prefers-reduced-motion: reduce`

Obligatorio, no opcional:

- Las secuencias del hero se resuelven directamente a su estado final.
- El barrido de la tool se sustituye por un texto que alterna «Consultando inventario…» con un punto fijo: **el estado sigue siendo perceptible sin movimiento**, que es el punto de la regla.
- Los escalonamientos se colapsan a 0 ms.
- Solo sobreviven los cambios de `opacity` y de color, a 120 ms.

#### Rendimiento

Solo se anima `transform` y `opacity`; nunca `width`, `height`, `top` ni `box-shadow`. Los `@keyframes` viven en `globals.css` y **no se añade librería de animación en v1**: Framer Motion costaría unos 30 kB para cinco efectos que el CSS resuelve.

### 13.7 Voz de la interfaz

El microcopy es material de diseño, no relleno. Reglas:

- **Verbos activos y vocabulario estable.** El botón dice «Agendar» y el aviso posterior dice «Agendado» — la misma palabra recorre todo el flujo. Nada de «Enviar» ni «Continuar» genéricos.
- **Nombrar por lo que el cliente controla**, no por cómo está construido el sistema: «Mis citas», no «Consultar registros»; «Últimas unidades», no «Stock bajo umbral».
- **Los errores dicen qué pasó y qué hacer**, sin disculparse ni ser vagos: «Ese horario se acaba de ocupar. Quedan libres las 11:00 y las 14:00» en vez de «Ocurrió un error».
- **Las pantallas vacías invitan a actuar:** el carrito vacío dice «Aún no hay repuestos aquí. Busque por modelo o pregúntele a Toño qué le corresponde a su carro», con enlace al catálogo.
- Sentence case en todo, salvo las bandas de ficha y la barra de estado, que van en mayúsculas porque replican una etiqueta impresa.

### 13.8 Accesibilidad

- **Contraste:** ver la tabla verificada en §13.1. Las dos reglas duras —rojo y amarillo nunca como color de texto— salen de ahí.
- **Foco visible** en todo elemento interactivo: filete de 2 px `--tinta` con `outline-offset: 2px`. No se elimina el `outline` en ningún caso.
- **El chat es navegable por teclado**, con `role="log"` y `aria-live="polite"` en la lista de mensajes, para que un lector de pantalla anuncie las respuestas conforme llegan. Los badges de tool se anuncian con `aria-live="polite"` y texto completo, no solo con el barrido visual.
- Toda imagen con `alt` descriptivo; los SVG decorativos del hero van con `aria-hidden="true"`.
- Formularios con `<label>` asociado, errores vinculados por `aria-describedby` y anunciados al ocurrir.
- Objetivo táctil mínimo de 44 × 44 px en móvil, incluidos los slots de la agenda.
- La retícula de fondo y los filetes nunca portan información por sí solos: todo estado tiene además texto.

---

## 14. Pasarela de pagos dummy

**Nunca** se procesa un pago real ni se envían datos a terceros.

**Paso 1 — Entrega.** El cliente elige entre dos modalidades, presentadas como tarjetas seleccionables:

| Modalidad | Costo | Campos que pide | Qué dice el correo |
|---|---|---|---|
| **Recojo en tienda** | Gratis | Ninguno adicional | Dirección del taller, referencia, horario L–V 09:00–17:00 y aviso de llevar el código del pedido |
| **Delivery en Lima** | S/ 15 · **gratis desde S/ 300** | Dirección, distrito, referencia | Dirección de entrega y plazo estimado de 2 a 4 días hábiles |

- El resumen del carrito muestra el desglose en vivo: `monto_items`, `costo_envio`, `total`, y bajo el total la línea *«Incluye IGV: S/ …»*. Al superar S/ 300 en delivery, el costo de envío se tacha y aparece «Envío gratis».
- Solo hay cobertura en Lima Metropolitana: el selector de distrito es una lista cerrada. Provincias muestra un aviso de que por ahora solo hay recojo en tienda.

**Paso 2 — Pago.**

- Formulario: nombre en la tarjeta, número, vencimiento (MM/AA), CVV, y datos de contacto.
- Validación local: algoritmo de **Luhn**, vencimiento futuro, CVV de 3 dígitos.
- **Tarjetas de prueba** (visibles en la propia página, en un aviso destacado):

| Número | Resultado |
|---|---|
| `4111 1111 1111 1111` | ✅ Aprobado |
| `4000 0000 0000 0002` | ❌ Rechazado — fondos insuficientes |
| `4000 0000 0000 0069` | ❌ Rechazado — tarjeta vencida |
| Cualquier otro válido por Luhn | ✅ Aprobado |

- Se simula latencia de 1.5–2.5 s con un spinner "Procesando pago…".
- **Persistencia:** se guardan solo `ultimos4` y una `referencia_pago` tipo `DEMO-TXN-8F2A91`. El PAN completo, el CVV y el vencimiento **nunca** se envían al servidor: la validación es en cliente y solo se transmiten los últimos 4 dígitos. Documentado explícitamente en el código.
- Al aprobar: transacción que crea `pedidos` + `pedido_items` y llama a `descontar_stock` por cada ítem. Si algún ítem quedó sin stock entre el carrito y el pago, se cancela todo y se avisa cuál falló.
- Tras la transacción se envía el correo `pedido_confirmado` (§11.3) con el resumen del pedido y el aviso de compra simulada. Igual que con las citas, un fallo de correo **no** revierte el pedido: la página de confirmación muestra un aviso de que el correo no pudo enviarse.
- Banner permanente en `/checkout`: **"Compra simulada — no se realizará ningún cobro real."**

---

## 15. Seguridad y operación

| Riesgo | Mitigación |
|---|---|
| Fuga de `service_role` | Solo en `src/server/**`; check de CI que la busca fuera de ahí; nunca prefijo `NEXT_PUBLIC_` |
| Abuso del chat (costo del LLM) | Rate limit por IP (`RATE_LIMIT_CHAT_POR_MINUTO=15`), tope de 1 500 caracteres por mensaje, tope de 20 mensajes de historial enviados al modelo |
| Prompt injection en el input | El texto del usuario nunca se concatena al system prompt; va como mensaje `user`. Las tools validan con Zod. El LLM no ejecuta SQL: solo llama funciones tipadas |
| Datos personales | Se guarda el mínimo (nombre, email, teléfono). Sin políticas RLS para `citas`/`pedidos` ⇒ la clave anon no los ve. Aviso de privacidad en el footer |
| **Enumeración de citas por email** | Consultar solo con el correo es **una decisión de producto asumida** para esta demo (§18, S8). Mitigaciones: rate limit de 5 consultas/minuto por IP en `GET /api/citas`, respuesta idéntica para «correo sin citas» y «correo inexistente», y nunca se devuelven teléfono ni dirección del cliente, solo lo necesario para reconocer la cita. Para producción se recomienda un código de 6 dígitos enviado al correo |
| Cancelación no autorizada | `cancelar_cita` exige **código + correo coincidentes**; el código solo se obtiene por correo o consultando con ese mismo correo. Rate limit de 3 intentos/minuto |
| Fuga de `BREVO_API_KEY` | Solo en `src/server/**`; una clave filtrada permitiría enviar correo suplantando al taller |
| Correo usado como spam | El destinatario **nunca** lo elige el atacante libremente: los correos solo salen hacia la dirección registrada en una cita o pedido que se acaba de crear. Idempotencia + rate limit de agendamiento (3 citas/hora por IP) acotan el volumen |
| Doble booking | Índice único parcial + revalidación previa contra `freebusy` |
| Sobreventa de stock | `descontar_stock` con `UPDATE … WHERE stock >= cantidad` y excepción; nunca lectura-luego-escritura |
| Caída del LLM o de Google | Mensajes de error con salida digna; `CALENDAR_PROVIDER=mock` como plan B en la demo |
| Alucinación de precios | Guardrail de salida (§9.6, capa 3) |

**Observabilidad:** cada llamada a tool se persiste en `mensajes` con `tool_nombre`, `tool_payload`, `tool_resultado` y `latencia_ms`. Con eso se puede auditar toda conversación y demostrar en la presentación qué hizo el agente en cada turno.

### 15.1 Despliegue en Render

**Tipo de servicio:** *Web Service* (no Static Site — la app tiene backend). Runtime Node 20+. Región **Oregon**, la más cercana a Perú en el plan gratuito.

| Ajuste | Valor |
|---|---|
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` → `next start -p $PORT` |
| Health Check Path | `/api/health` (devuelve `{ ok: true }` sin tocar la base de datos) |
| Auto-Deploy | Desde la rama `main` |

**Puerto:** Render inyecta `PORT`; la app **debe** escucharlo. Fijar `PORT` a mano en el dashboard rompe el despliegue.

**Clave de Google:** en lugar de pelear con los saltos de línea de `GOOGLE_PRIVATE_KEY` en el dashboard, se recomienda **Secret Files**: subir el JSON de la cuenta de servicio como `/etc/secrets/google-service-account.json` y apuntar `GOOGLE_SERVICE_ACCOUNT_FILE` a esa ruta. El módulo `google-calendar.ts` acepta ambas formas: si existe el archivo lo usa, si no, cae a las variables sueltas. En local se usan las variables del `.env.local`.

> ⚠️ **El plan gratuito de Render duerme el servicio tras ~15 minutos sin tráfico**, y el siguiente request tarda **hasta un minuto** en levantarlo. En una demostración en vivo eso se ve como una web caída. Mitigación: **abrir la URL 5 minutos antes de presentar** y dejar una pestaña activa. Si la presentación es evaluada en diferido, considerar el plan de US$ 7/mes durante esa semana. No se implementa un *pinger* automático: consume cuota y no resuelve el arranque en frío de la primera visita real.

**Ventaja frente a serverless:** al ser un proceso Node persistente, el streaming SSE de `/api/chat` no tiene límite de duración de función, y el rate limit en memoria (`lib/rate-limit.ts`) funciona correctamente. **Si algún día se escala a más de una instancia**, ese rate limit deja de ser confiable y habría que moverlo a una tabla de Supabase o a Redis. Está anotado en el propio módulo.

**Variables de entorno:** todas las de §5 se cargan en el dashboard de Render, más `NEXT_PUBLIC_SITE_URL=https://<app>.onrender.com`. Ninguna se commitea.

---

## 16. Criterios de aceptación

### Inventario (F1)
- **CA-01** «¿Tienen filtro de aceite para Corolla?» → el agente llama `buscar_repuestos` y responde con el precio exacto `S/ 38.00` y el stock real.
- **CA-02** «Necesito pastillas de freno» (sin modelo ni eje) → el agente hace como máximo 2 preguntas de desambiguación antes de cotizar.
- **CA-03** Consultar el alternador (`TOY-ELE-0002`, stock 0) → responde "agotado", indica los días de reposición y ofrece alternativa.
- **CA-04** «filtro de acite corola» (con typos) → los trigramas igual encuentran el repuesto correcto.
- **CA-05** El precio dicho en el chat coincide exactamente con el de `/repuestos/[slug]`.

### Agenda (F2)
- **CA-06** Pedir cita un sábado → rechazo cortés + oferta del siguiente día hábil.
- **CA-07** Pedir cita a las 20:00 → rechazo + slots del día siguiente.
- **CA-08** Agendar un slot libre → registro en `citas` **y** evento en Google Calendar con los datos completos.
- **CA-09** Intentar agendar un slot ya tomado → `SLOT_OCUPADO` + 3 alternativas, sin registro duplicado.
- **CA-10** El agente jamás confirma sin nombre, email, teléfono, modelo, servicio y un "sí" explícito.
- **CA-11** Una cita creada en `/agenda` (web) desaparece de los slots libres que ofrece el chat, y viceversa.

### Conocimiento (F3)
- **CA-12** «¿Cada cuánto cambio el aceite?» → responde apoyándose en `buscar_conocimiento`.
- **CA-13** «¿Tienen filtro para Kia Rio?» → plantilla de otra marca, **sin** consultar inventario.
- **CA-14** Igual para Nissan, Hyundai, Chevrolet, Honda, Suzuki, Mazda, Ford, VW, BMW, BYD y Changan (12 casos).
- **CA-15** «¿Cuál es la capital de Francia?» → plantilla de fuera de tema.
- **CA-16** Pregunta Toyota sin cobertura en la base de conocimiento → admite no tener el dato y ofrece contacto; **no inventa**.

### E-commerce
- **CA-17** Compra con `4111…1111` → pedido `pagado`, código visible, stock descontado.
- **CA-18** Compra con `4000…0002` → rechazo, sin pedido y sin descuento de stock.
- **CA-19** Los 24 repuestos muestran imagen (ningún `alt` roto ni 404).
- **CA-20** Los 3 mantenimientos se ven en `/mantenimientos` con precio, duración e ítems incluidos.

### Gestión de citas y correo (F4)
- **CA-21** Al confirmar una cita llega un correo real al destinatario con código, servicio, fecha, hora **y la dirección Av. Javier Prado Este 4520**.
- **CA-22** El correo se ve correctamente en Gmail web, Gmail móvil y Outlook, y su versión de texto plano contiene fecha, hora y dirección.
- **CA-23** «¿Tengo alguna cita?» → el agente pide el correo y, con `ana.quispe@ejemplo.com` (del seed), lista la cita confirmada con su código.
- **CA-24** Un correo sin citas devuelve la plantilla correspondiente y ofrece agendar, sin sugerir que el correo esté mal escrito.
- **CA-25** Cancelar desde el chat exige repetir código, fecha y hora y recibir un «sí» explícito antes de ejecutar `cancelar_cita`.
- **CA-26** Tras cancelar: el horario vuelve a aparecer como libre, el evento desaparece de Google Calendar y llega el correo de cancelación.
- **CA-27** La cita cancelada sigue apareciendo en `consultar_citas` con estado `cancelada` y sin opción de cancelarla otra vez.
- **CA-28** Intentar cancelar con un código válido pero un correo distinto → `CITA_NO_CANCELABLE`, sin revelar que la cita existe.

### Transversales
- **CA-29** Lighthouse ≥ 90 en Performance y ≥ 95 en Accessibility en `/` y `/repuestos`.
- **CA-30** El chat funciona en móvil (360 px de ancho) sin scroll horizontal.
- **CA-31** Con `NVIDIA_API_KEY` inválida, la web sigue navegable y el chat muestra un error digno.
- **CA-32** `AGENT_TOOL_MODE=json` supera CA-01, CA-08 y CA-13 igual que `native`.
- **CA-33** Con `BREVO_API_KEY` inválida, la cita **se crea igual**, la respuesta trae `email_enviado: false` y el agente dicta fecha, hora y dirección en el chat.
- **CA-34** Reintentar dos veces el mismo agendamiento no envía dos correos (idempotencia por `clave_idem`).
- **CA-35** Tras 20 minutos de inactividad, la primera visita a la URL de Render carga completa (aunque tarde) y el chat responde con normalidad.

### Entrega y pago
- **CA-36** Con modalidad *recojo*: no se pide dirección, `costo_envio = 0`, y el correo trae la dirección del taller con su horario.
- **CA-37** Con *delivery* y un carrito de S/ 250: se suman S/ 15 y el total es S/ 265.
- **CA-38** Con *delivery* y un carrito de S/ 320: el envío aparece tachado como gratis y el total es S/ 320.
- **CA-39** Elegir *delivery* sin completar la dirección impide pagar; el pedido no se crea (validación en cliente y en el `CHECK` de la base de datos).
- **CA-40** El desglose del correo cuadra exactamente con lo mostrado en `/checkout`: `monto_items + costo_envio = total`.

### Diseño y movimiento
- **CA-41** Con `prefers-reduced-motion: reduce` activo en el sistema operativo, ninguna animación de desplazamiento se ejecuta y **el estado de la tool en curso sigue siendo perceptible** por texto.
- **CA-42** Ningún texto rojo ni amarillo aparece sobre el fondo `--gris-taller` en toda la aplicación (revisión con el inspector de contraste).
- **CA-43** El indicador `● ABIERTO / ● CERRADO` de la barra de estado coincide siempre con lo que responde el agente al preguntarle si el taller está abierto ahora.
- **CA-44** Todo identificador del sistema (SKU, número de parte, código de cita, código de pedido, ubicación de rack) se muestra en IBM Plex Mono, sin excepciones.
- **CA-45** El foco de teclado es visible en todos los elementos interactivos, incluidos los slots de la agenda y los chips de sugerencia del chat.

### 16.1 Estrategia de pruebas

Dos capas separadas, porque tienen costos y velocidades muy distintas.

#### Capa 1 — Vitest (`npm test`)

Rápida, determinista, sin red. Corre en cada commit.

| Módulo | Qué se prueba |
|---|---|
| `lib/fechas` | Generación de los 8 slots, rechazo de fin de semana, anticipación mínima, y **el caso del servidor en UTC**: que un slot de las 09:00 de Lima no se corra de día |
| `services/agenda` | Cruce de `freebusy` con la tabla `citas`, slot ocupado, siguiente día hábil |
| `lib/moneda` y checkout | IGV, costo de envío y el **borde exacto de S/ 300** (299.99 cobra envío, 300.00 no), algoritmo de Luhn |
| `agent/guardrails` | 30 frases con marca ajena que deben bloquearse y 10 falsos positivos que **no** («vengo de un Nissan, ahora tengo un Corolla») |
| `email/enviar` | Idempotencia por `clave_idem`, reintento único en 5xx, ausencia de reintento en 4xx |
| `services/pedidos` | Stock insuficiente revierte todo el pedido |

Supabase se mockea en estas pruebas. Las funciones SQL (`buscar_repuestos`, `cancelar_cita`, los triggers de horario) se verifican con un script aparte contra un proyecto Supabase de pruebas, no contra el de la demo.

#### Capa 2 — Evals conversacionales (`npm run eval`)

Ejecutan los criterios de aceptación **contra el agente real**. Requieren credenciales, así que no corren en CI.

Cada caso es una línea de `evals/casos.jsonl`:

```json
{ "id": "CA-13",
  "turnos": ["¿Tienen filtro de aceite para un Kia Rio 2019?"],
  "espera": {
    "tools_prohibidas": ["buscar_repuestos"],
    "texto_contiene": ["Toyota"],
    "texto_no_contiene": ["S/", "Kia"]
  } }
```

Reglas del harness:

- **Aserciones deterministas, no LLM-as-judge.** Se verifica qué tools se llamaron y cuáles no, expresiones regulares sobre la respuesta, y comparación de las cifras citadas contra lo que dice la base de datos. Un juez LLM añadiría otra fuente de ruido sobre un modelo que ya es no determinista.
- Cada caso corre **3 veces** y necesita **2 de 3** para pasar. El umbral del set completo es **≥ 90 %**.
- Casos cubiertos: CA-01 a CA-16 y CA-21 a CA-28 (los conversacionales). El resto se valida con Vitest o a mano.
- Salida: tabla en consola y `evals/resultado.json` con pasadas, falladas, latencia media y tokens. **Ese archivo es la evidencia directa para la presentación del curso.**
- `npm run eval -- --caso CA-13` corre uno solo, útil al iterar el system prompt.
- Se ejecuta con `EMAIL_PROVIDER=consola` y `CALENDAR_PROVIDER=mock` por defecto, para no gastar cuota de Brevo ni ensuciar el calendario real. Un flag `--real` los activa cuando se quiera validar la integración completa.

---

## 17. Plan de implementación

| Fase | Alcance | Entregable verificable |
|---|---|---|
| **Fase 0 · Andamiaje** | Next.js 15 + TS + Tailwind, tokens de diseño, layout, header/footer, `.env.example`, script de placeholders SVG | Home estática con branding, 24 SVG generados |
| **Fase 1 · Datos** | `01_schema.sql` + `02_seed.sql` ejecutados en Supabase, tipos generados, servicios `catalogo`/`inventario` | `select * from buscar_repuestos('filtro aceite','Corolla',2018)` devuelve filas |
| **Fase 2 · Catálogo** | `/repuestos`, `/repuestos/[slug]`, `/mantenimientos`, filtros, carrito en `localStorage` | Navegación completa del e-commerce, sin agente |
| **Fase 3 · Agente base** | `llm.ts` contra NIM, `runtime.ts` con las tools T1, T2, T3, T6, guardrails, `/api/chat` SSE, `ChatWidget` | CA-01 a CA-05, CA-12 a CA-16 |
| **Fase 4 · Agenda** | `google-calendar.ts`, proveedor `mock`, servicio `agenda`, T4 y T5, página `/agenda` | CA-06 a CA-11 |
| **Fase 5 · Correo y gestión de citas** | `brevo.ts` + proveedor `consola`, las 3 plantillas HTML/texto, `emails_enviados`, T8 y T9, página `/mis-citas`, borrado de evento al cancelar | CA-21 a CA-28, CA-33, CA-34 |
| **Fase 6 · Checkout dummy** | Carrito, `/checkout` con recojo/delivery, validación Luhn, `descontar_stock`, confirmación y correo de pedido | CA-17, CA-18, CA-36 a CA-40 |
| **Fase 7 · Pruebas** | Suite Vitest, harness de evals (`evals/casos.jsonl`), ajuste del system prompt hasta alcanzar el umbral | ≥ 90 % del set de evals |
| **Fase 8 · Despliegue y pulido** | Web Service en Render, Secret File de Google, variables de entorno, `/api/health`, accesibilidad, responsive, estados de error, README | CA-19, CA-20, CA-29 a CA-35 |

**Dependencias externas:** la Fase 4 requiere las credenciales de Google y la Fase 5 la clave de Brevo. Ambas fases se desarrollan contra `CALENDAR_PROVIDER=mock` y `EMAIL_PROVIDER=consola`, y se conmutan a los proveedores reales cuando lleguen las credenciales — **ninguna bloquea el avance**.

---

## 18. Preguntas abiertas y supuestos

**Supuestos asumidos** (cambiar aquí si alguno no aplica):

- **S1** — El taller tiene **una sola bahía**: máximo 1 cita por hora. Si fueran 2 o 3 en paralelo, cambia el índice único de `citas` y el cálculo de disponibilidad.
- **S2** — Los feriados peruanos **no** se bloquean automáticamente en v1. El taller los bloquea creando un evento de día completo en su Google Calendar, y `freebusy` lo respeta.
- **S3** — Las citas de mantenimiento **no** reservan stock de repuestos.
- **S4** — Se puede **consultar y cancelar** desde el chat y desde `/mis-citas`, pero **no reprogramar**: mover una cita = cancelar + agendar de nuevo. La reprogramación en un paso queda como mejora v2.
- **S8** — **El correo electrónico es la única llave de identidad.** Quien conozca un correo puede ver las citas asociadas. Es una decisión consciente para esta demo, mitigada como se describe en §15. En producción se añadiría un código de verificación de 6 dígitos enviado al correo antes de mostrar el detalle.
- **S9** — No hay recordatorio automático el día previo: requeriría un cron y un proveedor de correo con más cuota.
- **S10** — Los correos salen desde una dirección Gmail verificada en Brevo, no desde un dominio propio. Es probable que algunos clientes los reciban en Promociones o Spam; por eso el agente siempre dicta también los datos en el chat.
- **S5** — El carrito vive en `localStorage`; se pierde al limpiar el navegador.
- **S6** — Los precios de los repuestos incluyen IGV; los del mantenimiento también.
- **S7** — El agente atiende **un cliente por sesión**, sin escalamiento a humano.

**Por confirmar cuando lleguen las credenciales:**

- **P1** — ¿`meta/muse-glimmer-30b` soporta *function calling* nativo en NIM? Si no, el runtime usará `AGENT_TOOL_MODE=json` (§9.5). **Esto no bloquea nada**, pero conviene medirlo temprano en la Fase 3 porque afecta la calidad de la desambiguación.
- **P2** — ~~¿Workspace o Gmail personal?~~ **Resuelto:** cuenta Gmail gratuita. El evento se crea solo en el calendario del taller, sin invitados, y el cliente se entera por el correo de Brevo (§10.1).
- **P4** — ~~¿Qué Gmail se verifica como remitente en Brevo?~~ **Resuelto:** el mismo correo dueño del Google Calendar del taller. Una sola cuenta concentra calendario, remitente y `Reply-To`, de modo que las respuestas de los clientes caen en el buzón donde también están las citas. `GOOGLE_CALENDAR_ID`, `EMAIL_REMITENTE` y `EMAIL_RESPONDER_A` apuntan a la misma dirección.
- **P3** — ~~¿Dónde se despliega?~~ **Resuelto:** Render, Web Service de Node (§15.1). SSE sin restricciones; el punto a vigilar es el arranque en frío del plan gratuito el día de la presentación.

---

## 19. Glosario

| Término | Definición |
|---|---|
| **Slot** | Bloque de 1 hora agendable. 8 por día hábil: 09:00 a 16:00 como hora de inicio. |
| **Tool** | Función tipada que el LLM puede invocar; se ejecuta en el servidor y devuelve JSON. |
| **Guardrail** | Control determinista que limita lo que el agente puede responder, independiente del modelo. |
| **SKU** | Código interno del repuesto (`TOY-FRE-0001`). |
| **Número de parte** | Código oficial Toyota de la pieza (`04465-02220`). |
| **SLLC** | Super Long Life Coolant, el refrigerante rosado de Toyota. |
| **IGV** | Impuesto General a las Ventas del Perú, 18 %. |
| **Clave de idempotencia** | `tipo:referencia` (ej. `cita_confirmada:CITA-2026-0007`). Impide enviar dos veces el mismo correo. |
| **Remitente verificado** | Dirección de correo confirmada en Brevo desde la que se puede enviar. Con cuenta gratuita, un Gmail propio. |
| **Slot liberado** | Efecto de cancelar una cita: al pasar a `estado='cancelada'` deja de aplicarle el índice único y el horario vuelve a ofrecerse. |
