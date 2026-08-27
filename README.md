# Toyota Taller Perú

E-commerce de repuestos Toyota con **Toño**, un agente conversacional que consulta inventario real, agenda mantenimientos en Google Calendar, gestiona citas por correo y responde preguntas técnicas sobre vehículos Toyota.

Trabajo final del curso **Agentic Engineer**.

> **Proyecto académico de demostración.** No está afiliado, patrocinado ni avalado por Toyota Motor Corporation. Todos los repuestos, precios, stock, mantenimientos y direcciones son ficticios, y la pasarela de pagos es simulada: **nunca se procesa un cobro real**.

La especificación completa —arquitectura, modelo de datos, diseño del agente, dirección de arte y criterios de aceptación— está en [`SPEC.md`](SPEC.md).

---

## Qué hace el agente

Toño entiende lo que pide el cliente en lenguaje natural y lo canaliza hacia cuatro capacidades, con **9 herramientas** ejecutadas en el servidor:

| Capacidad | Qué hace | Herramientas |
|---|---|---|
| **Inventario** | Identifica a qué repuesto se refiere el cliente, pregunta si hay ambigüedad, y responde precio y stock consultando la base de datos | `buscar_repuestos`, `consultar_disponibilidad_repuesto`, `agregar_al_carrito` |
| **Agenda** | Consulta horarios libres en Google Calendar (L–V 09:00–17:00, hora de Lima), ofrece los espacios y registra la cita de 1 hora | `listar_mantenimientos`, `consultar_disponibilidad_agenda`, `agendar_cita` |
| **Conocimiento** | Responde preguntas técnicas **solo de vehículos Toyota**; otras marcas y temas ajenos se rechazan con cortesía | `buscar_conocimiento` |
| **Gestión de citas** | Busca las citas del cliente **usando el correo como llave** y las cancela si lo pide, liberando el horario | `consultar_citas`, `cancelar_cita` |

**El agente nunca inventa datos.** Precios, stock y disponibilidad vienen siempre de una herramienta, y hay un guardrail de salida que descarta cualquier respuesta con una cifra que no provenga de una consulta real.

Además, la web tiene catálogo con fichas técnicas, los 3 tipos de mantenimiento del taller, carrito y checkout simulado con entrega a elegir entre recojo en tienda o delivery en Lima.

---

## Stack

| Capa | Tecnología |
|---|---|
| Framework | Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 |
| Base de datos | Supabase (PostgreSQL) con RLS y búsqueda de texto completo en español |
| LLM | NVIDIA NIM (`meta/muse-glimmer-30b`) vía SDK de OpenAI apuntado a su `baseURL` |
| Agenda | Google Calendar API v3 con cuenta de servicio |
| Correo | Brevo (API HTTP, 300 correos/día en plan gratuito) |
| Tipografía | Archivo · IBM Plex Sans · IBM Plex Mono |
| Pruebas | Vitest + harness de evals propio |
| Hosting | Render (Web Service de Node) |

---

## Puesta en marcha

### Requisitos

Node.js 20 o superior, y cuentas en Supabase, Google, NVIDIA NIM y Brevo.

### 1. Instalar

```bash
npm install
cp .env.example .env.local
```

### 2. Supabase

Crear un proyecto y ejecutar en el SQL Editor, en este orden:

```
supabase/01_schema.sql     # tablas, índices, funciones, triggers y RLS
supabase/02_seed.sql       # 24 repuestos, 10 modelos, 3 mantenimientos, 12 FAQ, 3 citas
```

`supabase/99_reset.sql` borra todo en cascada, solo para desarrollo.

Copiar a `.env.local` la URL del proyecto, la `anon key` y la `service_role key`.

### 3. Google Calendar

1. Crear un proyecto en Google Cloud y habilitar la **Google Calendar API**.
2. Crear una **cuenta de servicio** y descargar su clave JSON.
3. En el Google Calendar del taller: **Configuración → Compartir con personas específicas** → agregar el correo de la cuenta de servicio con permiso «Hacer cambios en los eventos».
4. Copiar el ID del calendario y las credenciales a `.env.local`. Se admiten dos formas: las variables sueltas (`GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`) o la ruta al JSON completo (`GOOGLE_SERVICE_ACCOUNT_FILE`), que es lo cómodo en Render.

Los eventos se crean **sin invitados**: una cuenta de servicio sin delegación de dominio no puede agregarlos, y el cliente se entera de su cita por el correo que envía la aplicación.

### 4. Brevo

1. Registrarse en [brevo.com](https://www.brevo.com) (plan gratuito, sin tarjeta).
2. **Settings → Senders** → registrar y verificar el correo remitente. Es **la misma cuenta de Google dueña del calendario**, para que las respuestas de los clientes lleguen al buzón donde también están las citas.
3. **SMTP & API → API Keys** → generar una clave y copiarla a `.env.local`.

### 5. Levantar

```bash
npm run dev     # http://localhost:3000
```

### Desarrollar sin credenciales externas

Calendario y correo tienen proveedores simulados, así que se puede avanzar sin tenerlo todo configurado:

```bash
CALENDAR_PROVIDER=mock      # la disponibilidad se calcula solo contra Supabase
EMAIL_PROVIDER=consola      # los correos se imprimen en el log, no se envían
```

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm start` | Servidor de producción (escucha en `$PORT`) |
| `npm run lint` | ESLint |
| `npm test` | Suite de Vitest |
| `npm run test:watch` | Vitest en modo watch |
| `npm run eval` | Evals conversacionales contra el agente real |
| `npm run check:server-only` | Falla si una credencial se referencia fuera de `src/server/**` |
| `npm run generar-placeholders` | Regenera los 24 SVG del catálogo, los 3 de mantenimiento y el logo (respaldo si falla una descarga) |
| `npm run descargar-imagenes` | Descarga fotos reales con licencia abierta (Wikimedia Commons / Openverse) para el catálogo; ver `public/CREDITOS-IMAGENES.md` |

> `npm run build` y `npm run dev` no deben correr a la vez: se pisan la carpeta `.next` y el resultado son 404 en los chunks estáticos. Si pasa, `rm -rf .next` y volver a levantar uno solo.

---

## Estructura

```
src/
├─ app/                    # rutas y API (App Router)
│  ├─ api/                 # chat (SSE), repuestos, agenda, citas, checkout, health
│  └─ …                    # /, /repuestos, /mantenimientos, /agenda, /mis-citas,
│                          # /carrito, /checkout, /chat
├─ components/             # UI por dominio: layout, catalogo, agenda, chat, inicio, ui
├─ lib/                    # utilidades de cliente (carrito, sesión de chat, formato, agente)
├─ server/
│  ├─ agent/               # runtime de tool-calling, prompt, guardrails, cliente LLM
│  ├─ services/            # lógica de negocio: catálogo, inventario, agenda, citas, pedidos
│  ├─ email/               # fachada de envío + 3 plantillas HTML/texto
│  ├─ integrations/        # supabase, google-calendar, brevo
│  └─ lib/                 # fechas (zona Lima), moneda, taller, rate-limit, validación
└─ types/                  # tipos de dominio y de base de datos
```

**Principio rector:** la lógica vive en `src/server/services/*`. Las herramientas del agente y los endpoints REST de la UI son dos fachadas sobre los mismos servicios. Si el chat y la web dan respuestas distintas, es un bug.

### Módulos de fuente única

Tres constantes no se duplican nunca como literales:

| Módulo | Qué concentra |
|---|---|
| `src/server/lib/taller.ts` | Dirección, teléfono, horario y reglas de negocio del taller |
| `src/lib/agente.ts` | Nombre y firma de Toño, para que la UI y el system prompt no se desalineen |
| `src/app/globals.css` | Tokens de color, tipografía y movimiento |

---

## Diseño

La dirección de arte es **"catálogo técnico"**: el producto vende confianza en el dato, así que el lenguaje visual es el del manual de servicio y la orden de trabajo. Detalle completo en [`SPEC.md` §13](SPEC.md).

- **Ficha de taller:** repuestos, citas y servicios se presentan como una ficha con banda negra (categoría + identificador), dibujo de línea y tira de datos al pie. Radio de 2 px y la esquina superior derecha recortada, como la etiqueta que cuelga del espejo del carro en el taller.
- **Monoespaciada para todo identificador:** SKU, número de parte, código de cita, ubicación de rack y horas comparten tratamiento.
- **Barra de estado en vivo:** el indicador `● ABIERTO / ● CERRADO` del tope usa la misma función de `server/lib/fechas` que decide si un horario existe, así que nunca contradice lo que responde el agente.
- **Movimiento:** comunica estado, no adorna. Hay cinco momentos con animación —carga del hero, herramienta en curso, llegada del mensaje, entrada de los slots y contador del carrito—, todos con `prefers-reduced-motion` respetado. Nada de parallax, carruseles ni confeti, y **nunca se anima un elemento que muestre precio o stock**.
- **Contraste:** el rojo de marca da 4.0:1 sobre el fondo gris, así que **nunca es color de texto**; solo relleno con blanco encima. Lo mismo con el amarillo.

Las imágenes del catálogo son placeholders SVG generados por script, sin dependencias externas.

---

## Pruebas

**Vitest** (`npm test`) cubre la lógica pura: generación de slots y zona horaria de Lima, cálculo de IGV y costo de envío con el borde exacto de S/ 300, algoritmo de Luhn, detector de marcas ajenas con sus falsos positivos, e idempotencia del correo.

**Evals** (`npm run eval`) ejecutan los criterios de aceptación conversacionales contra el agente real, con aserciones deterministas —qué herramienta se llamó y cuál no, y si las cifras citadas coinciden con la base de datos—, no con un juez LLM. Cada caso corre 3 veces y necesita 2 de 3; el umbral del set es 90 %. Los casos están en `evals/casos.jsonl`.

```bash
npm run eval -- --caso CA-13     # un solo caso, útil al iterar el prompt
```

---

## Seguridad

Estas credenciales solo se leen dentro de `src/server/**`, y `npm run check:server-only` falla si aparecen fuera:

```
SUPABASE_SERVICE_ROLE_KEY    NVIDIA_API_KEY
GOOGLE_PRIVATE_KEY           BREVO_API_KEY
```

Las tablas de citas, pedidos, correos y conversaciones **no tienen políticas RLS**: la clave anónima no puede leerlas ni escribirlas, y todo acceso pasa por el servidor con su propio rate limit.

> La consulta de citas solo con el correo es enumerable: quien conozca una dirección puede ver sus citas. Es una decisión asumida para la demo, acotada con rate limit y respuesta idéntica para «sin citas» y «correo inexistente». Para producción, el spec recomienda un código de verificación de 6 dígitos ([`SPEC.md` §18, S8](SPEC.md)).

---

## Despliegue

**Render**, como *Web Service* de Node (no Static Site: la aplicación tiene backend).

| Ajuste | Valor |
|---|---|
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Región | Oregon |

La clave de Google conviene subirla como **Secret File** en `/etc/secrets/google-service-account.json` y apuntar `GOOGLE_SERVICE_ACCOUNT_FILE` a esa ruta, en vez de pelear con los saltos de línea en el dashboard. No fijar `PORT` a mano: Render lo inyecta.

> ⚠️ **El plan gratuito de Render duerme el servicio tras unos 15 minutos sin tráfico**, y la siguiente visita tarda hasta un minuto en levantarlo. Si hay una demostración en vivo, abrir la URL unos minutos antes.

---

## Documentación

[`SPEC.md`](SPEC.md) es la fuente de verdad. Secciones útiles:

| Sección | Contenido |
|---|---|
| §3.1 | Datos del taller |
| §5 | Todas las variables de entorno |
| §7 y §8 | SQL de Supabase con datos de prueba |
| §9 | System prompt, las 9 herramientas y los guardrails |
| §10 y §11 | Google Calendar y correo transaccional |
| §13 | Dirección de arte, movimiento y accesibilidad |
| §16 | Los 45 criterios de aceptación y la estrategia de pruebas |
| §18 | Supuestos asumidos y preguntas abiertas |

Informes de campañas de prueba ya ejecutadas:

| Documento | Contenido |
|---|---|
| [`PLAN-DE-PRUEBAS.md`](PLAN-DE-PRUEBAS.md) | Plan maestro, seis capas de prueba |
| [`INFORME-E2E-NAVEGACION-REAL.md`](INFORME-E2E-NAVEGACION-REAL.md) | Navegación real de las 10 superficies (defectos DEF-01 a DEF-24) |
| [`PLAN-DE-PRUEBAS-LATENCIA-CHAT.md`](PLAN-DE-PRUEBAS-LATENCIA-CHAT.md) | Campaña específica de latencia y reintentos del agente |
| [`INFORME-LATENCIA-CHAT.md`](INFORME-LATENCIA-CHAT.md) | Resultados medidos: de dónde vienen los segundos y qué es accionable (DEF-25 a DEF-34) |
