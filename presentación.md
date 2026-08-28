# Toyota Taller Perú — Trabajo final del curso Agentic Engineer

### Insumo para la presentación (PPT)

| Campo | Valor |
|---|---|
| **Proyecto** | Toyota Taller Perú — e-commerce de repuestos + agente conversacional «Toño» |
| **Autor** | Juan Carrasco (conversandoapp@gmail.com) |
| **Método** | Spec Driven Development: especificación con **Opus**, ejecución con **Sonnet** |
| **Stack** | Next.js 15 · React 19 · TypeScript · Tailwind 4 · Supabase · Google Calendar · Brevo · Render |
| **Repositorio** | GitHub (`main`), auto-deploy a Render |
| **Documentos base** | `SPEC.md` · `PLAN-DE-PRUEBAS.md` · `INFORME-EJECUCION-PRUEBAS.md` · `INFORME-E2E-NAVEGACION-REAL.md` · `PLAN-DE-PRUEBAS-LATENCIA-CHAT.md` · `INFORME-LATENCIA-CHAT.md` |

> **Cómo usar este documento:** cada bloque «Slide N» es una lámina sugerida. El texto en viñetas es lo que va **en** la lámina; el bloque *Notas del expositor* es lo que se dice **encima** de la lámina. Son 21 láminas; para una exposición de 10–12 minutos, las marcadas con ⭐ son el mínimo indispensable.

---

## Slide 1 ⭐ — Portada

**Toyota Taller Perú**
Un e-commerce de repuestos donde el vendedor es un agente.

- Catálogo real de 24 repuestos con stock y precio en base de datos.
- Agenda de mantenimientos conectada a Google Calendar.
- **Toño**: un asesor conversacional que cotiza, agenda, cancela y llena el carrito — y que **no puede inventar un precio**.
- Construido con Spec Driven Development: especificado con Opus, ejecutado con Sonnet, desplegado en Render.

*Notas del expositor:* proyecto académico de demostración, sin afiliación con Toyota; precios, stock y pasarela son ficticios y hay disclaimer visible en el pie del sitio. Esa decisión también está escrita en el spec.

---

## Slide 2 — El problema

- En un taller peruano, el cliente **no sabe cómo se llama la pieza** que necesita. Dice «el filtro del aceite», «las pastillas de adelante», «el líquido rosado».
- Un catálogo web con filtros resuelve al que ya sabe buscar. No resuelve al que necesita que le pregunten «¿qué modelo y año es su Toyota?».
- Y agendar por teléfono depende de que alguien conteste entre 9 y 5.

**La apuesta:** la misma información —precio, stock, horarios libres— servida por dos fachadas: la web para quien sabe navegar, y un agente para quien prefiere preguntar.

*Notas del expositor:* de aquí sale el principio rector de la arquitectura, que aparece en el slide 6: la lógica vive en los servicios; el chat y la web son dos caras del mismo dato. Si el chat y la web dan respuestas distintas, es un bug.

---

## Slide 3 ⭐ — Cómo se construyó: Spec Driven Development

**No se empezó por el código. Se empezó por el contrato.**

Con **Opus** se escribió `SPEC.md` antes de la primera línea de aplicación:

| Métrica del spec | Valor |
|---|---|
| Extensión | **2,399 líneas**, 19 secciones |
| Objetivos con métrica de éxito | **7** (O1–O7) |
| Criterios de aceptación numerados | **45** (CA-01 a CA-45) |
| Supuestos declarados | **10** (S1–S10) |
| Preguntas abiertas, resueltas y tachadas en el propio documento | 4 (P1–P4) |
| Fases de implementación con entregable verificable | **9** (Fase 0 a Fase 8) |
| Estado al cierre de la especificación | *«Aprobado para implementar»* |

*Notas del expositor:* la diferencia entre «pedirle a un modelo que haga una tienda» y esto es que aquí el modelo recibió un documento donde **ya estaban tomadas** las decisiones ambiguas. El spec no describe lo que se hizo: es lo que se mandó a hacer.

---

## Slide 4 — Qué contiene un spec que sí sirve para ejecutar

| Sección | Qué resuelve por adelantado |
|---|---|
| §2 Objetivos **y no-objetivos** | Qué se hace y, explícitamente, qué **no**: sin login, sin cobro real, sin reprogramación de citas, sin WhatsApp, sin multi-idioma |
| §3 Decisiones técnicas cerradas | Cada elección **con su motivo**: por qué Supabase, por qué Render y no serverless (SSE), por qué el correo es la llave de identidad |
| §4 Arquitectura | Diagrama y **estructura de carpetas archivo por archivo**, antes de que existiera un solo archivo |
| §7 y §8 | El **SQL completo** de esquema y de datos de prueba — no una descripción del SQL, el SQL |
| §9 Diseño del agente | El **system prompt palabra por palabra** (R1–R9), las 9 herramientas con su JSON Schema, los guardrails y diálogos de referencia |
| §13 Dirección de arte | Tokens, tipografías, y reglas duras: *«nunca se anima un elemento que muestre precio o stock»* |
| §16 Criterios de aceptación | 45 pruebas concretas, ejecutables, no adjetivos |
| §17 Plan de implementación | 9 fases, cada una con un entregable **verificable** («Fase 3 → CA-01 a CA-05, CA-12 a CA-16») |
| §18 Supuestos | Lo que se asumió por decisión, para que nadie lo confunda con un olvido |

*Notas del expositor:* mostrar en pantalla el §9.2 (el system prompt) como ejemplo. Es el punto donde se ve mejor que el spec no es documentación: es materia prima ejecutable.

---

## Slide 5 ⭐ — La plataforma: e-commerce de repuestos

**Catálogo `/repuestos`** — 24 repuestos, 10 modelos Toyota, 3 mantenimientos, 12 preguntas frecuentes.

- **Filtros**: por categoría, por modelo de vehículo, búsqueda de texto y orden por precio.
- **Búsqueda tolerante a errores**: full-text search en español + trigramas. «filtro de acite corola» encuentra la pieza correcta (criterio CA-04).
- **Debounce de 350 ms** en el buscador: se navega una sola vez, no en cada tecla.
- **Imágenes reales** de fuentes con licencia abierta (Wikimedia Commons / Openverse), descargadas al repo — sin hotlinking, funciona offline. Las piezas sin foto confiable conservan un placeholder SVG generado por script. Atribución en `public/CREDITOS-IMAGENES.md`.
- **Estados de stock visibles**: «Disponible» · «Últimas unidades» · «Agotado» + días de reposición.
- **Ficha técnica** (`/repuestos/[slug]`): SKU, número de parte oficial, especificaciones, chips de compatibilidad por modelo/año, ubicación de rack — todo en monoespaciada, como en una orden de trabajo.

*Notas del expositor:* la dirección de arte es «catálogo técnico»: el producto vende confianza en el dato, así que el lenguaje visual es el del manual de servicio. Esquina superior derecha recortada, como la etiqueta que cuelga del espejo del carro en el taller.

---

## Slide 6 ⭐ — La plataforma: agenda y compra

**Agenda `/agenda`**
- Slots de 1 hora, lunes a viernes 09:00–17:00 hora de Lima. 8 slots por día hábil, 1 bahía.
- La disponibilidad se cruza contra **Google Calendar y Supabase a la vez**: si el taller bloquea una mañana creando un evento en su calendario, el sitio deja de ofrecerla.
- Reservar genera código (`CITA-2026-XXXX`), evento real en Google Calendar y **correo de confirmación** vía Brevo.

**Mis citas `/mis-citas`**
- El **correo electrónico es la llave**: sin contraseña, sin registro. El cliente escribe su correo y ve sus citas.
- Cancelar exige confirmación en modal y **libera el horario** al instante.

**Carrito y checkout**
- Carrito en `localStorage`; entrega a elegir: **recojo en tienda (gratis)** o **delivery en Lima (S/ 15, gratis desde S/ 300)**.
- IGV 18 % desglosado. Validación Luhn en el navegador, tarjetas de prueba a la vista.
- **La tarjeta nunca sale del navegador**: al servidor solo viajan los últimos 4 dígitos. Verificado leyendo el cuerpo crudo de la petición.
- Pedido persistido (`TTP-2026-XXXXX`), stock descontado de verdad, correo de confirmación.

*Notas del expositor:* la pasarela es simulada y el sitio lo dice en un banner sin necesidad de hacer scroll. Nunca se procesa un cobro real.

---

## Slide 7 ⭐ — Toño: el agente

**Quién es**
«Toño» es como se le dice en el Perú al mecánico de confianza. Comparte además las dos primeras letras de **Toy**ota. Trata de usted, respuestas de máximo 6 líneas, sin emojis salvo en el saludo. Nunca se presenta como «bot» ni «IA» — pero si le preguntan directamente si es una persona, responde con honestidad que es un asistente automatizado del taller (regla R9).

**Qué puede hacer: 4 capacidades, 9 herramientas ejecutadas en el servidor**

| Capacidad | Herramientas |
|---|---|
| **Inventario** — identifica la pieza, desambigua, cotiza precio y stock reales | `buscar_repuestos` · `consultar_disponibilidad_repuesto` · `agregar_al_carrito` |
| **Agenda** — consulta horarios libres y registra la cita | `listar_mantenimientos` · `consultar_disponibilidad_agenda` · `agendar_cita` |
| **Conocimiento** — responde técnica **solo de Toyota** | `buscar_conocimiento` |
| **Gestión de citas** — busca por correo y cancela liberando el slot | `consultar_citas` · `cancelar_cita` |

*Notas del expositor:* las mismas funciones de servicio que usan los endpoints REST de la web. El agente no tiene una base de datos «suya».

---

## Slide 8 ⭐ — Toño agendando: conversación fluida, no formulario

**Cómo se siente**

```
Cliente : Hola, necesito pastillas de freno
Toño    : Con gusto. ¿Para qué modelo y año es su Toyota, y necesita
          las delanteras o las traseras?
Cliente : Un Corolla 2018, las de adelante
          → buscar_repuestos(consulta="pastillas de freno delanteras",
                             modelo="Corolla", anio=2018)
Toño    : Pastillas delanteras 04465-02220 (juego de 4), cerámicas.
          Precio: S/ 210.00 · Stock: 18 unidades.
          ¿Las agrego al carrito o agendamos la instalación?
```

**Las reglas que hacen que se sienta humano sin serlo**

- **R4 — Pregunta antes de asumir.** Máximo 2 preguntas por turno; nunca una lista de cinco.
- Interpreta «mañana», «el lunes», «la próxima semana»: la fecha y hora actual se le inyecta en cada turno.
- **R5 — Confirma antes de agendar.** Nunca crea la cita sin repetir fecha, hora y servicio y recibir un «sí» explícito.
- **R8 — Cancelar exige doble confirmación**, repitiendo código, fecha y hora, y advirtiendo que no se puede deshacer.
- **Agrega al carrito de verdad:** `agregar_al_carrito` devuelve su resultado al navegador y el ítem aparece en el carrito real, con el contador del header actualizado. (Ese puente fue, precisamente, uno de los defectos que encontró la campaña de pruebas — slide 13.)

*Notas del expositor:* en un agendamiento real medido de punta a punta, Toño detectó una placa escrita con «ñ» («klñ456»), pidió confirmación y la normalizó a KLN456 antes de agendar. Eso no está programado caso por caso: es el comportamiento de un agente con reglas, no de un formulario.

---

## Slide 9 ⭐ — El guardrail: «el agente no adivina»

**Objetivo O4 del spec: cero respuestas con cifras que no vengan de una herramienta.**

| Capa | Qué hace | Dónde vive |
|---|---|---|
| **1 — Determinista, antes del LLM** | Si el mensaje trae una marca ajena (Nissan, Kia, BYD…) **y** una intención de cotizar, responde la plantilla sin gastar un solo token. Si la marca aparece sin intención de servicio («venía de un Nissan, ahora tengo un Corolla»), **no bloquea**: un bloqueo duro ahí sería un falso positivo molesto | `guardrails.ts` |
| **2 — El system prompt** | R1 (solo Toyota), R2 (solo el rubro), R3 (nunca inventes **ni repitas de memoria**) | `prompt.ts` |
| **3 — Validación de salida** | Si la respuesta final cita un **precio** (`S/ …` o la palabra «soles») o una **hora** (`HH:MM`) y en **ese turno** no se ejecutó una herramienta que lo respalde, la respuesta se descarta y **se le da al modelo un reintento** con la explicación de qué dijo sin respaldo. Si el reintento también falla, se envía una plantilla de fallo honesta | `guardrails.ts` + `runtime.ts` |

**Dos precisiones que costaron un defecto cada una:**
- El **horario fijo del taller está exento**: decir «atendemos de 09:00 a 17:00» es un dato del prompt, no un horario ofrecido. Pero «tengo libre a las 09:00» sí exige herramienta, aunque coincida con la hora de apertura.
- **El respaldo se exige del turno actual**, no de la conversación entera. Antes valía cualquier herramienta ya ejecutada en el hilo — y eso permitió, de forma reproducible, que la consulta de un repuesto «respaldara» el precio equivocado de un mantenimiento minutos después.

*Notas del expositor:* este guardrail es también el protagonista del giro de la historia de la latencia (slide 17). Guardarlo para ahí.

---

## Slide 10 ⭐ — Ejecución del spec con Sonnet

**El spec se ejecutó por fases, no de un tirón.** Cada fase del §17 cerraba contra sus criterios de aceptación:

| Fase | Entregable verificable |
|---|---|
| 0 · Andamiaje | Home con branding, tokens de diseño, 24 SVG generados |
| 1 · Datos | `01_schema.sql` + `02_seed.sql` corriendo en Supabase |
| 2 · Catálogo | E-commerce navegable completo, **sin agente todavía** |
| 3 · Agente base | Runtime de tool-calling, SSE, widget → CA-01 a CA-05, CA-12 a CA-16 |
| 4 · Agenda | Google Calendar + proveedor `mock` → CA-06 a CA-11 |
| 5 · Correo y citas | Brevo + 3 plantillas + `/mis-citas` → CA-21 a CA-28 |
| 6 · Checkout | Luhn, descuento de stock, confirmación → CA-17, CA-18, CA-36 a CA-40 |
| 7 · Pruebas | Vitest + harness de evals conversacionales |
| 8 · Despliegue | Render, accesibilidad, responsive, README |

**Reparto de modelos, visible en el propio historial de Git:**

- `Co-Authored-By: Claude Sonnet 5` → implementación, correcciones de defectos, selector de proveedor.
- `Co-Authored-By: Claude Opus 5` → especificación y la campaña de análisis de latencia.

**Ninguna fase dependió de credenciales externas para avanzar:** Calendar y correo tienen proveedores simulados (`CALENDAR_PROVIDER=mock`, `EMAIL_PROVIDER=consola`), y se conmutaron a los reales cuando llegaron las claves.

*Notas del expositor:* dato para el jurado — la Fase 4 y la Fase 5 se desarrollaron *completas* contra los mocks. El spec lo previó en §17 («ninguna bloquea el avance»). Eso es planificación, no suerte.

---

## Slide 11 — Disciplina de repositorio

- **Un guardián de credenciales automatizado:** `npm run check:server-only` falla la build si `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_PRIVATE_KEY`, `BREVO_API_KEY`, `NVIDIA_API_KEY`, `GROQ_API_KEY` u `OPENAI_TOKEN` se referencian fuera de `src/server/**`.
- **Fuente única para las constantes que se contradicen solas:** los datos del taller viven en `server/lib/taller.ts`; el nombre y la firma de Toño en `src/lib/agente.ts` (para que la UI y el system prompt no se desalineen); los tokens visuales en `globals.css`.
- **El indicador `● ABIERTO / ● CERRADO`** del encabezado usa la misma función de fechas que decide si un horario existe. Nunca puede contradecir lo que responde el agente.
- Cada cambio se cerró con `tsc --noEmit` limpio, `eslint` limpio y la suite en verde.

---

## Slide 12 ⭐ — GitHub y despliegue en Render

**Del commit al aire:**

1. `git push` a `main` en GitHub.
2. Render detecta el commit y dispara el **auto-deploy**.
3. Build `npm ci && npm run build` → Start `npm start` → Health check en `/api/health`.

**Se verificó explícitamente el mecanismo de despliegue**, con dos commits vacíos hechos a propósito: uno vía **Pull Request** (PR #1, rama `prueba/deploy-render`) y otro vía **push directo a main**, para confirmar cuál de los dos gatilla el auto-deploy.

**Decisiones de despliegue que valen la pena contar:**

| Punto | Decisión |
|---|---|
| Tipo de servicio | **Web Service de Node**, no Static Site — la aplicación tiene backend y SSE |
| Por qué Render y no serverless | El streaming SSE no tiene límites de tiempo, el rate limit en memoria es viable y hay Secret Files |
| Clave de Google | Como **Secret File** en `/etc/secrets/…json`, en vez de pelear con los saltos de línea de una variable multilínea en el dashboard |
| Variables de entorno | Render **no lee `.env.local`**: van a mano en el dashboard. Guardar dispara un redeploy |
| Riesgo conocido | El plan gratuito **duerme el servicio a los ~15 min** sin tráfico y el primer acceso tarda hasta un minuto. Para una demo en vivo: abrir la URL unos minutos antes |

---

## Slide 13 ⭐ — Testing: el plan

`PLAN-DE-PRUEBAS.md` — **427 casos diseñados en 6 capas**, cada uno trazable a un criterio de aceptación del spec.

| Capa | Casos |
|---|---:|
| UT — unitarias (lógica pura) | — |
| DB — SQL, triggers, RLS aislados | 31 |
| IT — servicios con Supabase simulado | 54 |
| API — contrato HTTP | 58 |
| E2E — navegación real | 62 |
| AG — evals conversacionales del agente | 70 |
| A11Y — accesibilidad | 34 |

**Dos herramientas propias del proyecto:**
- **Vitest** para la lógica de mayor riesgo: generación de slots y zona horaria de Lima (verificada bajo 3 zonas horarias de proceso distintas), IGV y costo de envío con el borde exacto de S/ 300, algoritmo de Luhn, detector de marcas ajenas con sus falsos positivos, idempotencia del correo.
- **Harness de evals** (`npm run eval`) que ejecuta criterios conversacionales contra el agente real con **aserciones deterministas** —qué herramienta se llamó y cuál no, y si las cifras citadas coinciden con la base de datos—, **no con un juez LLM**. Cada caso corre 3 veces y necesita 2 de 3; umbral del set: 90 %.

---

## Slide 14 ⭐ — Testing, informe 1: `INFORME-EJECUCION-PRUEBAS.md`

**Dos pasadas: revisión estática del código contra el spec, y navegación real como usuario.**

**Resultado: 17 defectos. 13 corregidos y verificados. 4 abiertos por decisión explícita.**
Suite unitaria: de **74 a 174 pruebas**.

**El hallazgo que justifica todo el ejercicio — DEF-09:**

> Pedí en el chat real «agrégalo al carrito». Toño respondió **«Listo, se agregó al carrito»** —una afirmación con apariencia de verdad, respaldada por un resultado de herramienta genuino (`{ok:true}`)— pero **el carrito del navegador seguía vacío**. La herramienta corría en el servidor; el resultado nunca llegaba al carrito real.

Es exactamente el tipo de mentira que ninguna prueba unitaria detecta: el servidor tenía razón, el cliente estaba vacío, y el usuario recibía una confirmación falsa.

**Otros dos que muestran el método:**
- **DEF-02** — el guardrail de salida estaba destruyendo respuestas **correctas** del agente por mencionar el horario fijo del taller. Un guardrail con falsos positivos también es un defecto.
- **DEF-17** — una **regresión introducida por mi propia corrección** de otro hallazgo: al unificar el formato de respuesta de las citas, `/mis-citas` empezó a caerse con `RangeError: Invalid time value`. Detectada en el mismo tramo de trabajo, con la consola del navegador real, y corregida antes de seguir.

*Notas del expositor:* el informe incluye una nota metodológica honesta: en el primer intento se «confirmó» DEF-09 leyendo la clave `ttp:carrito` de localStorage… que nunca existió (la real es `ttp_carrito`). Se repitió la prueba con la clave correcta y solo entonces se dio el hallazgo por cerrado. Vale la pena decirlo en voz alta: la evidencia final es sólida porque la primera se descartó.

---

## Slide 15 ⭐ — Testing, informe 2: `INFORME-E2E-NAVEGACION-REAL.md`

**Navegación sistemática con Playwright contra el build de producción, con todo real:** Supabase real, LLM real, correo Brevo real.
**~55 verificaciones · ~40 pasaron con evidencia · 7 hallazgos nuevos (DEF-18 a DEF-24), todos corregidos y reverificados. 179/179 pruebas en verde al cierre.**

**Lo que solo aparece navegando de verdad:**

- **DEF-18 (alta)** — el filtro por categoría del catálogo **no filtraba nada**. `?categoria=frenos` dejaba el badge activo y mostraba los 24 productos. Causa: PostgREST ignora en silencio un filtro sobre una relación embebida sin `!inner`. Es el camino más obvio de uso del catálogo, y estaba roto. Corregido: pasó de 24 resultados a los 5 reales.
- **DEF-24 (alta, no determinista)** — ante «¿Cuál es la capital de Francia?», el modelo respondió con el texto **idéntico carácter por carácter** de su respuesta anterior sobre una cita, en vez de rechazar el tema. Confirmado con el cuerpo crudo del SSE del servidor, no con la interfaz. Se corrigió detectando el eco del turno anterior y reutilizando el mecanismo de reintento.
- **El hallazgo extra, encontrado al verificar la corrección anterior:** el guardrail aceptaba como respaldo **cualquier herramienta ejecutada en cualquier momento de la conversación**. Preguntar por el precio del mantenimiento Express 5K devolvía **S/ 199.00** —el real es **S/ 189.00**— sin ninguna herramienta llamada en ese turno, porque horas antes se había consultado un repuesto distinto. **100 % reproducible**, más grave que el defecto que se estaba arreglando. Corregido exigiendo respaldo del turno actual.

**También se verificó lo que sí funciona, en vivo:**
- Compra real de punta a punta: pedido `TTP-2026-00002`, **stock real descontado de 48 a 47**, y el cuerpo de la petición contenía únicamente `{"tarjeta":{"ultimos4":"1111"}}`.
- El precio que cita el chat coincide exactamente con el de la ficha (S/ 38.00), **con el LLM real, no simulado**.
- Reservar en la web borra el slot que ofrece el chat; cancelar lo devuelve. Verificado en ambos sentidos.

*Notas del expositor:* también hay un falso positivo documentado y descartado antes de reportarlo: cambiar la cantidad del carrito con `fill()` de Playwright no dispara el `onChange` de React sobre un input controlado. Se repitió con teclado real y funcionaba. Se documenta para que quede claro que se verificó, no que se pasó por alto.

---

## Slide 16 ⭐ — Testing, informe 3: la campaña de latencia

**El síntoma:** el chat era lento. Turnos de 30, 70, hasta 139 segundos.

**La sospecha inicial:** el culpable son los **reintentos del guardrail**. Cada vez que el agente citaba un precio o una hora sin haber llamado la herramienta en ese turno, su respuesta se descartaba y se le daba otra oportunidad — una llamada completa más al modelo.

**Se actuó sobre esa sospecha primero** (commit *«Reducir la latencia del agente sin debilitar los guardrails»*), con tres capas que **no tocan el criterio de qué cuenta como respaldo**:

1. **Prevención** — R3 del prompt no cubría las horas ni el caso de «recapitular» un dato ya dicho. El modelo no inventaba: repetía de memoria algo que el prompt no le prohibía.
2. **Corte anticipado** — el guardrail se evalúa de forma incremental sobre el texto parcial y corta la generación apenas la violación es inequívoca, en vez de esperar el párrafo entero que igual se iba a descartar. **Ahorro medido: ~19–20 s por disparo** (2.3 s en vez de 22 s).
3. **Persistencia fuera del camino crítico** — las escrituras de traza se lanzan sin bloquear y se esperan al cierre del turno.

**Y se instrumentó lo que antes no se medía:** duración de cada llamada al LLM, y del lado del cliente un `tee()` del cuerpo SSE que registra el instante exacto de cada evento (`token`, `tool_start`, `tool_end`, `done`) **sin interferir con la aplicación real**.

*Notas del expositor:* hallazgo metodológico honesto del propio informe: `console.info` va a `stdout` y `console.warn` a `stderr` — archivos distintos. La primera pasada de análisis grepeó solo `stdout` y concluyó «cero disparos del guardrail». Se corrigió al revisar `stderr`. Una conclusión falsa a un `grep` de distancia.

---

## Slide 17 ⭐ — El giro: dónde estaban realmente los segundos

**30 turnos reales medidos contra el entorno vivo. El veredicto:**

| Componente del turno | Participación en el tiempo |
|---|---:|
| **Llamadas al proveedor del LLM** | **85–95 %** |
| Herramientas (Supabase, Google Calendar) | 2–4 % |
| Overhead de la aplicación (SSE, persistencia, troceado) | 3–5 % |

- **~22.9 segundos promedio por llamada al modelo**, con un rango de **7.2 a 68.8 s** — y sin correlación con la longitud de la respuesta: decidir llamar una herramienta costaba lo mismo que redactar un párrafo entero.
- Las herramientas tardan **entre 240 y 660 ms**. Son irrelevantes al lado del modelo.
- Un **agendamiento completo de 4 turnos costó 299.5 segundos (≈5 minutos)**, de los cuales **97 % fue el LLM** y apenas 3.2 s las herramientas.

**Y la sospecha inicial también se confirmó — pero como segundo actor, no como protagonista:**
- El guardrail disparó en **6 de los 8 turnos donde el patrón aplicaba (75 %)**, y en **7 de 30 turnos totales (23 %)**.
- El patrón más caro no era exótico: **preguntar por varios días seguidos** («¿y el jueves?», «¿y el viernes?») lo disparó **4 de 4 veces**.
- Cada disparo cuesta una llamada extra de 10–25 s. Real, caro… y aun así, minoritario frente al 85–95 %.

> **Conclusión que cambió la estrategia:** *la única palanca real no es acelerar las llamadas, es reducir cuántas se hacen — y sobre todo, cambiar de proveedor.*

*⚠️ Verificación de cifra para la exposición: la medición arrojó **85–95 %**, no 70 %. El dato real es más fuerte que el recordado; conviene citar el que está en el informe.*

---

## Slide 18 ⭐ — El diagnóstico fino: el cupo gratuito que se rellena gota a gota

**Se probó Groq como proveedor alternativo: 3–4× más rápido que NVIDIA NIM.** Pero apareció otro síntoma: **~15–20 % de `Connection error` transitorios bajo carga.**

**Se investigó con scripts de diagnóstico dedicados**, escritos para esto y versionados en el repo (`probar-latencia-groq.ts`, `probar-continuidad-groq.ts`, `probar-continuidad-groq-sinstream.ts`, `probar-tpm-groq.ts`):

- ❌ **Se descartó** el arranque en frío de la conexión.
- ❌ **Se descartó** el streaming: la versión sin streaming falló igual.
- ✅ **La causa es el presupuesto de tokens de la capa gratuita:**

| Límite del free tier | Efecto real sobre este agente |
|---|---|
| **8,000 tokens por minuto** | Cada llamada pesa **~2,495 tokens** (system prompt + las 9 herramientas), así que solo **~3.2 llamadas por minuto** son sostenibles. Una conversación normal las supera |
| **200,000 tokens por día**, implementados como **relleno continuo de ~2.3 tokens/segundo** — no un reseteo a medianoche | Agotado el cupo, **no vuelve de golpe: gotea**. El agente quedaba esperando y reintentando hasta juntar tokens suficientes para responder **un solo mensaje**… y en el siguiente volvía a esperar |

> Un agendamiento completo consume ~20,000 tokens. Con el cupo bajo, sencillamente **no cabe**.

**El detalle que se llevó una advertencia en el spec:**
*el `retry-after` de un límite por minuto se mide en segundos; el de un límite por día puede ser de varios minutos.* Reintentar contra un cupo diario agotado con backoff corto no sirve — **el cupo simplemente no está**. Antes de subir los reintentos para «arreglar» un 429, hay que mirar **qué tipo de límite** fue.

---

## Slide 19 ⭐ — La solución: el proveedor como variable de entorno

**Reintentos en dos capas, porque una no cubre a la otra:**
- En el **cliente del SDK**: reintenta fallos de conexión y 429/5xx de la conexión inicial, con backoff y respetando `Retry-After`.
- En el **runtime**: reintento explícito alrededor de la llamada **y del consumo del stream**, porque el reintento del SDK no cubre un stream que se corta a medio camino — que es justo lo que se midió. Solo reintenta `APIConnectionError` / `RateLimitError` / `InternalServerError`; **nunca un error de negocio**. Configurable con `AGENT_LLM_MAX_RETRIES`.

**Y, sobre todo, el proveedor dejó de estar cableado en el código:**

```
AGENT_LLM_PROVIDER = nvidia | groq | openai
```

| Proveedor | Modelo | Perfil |
|---|---|---|
| `nvidia` | `meta/muse-glimmer-30b` | **~18–22 s por llamada.** La decisión original del spec |
| `groq` | `openai/gpt-oss-120b` | **3–4× más rápido**, pero con el cupo gratuito del slide anterior |
| `openai` | `gpt-5-mini` | **De pago, sin cupos ajustados.** ~$0.25/$2 por millón de tokens; **un agendamiento completo cuesta ~$0.02** |

Los tres exponen (o son) una API compatible con el SDK de OpenAI, así que **un solo cliente** resuelve `apiKey`/`baseURL`/`modelo` según la variable. El resto del código no sabe cuál está activo. **Cambiar de proveedor en producción es editar una variable en el dashboard de Render — y guardar dispara el redeploy.**

**Una sorpresa que se detectó en vivo:** los modelos de razonamiento de OpenAI (`gpt-5*`, `o1`/`o3`/`o4`) **rechazan un `temperature` personalizado** con un 400. Se resolvió detectándolo **por el nombre del modelo**, no por el proveedor: si mañana la variable apunta a un modelo que sí lo soporta, el parámetro vuelve solo.

**Resultado: al cambiar de proveedor, el problema de latencia se resolvió.** No con una optimización heroica del código, sino con una medición que señaló al responsable correcto y una arquitectura que permitía reemplazarlo sin tocar una línea de lógica.

---

## Slide 20 — Lecciones aprendidas

1. **Especificar con un modelo, ejecutar con otro, funciona.** Opus escribió el contrato (2,399 líneas, 45 criterios); Sonnet lo ejecutó por fases. Los desacuerdos se resolvían mirando el spec, no discutiendo.
2. **Un criterio de aceptación es una prueba, no un adjetivo.** «CA-05: el precio del chat coincide con el de la ficha» se puede ejecutar. «El agente debe ser confiable» no.
3. **Las pruebas unitarias no ven las mentiras del producto.** DEF-09 —«Listo, se agregó al carrito», con el carrito vacío— tenía el servidor en verde. Hizo falta navegar de verdad.
4. **No optimices lo que no mediste.** La sospecha sobre los reintentos era razonable y resultó *cierta*… y aun así explicaba una fracción menor del problema. Sin la instrumentación, el esfuerzo habría seguido yendo al lugar equivocado.
5. **Un guardrail que nunca dispara no está protegiendo nada; uno que dispara de más cuesta dinero.** Los dos extremos aparecieron como defectos reales en este proyecto (DEF-02 y DEF-26).
6. **Prefiere el falso positivo.** Cuando el guardrail descarta una respuesta correcta, se paga latencia. Cuando deja pasar un precio inventado, se le miente a un cliente. El diseño elige, a propósito, el primer error.
7. **La capa gratuita de un proveedor es una decisión de arquitectura**, no un detalle de facturación: define cuántos turnos por minuto soporta el producto.

---

## Slide 21 — Lo que queda pendiente (dicho de frente)

- **Playwright no está versionado como suite.** Cada campaña de navegación real repite trabajo manual que un proyecto de pruebas convertiría en regresión automática. Es la deuda estructural más grande.
- **Los evals conversacionales están en 32 de los 70 casos** diseñados. Correr el set completo con 3 corridas por caso es lo que permitiría medir de verdad la fiabilidad de «agregar al carrito» por chat.
- **Las capas DB, IT, API y A11Y del plan no se ejecutaron** por completo — 177 casos diseñados y no corridos, documentados con su razón, no omitidos en silencio.
- **El streaming al cliente es simulado:** el texto se acumula, se valida y recién entonces se trocea. Un turno de 70 s se percibe como 70 s de pantalla en blanco. La mejora identificada —transmitir en vivo **solo cuando el turno ya ejecutó una herramienta de respaldo**, donde el guardrail no puede activarse— es de riesgo cero para la protección, y es el quick win #1 pendiente.

*Notas del expositor:* este slide no es una disculpa, es parte del argumento. Los tres informes distinguen sistemáticamente entre «no se ejecutó» y «pasó», y entre «defecto abierto por decisión» y «defecto olvidado». Un informe que solo cuenta lo que salió bien no es un informe.

---

## Anexo A — Cifras para citar de memoria

| Dato | Valor |
|---|---|
| Líneas del spec / secciones / criterios de aceptación | 2,399 · 19 · 45 |
| Fases de implementación | 9 (Fase 0 a Fase 8) |
| Herramientas del agente | 9 |
| Reglas inquebrantables del system prompt | 9 (R1–R9) |
| Capas de guardrails | 3 |
| Repuestos · modelos · mantenimientos · FAQ | 24 · 10 · 3 · 12 |
| Casos de prueba diseñados / capas | 427 / 6 |
| Pruebas unitarias | 74 → 174 → **179** |
| Defectos encontrados y numerados | **34** (DEF-01 a DEF-34) + 1 hallazgo adicional sin ID |
| Participación del proveedor LLM en la latencia | **85–95 %** |
| Promedio por llamada al LLM (NVIDIA NIM) | **22.9 s** (rango 7.2–68.8 s) |
| Latencia de las herramientas | 240–660 ms |
| Disparo del guardrail en turnos elegibles | 75 % (6 de 8) |
| Ahorro del corte anticipado por disparo | ~19–20 s |
| Cupo gratuito de Groq | 8,000 tokens/min · 200,000 tokens/día (relleno de ~2.3 tokens/s) |
| Peso de una llamada de este agente | ~2,495 tokens → ~3.2 llamadas/min sostenibles |
| Costo de un agendamiento completo con `gpt-5-mini` | ~$0.02 |

---

## Anexo B — Arco narrativo sugerido para la exposición

1. **Se especifica** (Opus) → un contrato de 45 criterios verificables.
2. **Se ejecuta** (Sonnet) → 9 fases, cada una cerrando contra sus criterios.
3. **Se despliega** (GitHub → Render) → auto-deploy verificado a propósito con commits vacíos.
4. **Se prueba de verdad** → y aparece la mentira: «Listo, se agregó al carrito», con el carrito vacío.
5. **Se mide** → y la sospecha (los reintentos) resulta cierta pero secundaria: el 85–95 % era el proveedor.
6. **Se diagnostica el proveedor** → el cupo gratuito no se recarga de golpe, gotea; el agente esperaba y reintentaba.
7. **Se resuelve cambiando la variable**, no el código — porque la arquitectura lo permitía.

**Frase de cierre sugerida:** *el trabajo no fue lograr que el agente respondiera; fue lograr que no pudiera mentir, y después descubrir —midiendo— por qué tardaba tanto en no mentir.*

---

## Anexo C — Notas de producción para la demo en vivo

- **Despertar el servicio** unos minutos antes: el plan gratuito de Render duerme a los ~15 min de inactividad y el primer acceso tarda hasta un minuto.
- **Verificar qué proveedor está activo** en el dashboard de Render (`AGENT_LLM_PROVIDER`) antes de empezar. Si el proveedor activo es Groq y el cupo diario está agotado, la recuperación más rápida es cambiar esa variable ahí mismo.
- **Guion de demo sugerido (3 minutos):** filtrar el catálogo por categoría → abrir una ficha → «Consultar a Toño» → pedirle el precio y que lo agregue al carrito → pedirle una cita para «el lunes» → confirmarla → preguntarle «¿tengo alguna cita?» con el correo → cerrar preguntándole por un **Kia** y por la **capital de Francia**, para mostrar los dos rechazos.
