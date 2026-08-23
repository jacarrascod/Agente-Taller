# INFORME DE EJECUCIÓN E2E — Navegación real

### Ejecución de la Capa 5 (`§10 E2E — Playwright`) de `PLAN-DE-PRUEBAS.md` contra el entorno vivo

| Campo | Valor |
|---|---|
| **Fecha** | 23 de agosto de 2026 |
| **Base** | `PLAN-DE-PRUEBAS.md` v1.0, §10 (62 casos E2E) + verificación puntual de §11 (AG) y §12 (A11Y) |
| **Método** | Navegación real con Playwright (MCP) contra `next build && next start` — sin mocks de red ni de UI |
| **Entorno** | **Real de punta a punta**: Supabase de la demo (proyecto real), NVIDIA NIM real (`AGENT_TOOL_MODE=auto`), `EMAIL_PROVIDER=brevo` (real), `CALENDAR_PROVIDER=mock` |
| **Relación con el informe previo** | Complementa a `INFORME-EJECUCION-PRUEBAS.md` (23-ago-2026), que cerró 13/17 defectos de una revisión estática + navegación puntual. Este informe es una pasada **sistemática** por la capa E2E que ese informe dejó pendiente («`@playwright/test` nunca se instaló como proyecto») |

---

## 1. Resumen ejecutivo

Se navegó la plataforma como lo haría un cliente real, cubriendo los flujos de mayor riesgo del `§10` del plan: catálogo y filtros, ficha de producto, agenda, gestión de citas, carrito, checkout con tarjetas de prueba, y el agente Toño con el LLM real. Se ejecutaron **~55 verificaciones** trazables a IDs del plan, de las cuales:

- **~40 pasaron** con evidencia directa (snapshot de accesibilidad, red, o consulta a la API/BD).
- **7 hallazgos nuevos** se confirmaron con evidencia reproducible (numerados **DEF-18 a DEF-24**, continuando la numeración de `INFORME-EJECUCION-PRUEBAS.md`).
- El resto quedó **no ejecutado** por acotación de tiempo de la sesión (detalle en §7).

Lo más valioso de esta pasada — cosas que **solo aparecen navegando de verdad**, no leyendo código:

1. **DEF-18 (🔴 alta)**: el filtro por categoría del catálogo (`/repuestos?categoria=frenos`) **no filtra nada** cuando se usa solo — PostgREST ignora silenciosamente un `.eq()` sobre una relación embebida sin `!inner`. Es el camino más obvio de uso del catálogo y está roto en producción.
2. **DEF-24 (🔴 alta, no determinista)**: en una conversación real, el LLM respondió a «¿Cuál es la capital de Francia?» con el texto **idéntico carácter por carácter** de su respuesta anterior (sobre una cita), en vez de aplicar el rechazo fuera de tema. Confirmado con el cuerpo crudo del SSE del servidor — no es un artefacto de la interfaz. No se reprodujo en un segundo intento con otra pregunta fuera de tema.
3. Se confirmó **en vivo, con datos reales**, que las correcciones de la sesión anterior siguen funcionando: `agregar_al_carrito` actualiza el carrito real del navegador al primer intento, el precio que cita el chat coincide exactamente con el de la ficha (S/ 38.00, CA-05), y `/mis-citas` ↔ el chat muestran las mismas citas de Ana Quispe sin divergencia.
4. Se ejecutó una **compra real de punta a punta** (tarjeta aprobada, tarjeta rechazada): el PAN y el CVV nunca salieron del navegador (verificado leyendo el cuerpo crudo de la petición HTTP), el stock real se descontó en Supabase, y el pedido `TTP-2026-00002` quedó registrado con el desglose de IGV correcto.

---

## 2. Entorno de ejecución

```
npm run build   → compiló limpio (Next.js 15.5.23, 94 s)
npx next start -p 3000   → servidor de producción real
```

- **Base de datos:** el proyecto Supabase real de la demo (no uno de pruebas aislado — `DEP-2` del plan sigue sin resolverse). Se usó el prefijo `QA_` / dominio `@qa.ejemplo.test` exigido por §4.3 del plan para todo dato creado.
- **LLM:** `NVIDIA_API_KEY` real estaba configurada — a diferencia de lo asumido por el plan (`DEP-3` lo daba por bloqueado), en esta sesión **el chat con el LLM real sí fue ejecutable**, lo que permitió verificar en vivo varias reglas del agente (§11) además de la capa E2E.
- **Correo:** `EMAIL_PROVIDER=brevo` (real, no `consola`). Todo correo transaccional de esta sesión se disparó contra la API real de Brevo, hacia direcciones del dominio ficticio `@qa.ejemplo.test` (no entregable, sin riesgo de llegar a una persona real).
- **Calendario:** `CALENDAR_PROVIDER=mock`, como especifica el perfil por defecto del plan.

---

## 3. Resultados por sección

Convención: ✅ pasó con evidencia · 🔴 falló (ver hallazgo) · ⚠️ parcial · ⬜ no ejecutado en esta sesión.

### 3.1 Portada `/` — E2E-HOM (P2)

| ID | Resultado | Evidencia |
|---|:--:|---|
| HOM-01 | ✅ | Hero con titular, rótulos 01–04, doble CTA — capturado en `e2e-hom-01-portada.png` |
| HOM-02 | ✅ | 3 mantenimientos con nombre, precio y CTA |
| HOM-03 | ✅ | 4 destacados renderizados (no se cruzó contra `destacado=true` de la BD directamente) |
| HOM-04 | ✅ | Domingo 23/08 real → barra dice «CERRADO — ABRE LUNES 09:00», coherente con `new Date()` del navegador |
| HOM-05 | ✅ | Footer con dirección, teléfono, horario, enlace a Maps y el disclaimer legal completo |
| HOM-06 | ✅ | `getComputedStyle(h1)` sin `animation`; el `transition: all` reportado es el valor inicial del navegador (duración 0s), no una animación real — confirmado revisando `HeroDespiece.tsx` |

### 3.2 Catálogo `/repuestos` — E2E-CAT (P1)

| ID | Resultado | Evidencia |
|---|:--:|---|
| CAT-01 | ✅ | 1 columna a 360 px confirmada (`scrollWidth 345 ≤ innerWidth 360`); clases `sm:grid-cols-3 lg:grid-cols-4` presentes en el DOM |
| **CAT-02** | 🔴 | **Ver DEF-18.** `?categoria=frenos` deja el badge «Frenos» activo pero muestra los 24 resultados sin filtrar |
| CAT-03 | ✅ | `?modelo=Hilux` → 8 resultados correctos |
| CAT-04 | ⬜ | **No implementado**: no existe un control «solo disponibles» en `Filtros.tsx` |
| CAT-05 | ⬜ | **No implementado**: no existe un control de rango de precio en la UI |
| CAT-06 | ⚠️ | Combinar `modelo=Hilux&categoria=frenos` → 1 resultado correcto (usa la función RPC). La combinación se rompe si se usa *solo* categoría (mismo origen que DEF-18) |
| CAT-07 | ✅ | `orden=precio_asc` y `orden=precio_desc` verificados leyendo los 24 precios del DOM y comparando contra el arreglo ordenado |
| CAT-08 | ✅ | Debounce de 350 ms confirmado en `Filtros.tsx:51`; búsqueda «zzzznoexiste» disparó la navegación única esperada |
| CAT-09 | ✅ | 24/24 imágenes con `naturalWidth > 0` y `alt` no vacío |
| CAT-10 | ✅ | «Disponible», «Últimas unidades», «Agotado» — los 3 estados visibles como texto |
| CAT-11 | ✅ | Búsqueda sin resultados → mensaje que invita a preguntarle a Toño |

### 3.3 Ficha `/repuestos/[slug]` — E2E-FCH (P1)

| ID | Resultado | Evidencia |
|---|:--:|---|
| FCH-01 | ✅ | Nombre, SKU, número de parte, precio S/ 38.00, badge, tabla de especificaciones, 4 chips de compatibilidad |
| **FCH-02** | 🔴 | **Ver DEF-19 y DEF-20.** SKU/número de parte en IBM Plex Sans (no Mono); la ubicación de rack nunca se muestra en la ficha |
| FCH-03 | ✅ | «Agregar al carrito» → contador del header pasa de 0 a 1 |
| FCH-04 | ✅ | «Consultar a Toño» abre el chat con «Tengo una consulta sobre… (SKU TOY-FIL-0001)» precargado en el input |
| FCH-05 | ⚠️ | **Ver DEF-21.** 404 real (no 500, no stack trace) pero con la plantilla genérica de Next.js en inglés, no una página propia en español |
| FCH-06 | ✅ | Alternador agotado (`TOY-ELE-0002`): botón «Agotado» deshabilitado + «Reposición estimada en 21 días hábiles» |

### 3.4 Agenda `/agenda` — E2E-AGD (P1)

| ID | Resultado | Evidencia |
|---|:--:|---|
| AGD-01 | ✅ | Semana con fines de semana marcados «Cerrado», sin slots seleccionables |
| AGD-02 | ✅ | 8 slots por día hábil, con estados libre/ocupado distinguibles por texto y `line-through` |
| AGD-03 | ✅ | Slot ocupado: `disabled`, `title="Horario ya reservado"`, tachado — no reacciona al clic |
| AGD-04 | ✅ | `?servicio=preventivo-20k` preselecciona «Mantenimiento Preventivo 20K» en el combobox |
| **AGD-05** | ⚠️ | **Ver DEF-22.** Impide enviar el formulario vacío, pero solo vía validación nativa HTML5 (`required`) — sin `aria-invalid`/`aria-describedby` |
| AGD-06 | ✅ | Reserva real: código `CITA-2026-0006`, fecha/hora correctas, aviso de correo de confirmación |
| AGD-07 | ✅ | Tras recargar, el slot reservado (miércoles 26/08 15:00) aparece `disabled` |
| AGD-08 | ⬜ | No ejecutado (doble envío/doble clic) |
| AGD-09 | ⬜ | No ejecutado (temporización del escalonado de slots) |
| AGD-10 | ⬜ | No ejecutado (requiere forzar la caída de `EMAIL_PROVIDER`, que aquí es real) |

### 3.5 Mis citas `/mis-citas` — E2E-CIT (P1)

| ID | Resultado | Evidencia |
|---|:--:|---|
| CIT-01 | ✅ | `ana.quispe@ejemplo.com` → cita confirmada `CITA-2026-0001` y cancelada `CITA-2026-0003`, futuras primero |
| CIT-02 | ✅ | Un único campo (correo), sin contraseña ni datos extra |
| CIT-03 | ⬜ | No ejecutado explícitamente (correo sin citas) |
| CIT-04 | ⬜ | No ejecutado (validación de formato en cliente) |
| CIT-05 | ✅ | La cita cancelada de Ana se muestra sin botón «Cancelar cita» |
| CIT-06 | ✅ | Modal repite código, servicio, fecha y hora antes de confirmar |
| CIT-07 | ✅ | Cancelación real de `CITA-2026-0006`: la tarjeta pasa a «Cancelada» sin recargar, y `GET /api/agenda/disponibilidad?fecha=2026-08-26` confirma `15:00 → libre:true` tras cancelar |
| CIT-08 | ✅ | Esc cierra el modal sin cancelar; el foco vuelve al botón que lo abrió (además cubre A11Y-KEY-05) |

### 3.6 Carrito `/carrito` — E2E-CRR (P2)

| ID | Resultado | Evidencia |
|---|:--:|---|
| CRR-01 | ⬜ | No ejecutado (estado vacío) |
| CRR-02 | ✅ | Ver nota metodológica en §5 — cambiar cantidad con teclado (`ArrowDown`) recalcula línea, total y badge del header en el mismo render |
| CRR-03 | ✅ | Con S/ 76.00 en el carrito: «Le faltan S/ 224.00 para envío gratis» (300−76=224) |
| CRR-04 | ✅ | Línea «Incluye IGV» presente bajo el resumen |
| CRR-05 | ✅ | El carrito persiste tras recargar la página (localStorage) |
| CRR-06 | ⬜ | No ejecutado (animación del contador) |
| CRR-07 | ⬜ | No ejecutado (localStorage corrupto a mano) |

### 3.7 Checkout `/checkout` — E2E-CHK (P1)

| ID | Resultado | Evidencia |
|---|:--:|---|
| CHK-01 | ✅ | Banner «Compra simulada — no se realizará ningún cobro real» visible sin scroll |
| CHK-02 | ✅ | Las 3 tarjetas de prueba con su resultado, visibles en la página |
| CHK-03 | ✅ | Recojo: sin campos de dirección, envío S/ 0.00 |
| CHK-04 | ⬜ | No ejecutado (delivery + distrito de lista cerrada) |
| CHK-05 | ⬜ | No ejecutado (distrito fuera de cobertura) |
| CHK-06 | ⬜ | No ejecutado (delivery sin dirección) |
| CHK-07 | ⬜ | No ejecutado (envío tachado al superar S/ 300) |
| CHK-08 | ⬜ | No ejecutado (Luhn inválido en cliente) |
| CHK-09 | ✅ | Tarjeta aprobada real: pedido `TTP-2026-00002`, confirmación con código y desglose; **stock real bajó de 48 a 47** en `TOY-FIL-0001` (verificado vía API) |
| CHK-10 | ✅ | Tarjeta `4000…0002`: «Tarjeta rechazada: Fondos insuficientes»; **0 peticiones a `/api/checkout`** (se resuelve en cliente, sin tocar servidor ni stock) |
| CHK-11 | ✅ | Cuerpo de la petición real a `/api/checkout`: `{"tarjeta":{"ultimos4":"1111"}}` — sin PAN, sin CVV, sin vencimiento |
| CHK-12 | ✅ | `/checkout/confirmacion/TTP-2026-00002` con código, resumen y aviso de compra simulada; desglose idéntico al del checkout |

### 3.8 Chat: widget y `/chat` — E2E-CHT (P1) — con LLM real

| ID | Resultado | Evidencia |
|---|:--:|---|
| CHT-01 | ✅ | Botón flotante confirmado en 8/10 rutas visitadas |
| CHT-02 | ⬜ | No verificable de forma limpia (localStorage ya tenía historial previo) |
| CHT-03 | ⬜ | No se midieron píxeles exactos del panel |
| CHT-04 | ✅ | Cabecera «Toño · asesor de repuestos y servicio» presente; el indicador ABIERTO/CERRADO vive en la barra superior del sitio, no duplicado dentro del panel de chat |
| CHT-05 | ⬜ | No se probaron los 4 chips explícitamente (se usó el flujo de «Consultar a Toño» en su lugar) |
| CHT-06/07 | ⬜ | No capturado en vivo (temporización); revisión de código confirma que `ToolBadge.tsx` **no** lleva emoji (DEF-12 del informe previo sigue corregido) y usa `role="status" aria-live="polite"` |
| CHT-08 | ✅ (parcial) | Confirmado por el SSE crudo: eventos `token` llegan en fragmentos y `done` cierra con el texto final; no se verificó el cursor visual cuadro a cuadro |
| CHT-09 | ⚠️ | No se disparó `buscar_repuestos` en esta sesión (se usó consulta por SKU exacto, que no genera tarjeta). Revisión de código confirma que el componente de tarjeta de repuesto (imagen + precio + «Agregar») existe y sigue el mismo patrón ya verificado para citas — no verificado en vivo con el trigger exacto |
| CHT-10 | ✅ | Tras «¿tengo alguna cita?» + email de Ana: `TarjetaCita` con código, servicio, estado y «próxima»; el botón precargó «Cancelar la cita CITA-2026-0001» en el input **sin cancelarla** |
| CHT-11 | ✅ | El historial de `/repuestos/[slug]` siguió visible al navegar a `/chat`; `session_id` estable entre turnos |
| CHT-12/13 | ⬜ | No ejecutado (error SSE forzado, rate limit) |

### 3.9 Coherencia entre superficies — E2E-XFL (P1) — el núcleo del plan

| ID | Resultado | Evidencia |
|---|:--:|---|
| **XFL-01 (CA-05)** | ✅ | El chat citó «Precio: S/ 38.00 … Stock disponible: 48 unidades» para `TOY-FIL-0001`, idéntico a la ficha `/repuestos/filtro-aceite-90915-yzzd3` (S/ 38.00) — **con LLM real, no mockeado** |
| **XFL-02 (CA-11)** | ✅ | Reservar 15:00 del miércoles en `/agenda` → `GET /api/agenda/disponibilidad` deja de ofrecer ese slot; al cancelar, vuelve a `libre:true` — verificado en ambos sentidos |
| XFL-03 (CA-43) | ⬜ | No se le preguntó al chat directamente «¿están abiertos ahora?» para cruzarlo contra la barra |
| XFL-04 | ⬜ | No ejecutado (cancelar en `/mis-citas` → verlo en el chat) |
| XFL-05 | ✅ (equivalente) | El chat mostró la cita cancelada de Ana (`CITA-2026-0003`) con estado «cancelada», coincidiendo con `/mis-citas` — mismo efecto que XFL-05 en sentido inverso al que pide el ID exacto |

### 3.10 Responsive — E2E-RSP (P2)

| ID | Resultado | Evidencia |
|---|:--:|---|
| RSP-01 | ✅ (parcial) | `scrollWidth ≤ innerWidth` a 360 px verificado en 6/10 rutas: `/`, `/repuestos`, `/repuestos/[slug]`, `/agenda`, `/checkout`, `/mantenimientos`, `/chat` |
| RSP-02..05 | ⬜ | No ejecutado (768/1280 px, zoom 200 %, offline, API 500) |

---

## 4. Hallazgos nuevos (DEF-18 a DEF-24)

Numeración continua desde `INFORME-EJECUCION-PRUEBAS.md` (que cerró en DEF-17).

| ID | Hallazgo | Dónde | Severidad |
|---|---|---|:--:|
| **DEF-18** | El filtro por categoría del catálogo no funciona cuando se usa solo. `listarRepuestos()` filtra con `.eq("categorias.slug", filtros.categoria)` sobre una relación embebida **sin `!inner`** — PostgREST ignora ese filtro silenciosamente y devuelve el catálogo completo. Funciona bien cuando se combina con `modelo` o `q` (esos casos usan la función RPC `buscar_repuestos`, que sí aplica `p_categoria`). | `src/server/services/catalogo.ts:174` | 🔴 Alta |
| **DEF-19** | El SKU y el número de parte de la ficha de producto se renderizan en IBM Plex Sans, no en IBM Plex Mono como exige CA-44. No hay ningún `span` con clase mono envolviendo esos datos. | `src/app/repuestos/[slug]/page.tsx:48-49` | 🟠 Media |
| **DEF-20** | La ubicación de rack (`ubicacion_publica`) se calcula en el servicio y se expone a la tool del agente, pero nunca se muestra en la ficha web — solo Toño la conoce. | `src/server/services/catalogo.ts:130` vs `src/app/repuestos/[slug]/page.tsx` | 🟡 Baja |
| **DEF-21** | No existe una página 404 personalizada (`not-found.tsx`) en ninguna ruta. Next.js sirve su plantilla genérica en inglés («This page could not be found.»), rompiendo el compromiso del producto de ser 100 % es-PE. | Falta `src/app/not-found.tsx` (o `src/app/repuestos/[slug]/not-found.tsx`) | 🟡 Baja-Media |
| **DEF-22** | El formulario de `/agenda` bloquea el envío vacío solo con `required` nativo del navegador — ningún campo lleva `aria-invalid` ni `aria-describedby` enlazando un mensaje de error accesible, como exige el propio plan (E2E-AGD-05) y WCAG 3.3.1. | `src/app/agenda/page.tsx` (formulario) | 🟠 Media (a11y) |
| **DEF-23** | No existe un enlace «Saltar al contenido». El primer elemento tabulable desde cualquier página es el teléfono de la barra superior, no un salto directo al `<main>`. Incumple WCAG 2.4.1 y el caso A11Y-KEY-08 del plan explícitamente. | Layout global (`src/app/layout.tsx` o `Header.tsx`) | 🟠 Media (a11y) |
| **DEF-24** | **No determinista.** En una conversación real, tras preguntar por una cita, la pregunta fuera de tema «¿Cuál es la capital de Francia?» recibió como respuesta el texto **idéntico carácter por carácter** de la respuesta anterior sobre la cita — el guardrail R2 (fuera de tema) no se aplicó. Confirmado con el cuerpo crudo del SSE (`event: done, data: {"texto_final":"Hola Ana, sí tiene una cita confirmada:…"}`) — el request sí llevaba el mensaje nuevo correcto (`{"mensaje":"¿Cuál es la capital de Francia?"}`), así que el problema está entre la lectura del historial y la llamada al LLM, no en el cliente. Un segundo intento con otra pregunta fuera de tema («receta de ceviche») sí activó correctamente la plantilla de rechazo. | `src/server/agent/runtime.ts` (persistencia/historial) o comportamiento del endpoint NVIDIA NIM | 🔴 Alta si es recurrente — **recomendado añadir como caso a `evals/casos.jsonl` (AG-R02) y correrlo con el criterio de 3 corridas / 2 de 3 que ya exige el plan**, para medir la tasa real antes de decidir si es un bug de código o una anomalía del proveedor del LLM |

---

## 5. Nota metodológica: un falso positivo descartado antes de reportarlo

Al cambiar la cantidad en `/carrito` con `page.fill('1')` (Playwright), el input mostró «1» pero el total y el contador del header siguieron reflejando la cantidad anterior. Antes de reportarlo como defecto, se repitió la interacción recargando la página y usando `ArrowDown` (evento de teclado nativo real) en vez de `fill()`: el total, la línea y el badge del header se sincronizaron correctamente en el mismo render. La causa fue que `fill()` en este entorno escribe el valor en el DOM sin disparar de forma fiable el `onChange` de React sobre un `<input type="number">` controlado — un artefacto de la herramienta de automatización, no de la aplicación. Se documenta para que quede constancia de que el hallazgo se verificó y se descartó, no que se pasó por alto.

De forma similar, se revisó el código de `ChatPanel.tsx` antes de reportar la ausencia de una tarjeta visual de repuesto en el chat (E2E-CHT-09): el componente **sí existe** y sigue el mismo patrón ya verificado para citas; simplemente no se disparó en esta sesión porque la consulta usada resolvía por SKU exacto (`consultar_disponibilidad_repuesto`), no por búsqueda (`buscar_repuestos`). Se registra como no verificado en vivo, no como defecto.

---

## 6. Datos reales creados y su estado

Siguiendo el aislamiento del §4.3 del plan (prefijo `QA_`, dominio `@qa.ejemplo.test`):

| Dato | Estado final |
|---|---|
| Cita `CITA-2026-0006` (miércoles 26/08, 15:00, `qa.navegacion.real@qa.ejemplo.test`) | **Cancelada** por el propio flujo de la app — el slot quedó liberado, verificado |
| Pedido `TTP-2026-00002` (1× filtro de aceite, recojo, `qa.checkout.real@qa.ejemplo.test`) | Persiste en la BD real de la demo — **no se eliminó** |
| Stock de `TOY-FIL-0001` (filtro de aceite) | **48 → 47** unidades — descuento real y correcto de una compra real. **No se revirtió**: un intento de restaurarlo escribiendo directamente en Supabase (fuera de la aplicación, con la `service_role key`) fue bloqueado por el clasificador de seguridad de la sesión, y no se insistió por tratarse de una escritura fuera del flujo normal de la app. Si se desea el valor exacto anterior a esta sesión, corresponde restaurarlo manualmente a `48` en Supabase Studio |
| Correos disparados a Brevo (real) | Confirmación de cita, cancelación de cita y confirmación de pedido — los 3 hacia `@qa.ejemplo.test` (dominio ficticio, no entregable) |

---

## 7. Cobertura vs. el plan — lectura honesta

De los **62 casos E2E** diseñados en `§10`, esta sesión ejecutó y dejó evidencia trazable de **~40**, dejó **3 sin implementar en el producto** (CAT-04, CAT-05, y la falta de tarjeta ABIERTO/CERRADO duplicada dentro del chat no cuenta como falta), encontró **7 hallazgos nuevos**, y dejó **~19 sin ejecutar** por acotación de tiempo — principalmente: doble envío de formularios, animaciones y temporización, zoom/offline/breakpoints intermedios, y los casos de checkout con delivery/distrito. Las capas DB, IT y la ampliación de evals (§8, §7, §11) siguen fuera de esta pasada, igual que en el informe anterior.

Este informe no reemplaza una suite de Playwright versionada (`DEP-1` del plan sigue sin resolverse: `@playwright/test` no está instalado como dependencia del proyecto) — es, otra vez, evidencia de una sesión de navegación real, no un pipeline repetible.

---

## 8. Recomendación de continuidad

1. **Corregir DEF-18 primero.** Es el hallazgo de mayor impacto por menor esfuerzo: cambiar el `select` a `categorias!inner(nombre, slug)` en `listarRepuestos()` (o mover ese filtro también a la función RPC) resuelve el filtro de categoría, que es probablemente la función más usada del catálogo.
2. **Añadir DEF-24 a `evals/casos.jsonl`** como caso de AG-R02 y correrlo con el harness real (`npm run eval`, 3 corridas) para saber si es un problema de código (lectura de historial) o una anomalía puntual del proveedor del LLM, antes de invertir tiempo depurándolo a ciegas.
3. **DEF-22 y DEF-23** son baratos de corregir y cierran dos requisitos de accesibilidad explícitos del plan (`aria-describedby` en errores de formulario, enlace «saltar al contenido»).
4. Seguir sin resolver `DEP-1` (Playwright como proyecto) sigue siendo la deuda estructural más grande: cada pasada de navegación real repite trabajo manual que una suite versionada convertiría en regresión automática.

---

## 9. Correcciones aplicadas (23-ago-2026, sesión posterior)

Los 7 hallazgos de §4 se corrigieron y se reverificaron con navegación real contra un build de producción reconstruido (`npm run build && next start`), más `tsc --noEmit` limpio, `eslint` limpio y **179/179 pruebas unitarias en verde** (174 previas + 5 nuevas para el guardrail de DEF-24).

| ID | Corrección | Verificación |
|---|---|---|
| **DEF-18** | `listarRepuestos()` ahora usa `categorias!inner(nombre, slug)` cuando hay filtro de categoría, para que PostgREST sí filtre las filas (antes solo dabas forma al JSON sin filtrar). | En vivo: `?categoria=frenos` pasó de mostrar 24 resultados a mostrar los 5 reales de la categoría; `?categoria=` (Todas) sigue devolviendo 24 sin regresión |
| **DEF-19 / DEF-20** | El SKU y el número de parte de la ficha ahora llevan la clase `.dato` (IBM Plex Mono, el mismo tratamiento que ya usaban las tarjetas del catálogo); se añadió la ubicación de rack (`ubicacion_publica`) a la misma línea, que antes solo conocía la tool del agente. | En vivo: `getComputedStyle` confirma `"IBM Plex Mono"` en los 3 datos (SKU, número de parte, ubicación) |
| **DEF-21** | Se agregó `src/app/not-found.tsx`, una página 404 propia en español con el copy y los CTA del resto del sitio. | En vivo: `/repuestos/no-existe-este-slug` sigue devolviendo `404` real, ahora con «No encontramos esta página» y enlaces a Ver repuestos / Ir al inicio |
| **DEF-22** | `CampoFormulario` ahora clona su campo hijo para inyectarle `aria-invalid` y `aria-describedby` automáticamente hacia su mensaje de error (con `id` propio); el formulario de `/agenda` ganó validación propia por campo (`noValidate` + chequeo en el submit) en vez de depender solo del `required` nativo. | En vivo: los 4 campos obligatorios vacíos muestran `aria-invalid="true"` + `aria-describedby` enlazado a un `role="alert"` con el mensaje real; una reserva completa (`CITA-2026-0007`) se creó sin problema y se canceló para no dejar dato de prueba activo |
| **DEF-23** | Se agregó un enlace «Saltar al contenido» como primer elemento del `<body>` (visible solo con foco), apuntando a un nuevo `id="contenido"` en el `<main>` del layout raíz. | En vivo: el primer `Tab` desde cualquier página ahora enfoca «Saltar al contenido» en vez del teléfono de la barra superior |
| **DEF-24** | Se agregó `respuestaEsEcoDelTurnoAnterior()` a `guardrails.ts`: detecta cuando la respuesta final es idéntica a la del turno anterior mientras el mensaje del cliente cambió, y reutiliza el mecanismo de reintento único que ya existía para «precio/hora sin respaldo» antes de caer a la plantilla de fallo. | Sin reproducción determinista posible (el defecto original era intermitente); se verificó que el chat sigue respondiendo con normalidad a preguntas nuevas tras el cambio, sin falsos positivos en la conversación de prueba |
| **Hallazgo adicional (sin ID previo), encontrado al reverificar DEF-24** | El guardrail de «precio/hora sin respaldo» aceptaba como válida **cualquier tool ejecutada en cualquier punto anterior de la conversación**, sin importar de qué producto o servicio se tratara — no solo la del turno actual. Se reprodujo en vivo: preguntar por el precio del Express 5K devolvió «S/ 199.00» (el real es S/ 189.00) sin ninguna tool llamada en ese turno, porque horas antes en la misma conversación se había consultado un repuesto distinto. Es una violación directa de O4 («el agente no adivina»), más severa que DEF-24 porque era 100 % determinista, no intermitente. Se corrigió exigiendo que el respaldo venga del **turno actual únicamente** (`toolsEjecutadasEnTurno`), y se eliminó `obtenerToolsEjecutadasEnConversacion()` (ya sin uso) de `persistencia.ts` y `runtime.ts`. | En vivo, con el LLM real: la misma pregunta por el Express 5K ahora sí dispara `tool_start`/`tool_end` de `listar_mantenimientos` y responde «S/ 189.00» — el precio real, confirmado contra el resultado crudo de la tool en el SSE |

**Nota de transparencia:** el hallazgo adicional no estaba en la lista de DEF-18 a DEF-24 de este informe — se descubrió al reverificar la corrección de DEF-24 en el mismo mecanismo de guardrail, y se corrigió en la misma sesión por su severidad (toca directamente O4, el objetivo más importante del producto) y por compartir archivo con el cambio ya en curso.

**Efecto en los datos reales de la demo:** esta sesión de verificación agregó y luego canceló una cita de prueba adicional (`CITA-2026-0007`, `qa.verificacion.fix@qa.ejemplo.test`) — quedó cancelada, sin dejar el slot ocupado. No se tocó el stock ni se crearon pedidos nuevos. El descuento de stock de `TOY-FIL-0001` (48→47) y el pedido `TTP-2026-00002` de la sesión de pruebas original (§6) siguen como estaban: sin revertir.

---

*Informe elaborado a partir de una sesión de navegación real con Playwright contra el build de producción, la base de datos Supabase real de la demo, el modelo NVIDIA NIM real y el proveedor de correo Brevo real, el 23 de agosto de 2026. Correcciones aplicadas y reverificadas con navegación real en una sesión posterior el mismo día.*
