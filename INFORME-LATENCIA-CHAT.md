# INFORME DE EJECUCIÓN — Latencia y reintentos del agente «Toño»

### Ejecución del `PLAN-DE-PRUEBAS-LATENCIA-CHAT.md` contra el entorno vivo, con navegación real (Playwright) y servicios reales (NVIDIA NIM, Google Calendar, Supabase)

**Fecha de ejecución:** 26-ago-2026, 03:03–03:46 UTC (≈43 minutos de campaña activa, en dos tandas)
**Numeración de hallazgos:** continúa desde DEF-24 (`INFORME-E2E-NAVEGACION-REAL.md`)
**Actualización (tanda 2, 03:38–03:46 UTC):** se ejecutó además el Grupo C (LAT-FLUJO-01) con datos y correo reales del solicitante, autorizado explícitamente para esta prueba — ver §2, §4 (filas 27-30) y §7 bis.

---

## 1. Resumen ejecutivo

**La demora es, en un 85-95 % de cada turno, el proveedor del LLM (NVIDIA NIM, `meta/muse-glimmer-30b`). Eso no tiene arreglo desde este repositorio.** Cada llamada individual al modelo tardó, en esta campaña, entre **7.5 y 68.8 segundos**, con un promedio de **~22 segundos** sobre 44 llamadas medidas — sin importar si el modelo solo debía decidir llamar una tool (poco texto de salida) o redactar un párrafo completo. Los tools (Supabase, Google Calendar) tardan entre 240 y 660 ms; son irrelevantes frente al LLM.

**Pero tu sospecha sobre los reintentos también se confirmó, y con más fuerza de la esperada.** El guardrail de recapitulación se activó en **6 de los 26 turnos** ejecutados (23 % del total), y en **6 de los 8 turnos donde el patrón realmente aplicaba** (75 %) — muy por encima de lo anticipado. El patrón más costoso no fue "recordar un dato viejo", sino algo más cotidiano: **preguntar por varios días seguidos** ("¿y el jueves?", "¿y el viernes?") disparó el guardrail en 4 de 4 intentos consecutivos dentro de la misma conversación. Cada disparo cuesta una llamada extra al LLM de entre 10 y 25 segundos.

**El hallazgo más grande de todos no estaba en las hipótesis originales:** el "streaming" del chat es una simulación. El cliente no ve ni un carácter hasta que el turno completo — con sus 1, 2 o hasta 4 llamadas al LLM — ha terminado. Un turno de 70 segundos se percibe como 70 segundos de pantalla en blanco, no como una respuesta progresiva. Esto es 100 % corregible sin tocar el guardrail, y es la recomendación de mayor impacto de este informe.

**El flujo de agendamiento real (Grupo C) confirmó todo lo anterior y añadió un matiz nuevo.** El turno de confirmación de datos (turno 3, el más largo medido en un flujo de negocio: **156 segundos**) disparó el guardrail al final de un párrafo — el modelo redactó una confirmación completa que terminaba mencionando la hora ("...a las 10:00") sin haber vuelto a llamar la tool ese turno. El corte anticipado (Capa 2) **no alcanzó a actuar** porque no quedaba suficiente texto después de la hora antes de que la generación terminara naturalmente — un límite real del margen de seguridad de 25 caracteres. Además, la hora en cuestión era literalmente la que el cliente **acababa de escribir en su propio mensaje** ("A las 10, mis datos son…") — el guardrail no distingue entre un dato inventado y un dato que el cliente mismo proporcionó, porque solo mira el patrón del texto de salida, no su procedencia. Ver DEF-34.

Se ejecutaron **30 turnos reales** contra el LLM en vivo (Grupos E, A, B y D completos según prioridad P1, más LAT-FLUJO-01 del Grupo C; la mayoría del Grupo F y LAT-FLUJO-02/03 se aplazaron — ver §7). **El flujo de agendamiento sí se ejecutó de punta a punta con datos reales**: se creó la cita **CITA-2026-0012** (Juan Carrasco, jacarrascod@gmail.com, Corolla 2018, lunes 31 de agosto 10:00), con evento de Google Calendar confirmado (`google_event_id` no nulo) y correo de confirmación real enviado vía Brevo — ver §7 bis y §10.

---

## 2. Alcance ejecutado vs. plan original

| Grupo | Planeado | Ejecutado | Nota |
|---|---|---|---|
| PRE-1/2/3 | Instrumentación | ✅ Completo | Ver §3 |
| E — LAT-SEG | 8 casos | ✅ 8/8 | Todos en sesiones frescas independientes |
| A — LAT-BAS | 6 casos | ⚠️ 3/6 (los P1) | Se omitieron los 3 casos P2 por presupuesto de tiempo |
| B — LAT-TOOL | 7 casos | ⚠️ 7 turnos ejecutados, reorganizados | TOOL-01, TOOL-03/04 (fusionados en una sesión de 5 turnos), TOOL-05. Se omitieron TOOL-06/07 (P2) |
| C — LAT-FLUJO | 3 casos | ✅ 1/3 (LAT-FLUJO-01) | Ejecutado en una segunda tanda (03:38-03:46 UTC), autorizado explícitamente por el solicitante con su correo real (jacarrascod@gmail.com) en vez de un alias de pruebas. Cita real creada: **CITA-2026-0012**. LAT-FLUJO-02 (mensaje único con todo) y LAT-FLUJO-03 (cancelación) quedan pendientes |
| D — LAT-RECAP | 8 casos × 3 repeticiones = 24 ejecuciones | ⚠️ 4 pares × 1 repetición = 8 turnos | **Desviación metodológica declarada**: el plan pedía 3 repeticiones por caso para distinguir señal de ruido (temperatura 0.3). Se ejecutó una sola pasada por caso debido al costo real de tiempo (cada par cuesta 30–140 s). Los resultados de este grupo deben leerse como **evidencia direccional fuerte, no como tasas estadísticamente definitivas** |
| E — repetido tras cambios | — | No aplica | No se aplicó ningún cambio de código durante esta campaña (es un informe de medición, no de implementación) |
| F — LAT-BORDE | 7 casos | ❌ 0/7 — no ejecutado | Prioridad P2; se dejó fuera por presupuesto de tiempo frente al valor ya obtenido de A/B/D |

**Total: 30 turnos reales ejecutados** de los ~55 planeados. La reducción de alcance fue deliberada y se prioritizó cubrir con profundidad las preguntas P1 (¿de quién es la demora? ¿cuánto cuesta un reintento?) antes que la cobertura exhaustiva de casos borde.

---

## 3. Instrumentación usada

- **PRE-1**: el dev server se relanzó con `stdout` y `stderr` redirigidos a archivo. **Hallazgo metodológico propio**: `console.info` (con los tiempos por iteración) va a `stdout`, pero `console.warn`/`console.error` (con los disparos del guardrail) van a **`stderr`** — son archivos separados. La primera pasada de análisis de esta campaña grepeó solo `stdout` y concluyó erróneamente "cero disparos del guardrail"; se corrigió al revisar `stderr`.
- **PRE-2/3**: se inyectó, vía `page.evaluate`, un envoltorio de `window.fetch` que hace `tee()` del `body` de la respuesta de `/api/chat` — una rama se entrega intacta al `ChatPanel` (cero interferencia con la app real) y la otra se usa para registrar el timestamp (`performance.now()`) de cada bloque SSE (`token`, `tool_start`, `tool_end`, `done`). El `sessionId` de cada caso se fijó de forma determinística en `localStorage` (`lat-<caso>`) antes de cada prueba, para poder correlacionar directamente con `sessionId` en los logs del servidor y en Supabase.
- **Limitación descubierta de la instrumentación**: los eventos SSE que llegan en el mismo paquete TCP comparten el mismo timestamp del lado cliente (p. ej. `tool_start` y `tool_end` casi siempre muestran el mismo `t`). Esto confirma indirectamente que el servidor emite ambos eventos en la misma escritura, pero **invalida usar los timestamps del cliente para medir la duración real de una tool** — para eso se usó `latencia_ms`, ya persistido en Supabase por el propio servidor.
- **Corrección de arranque necesaria**: tras `page.reload()`, escribir en el `<input>` inmediatamente (con `fill()`) no siempre llega al estado de React — es una carrera con la hidratación del cliente en Next.js dev mode. Se resolvió con una espera fija de 1.2 s tras `reload()` antes de interactuar.

---

## 4. Tabla maestra de mediciones

Todas las duraciones en milisegundos salvo donde se indique. `T_llm` = suma de `duracionMs` de todas las iteraciones del turno (servidor). `T_tools` = suma de `latencia_ms` de las tools del turno (Supabase). `T_overhead` = `T_total − T_llm − T_tools` (escrituras a Supabase, red, troceado). `GR` = ¿disparó el guardrail de salida?

| # | sessionId / turno | N_iter | T_llm | T_tools | T_total | T_overhead | GR |
|---|---|---|---|---|---|---|---|
| 1 | lat-seg-01 (bloqueado Capa 1, sin LLM) | 0 | 0 | 0 | 7,785 | 7,785¹ | — |
| 2 | lat-seg-02 | 1 | 27,587 | 0 | 28,452 | 865 | No |
| 3 | lat-seg-03 | 1 | 27,065 | 0 | 28,048 | 983 | No |
| 4 | lat-seg-04 | 2 | 32,064 | 241 | 33,468 | 1,163 | No |
| 5 | lat-seg-05 | 2 | 47,498 | 464 | 49,219 | 1,257 | No |
| 6 | lat-seg-06 | 2 | 55,869 | 248 | 57,358 | 1,241 | No |
| 7 | lat-seg-07 | 1 | 16,647 | 0 | 17,686 | 1,039 | No |
| 8 | lat-seg-08 | 1 | 26,451 | 0 | 27,538 | 1,087 | No |
| 9 | lat-bas-01 «Hola» | 1 | 8,210 | 0 | 9,561 | 1,351 | No |
| 10 | lat-bas-02 | 1 | 16,282 | 0 | 17,207 | 925 | No |
| 11 | lat-bas-03 (exención horario) | 1 | 17,062 | 0 | 18,091 | 1,029 | No |
| 12 | lat-tool-01 | 2 | 28,414 | 354 | 30,126 | 1,358 | No |
| 13 | h2 turno 1 (miércoles) | 2 | 42,041 | 548 | 43,827 | 1,238 | No |
| 14 | h2 turno 2 (jueves) | 3 | 34,812 | 435 | 36,212 | 965 | **Sí** |
| 15 | h2 turno 3 (viernes) | 3 | 69,508 | 377 | 70,897 | 1,012 | **Sí** |
| 16 | h2 turno 4 (lunes) | 3 | 71,098 | 463 | 72,795 | 1,234 | **Sí** |
| 17 | h2 turno 5 (martes) | 3 | 52,464 | 461 | 53,866 | 941 | **Sí** |
| 18 | lat-tool-05 (rango 3 días) | 2 | 54,382 | 661 | 56,155 | 1,112 | No |
| 19 | lat-recap-01 carga | 2 | 42,673 | 500 | 44,772 | 1,599 | No |
| 20 | lat-recap-01 trampa | 3 | 31,079 | 441 | 32,530 | 1,010 | **Sí** |
| 21 | lat-recap-03 carga | 2 | 24,711 | 237 | 26,087 | 1,139 | No |
| 22 | lat-recap-03 trampa | 2 | 33,901 | 258 | 35,072 | 913 | No² |
| 23 | lat-recap-05 carga | 2 | 42,388 | 431 | 43,995 | 1,176 | No |
| 24 | lat-recap-05 trampa | 3 | 38,856 | 369 | 40,194 | 969 | **Sí** |
| 25 | lat-recap-06 carga | 2 | 38,333 | 311 | 39,906 | 1,262 | No |
| 26 | lat-recap-06 trampa | **4** | 136,203 | 1,391 | **139,102** | 1,508 | No³ |
| 27 | lat-flujo-01 turno 1 («quiero agendar») | 2 | 42,805 | 236 | 44,699 | 1,658 | No |
| 28 | lat-flujo-01 turno 2 (fecha + servicio) | 2 | 26,799 | 423 | 28,263 | 1,041 | No |
| 29 | lat-flujo-01 turno 3 (datos + confirmación) | **4** | 154,090 | 851 | **156,139** | 1,198 | **Sí⁴** |
| 30 | lat-flujo-01 turno 4 («Sí, confírmalo») | 3 | 66,080 | 3,205⁵ | 70,385 | 1,100 | No |

¹ Incluye ~3.9 s de compilación JIT de `/api/chat` en Next.js dev (primera petición tras reiniciar el servidor) — artefacto de entorno, no reproducible en producción (`next start`).
² El modelo se auto-corrigió: volvió a llamar `listar_mantenimientos` sin que el guardrail necesitara intervenir. Evidencia directa de que el endurecimiento de R3 (25-ago) funciona para la recapitulación simple de un mismo dato.
³ Tres llamadas a `buscar_repuestos` (no el guardrail de precio/hora) — ver Hallazgo DEF-31.
⁴ Disparó al **final** de un párrafo de confirmación, mencionando una hora que el propio cliente acababa de escribir en su mensaje — el corte anticipado no alcanzó a actuar por falta de margen de texto tras la hora. Ver DEF-34.
⁵ Incluye `agendar_cita` (2,704 ms: Supabase + Google Calendar + Brevo encadenados) además de una revalidación de disponibilidad (501 ms) — ver §7 bis.

**Promedio de `duracionMs` por llamada individual al LLM** (n=55, excluyendo las 6 llamadas cortadas anticipadamente por la Capa 2): **≈22.9 s**, rango 7.2–68.8 s.
**Promedio de las 6 llamadas cortadas anticipadamente**: ≈2.3 s (vs. los ~22 s que habría costado esperar el párrafo completo).

---

## 5. Veredicto de las hipótesis

| ID | Hipótesis | Veredicto | Evidencia |
|---|---|---|---|
| **H1** | El guardrail dispara con frecuencia y cada disparo cuesta un round-trip completo | **CONFIRMADA**, con más fuerza de la esperada | 6/8 turnos "elegibles" de recapitulación (75 %) dispararon, más 1 disparo adicional en el flujo real de agendamiento (fila 29) por un motivo distinto (hora al final de un párrafo de confirmación, no recapitulación) — **7 disparos en total sobre 30 turnos (23 %)**. Cada uno costó una iteración extra de 10–55 s |
| **H2** | `clienteCalendar()` re-autentica en cada llamada | **CONFIRMADA arquitectónicamente, impacto marginal medido** | `latencia_ms` de `consultar_disponibilidad_agenda` se mantuvo plano (377–661 ms) a lo largo de 7 llamadas sucesivas en la misma sesión, sin tendencia a la baja — consistente con cero reutilización de token. Pero el rango absoluto (≤660 ms) es irrelevante frente a los 15,000–40,000 ms del LLM |
| **H3** | Una consulta de rango hace un `freebusy.query` por día (fan-out) | **CONFIRMADA en el código, MITIGADA en la práctica** | El rango de 3 días (lat-tool-05, fila 18) tardó 661 ms — comparable a UNA sola consulta de 1 día (377–548 ms), no el triple. El fan-out por día existe (`Promise.all` en `agenda.ts`), pero corre en paralelo, así que el costo extra real es de ~150-200 ms, no lineal |
| **H4** | El modo `auto` cae a `json` y encarece los turnos | **DESCARTADA** | Los 44 registros de `Llamada al LLM completada` muestran `modo: 'native'` sin excepción; nunca se activó el fallback a `json` |
| **H5** | El "streaming" es simulado: el cliente no ve nada hasta el final | **CONFIRMADA — es el hallazgo de mayor impacto** | En los 26 turnos, el evento `token` y el evento `done` llegan con el mismo timestamp relativo del lado cliente. El usuario mira una pantalla vacía durante turnos de hasta 139 s |
| **H6** | Turnos simples consumen más de 1 iteración sin necesidad | **PARCIALMENTE CONFIRMADA, por una causa distinta a la anticipada** | Los turnos genuinamente simples (Grupos A y E sin tool) mantuvieron `N_iter=1` de forma consistente. El exceso de iteraciones viene de (a) el guardrail (H1) y (b) un patrón nuevo no anticipado: `buscar_repuestos` a veces necesita 2-3 llamadas para desambiguar un término genérico (ver DEF-31) |
| **H7** | El overhead de la app (Supabase, SSE, troceado) es significativo | **DESCARTADA como palanca principal** | `T_overhead` se mantuvo estable entre 865 y 1,600 ms en los 26 turnos — ya reducido por las escrituras no bloqueantes del 25-ago. Es real pero pequeño: ~1,000 ms sobre turnos de 9,000–139,000 ms |

---

## 6. Descomposición del turno típico

Tomando la mediana de los turnos "normales" (sin disparo de guardrail, N_iter=1 o 2): de cada 100 % del tiempo de un turno,

- **~90-95 %** — llamadas al LLM (NVIDIA NIM). **Inherente, no accionable.**
- **~2-4 %** — ejecución de tools (Supabase / Google Calendar).
- **~3-5 %** — overhead de la aplicación (Supabase, SSE, troceado).

En los turnos donde dispara el guardrail, esa distribución cambia: se añade una iteración completa de LLM (10-25 s) que en el turno típico simplemente no existiría — el guardrail, cuando dispara, puede añadir entre **30 % y 100 % de tiempo extra** sobre lo que ese turno habría costado sin el rebote.

---

## 7. Hallazgos (continúan desde DEF-24)

### DEF-25 · La latencia del proveedor LLM domina el presupuesto de tiempo — INHERENTE
**Síntoma:** cada llamada a NVIDIA NIM tarda entre 7.5 y 68.8 s, sin correlación aparente con la longitud de la salida (una decisión corta de llamar una tool tardó lo mismo que un párrafo completo).
**Evidencia:** 44 valores de `duracionMs` en el log, promedio 22.0 s (§4).
**Causa raíz:** latencia/cola del endpoint `meta/muse-glimmer-30b` en NVIDIA NIM. Fuera del control de este repositorio.
**Categoría:** INHERENTE. **Esfuerzo de arreglo:** N/A — no es un problema de este código.

### DEF-26 · El guardrail de recapitulación dispara en el 75 % de los turnos elegibles, sobre todo en secuencias de "otro día" — ACCIONABLE-PROMPT
**Síntoma:** en una sesión donde se preguntó por 5 días de disponibilidad consecutivos, 4 de los últimos 4 turnos (jueves, viernes, lunes, martes) dispararon el guardrail — el modelo respondía citando horarios de memoria antes de volver a llamar la tool para la fecha nueva.
**Evidencia:** filas 14-17 de §4; bloques de `stderr` con `textoDescartado` idéntico en estructura ("Sí, el [día] de [mes] tenemos espacio... Horarios libres de 09:00 a 17:00...").
**Causa raíz:** el modelo generaliza el patrón de la respuesta anterior (mismo formato, mismo rango horario aparente) en vez de tratar cada fecha nueva como una consulta independiente que exige una llamada a la tool.
**Categoría:** ACCIONABLE-PROMPT. **Esfuerzo:** bajo — una instrucción explícita adicional. **Es el quick win #1 más concreto de este informe** (ver §8).

### DEF-27 · El corte anticipado (Capa 2, cambio del 25-ago) funciona correctamente en navegación real — confirmación positiva
**Síntoma/observación:** en los 6 disparos del guardrail, el texto descartado se cortó en ~80-100 caracteres (p. ej. `"...Horarios libres de 09:00 a 17:00:\n09:00, 10:00, 11:00, 12:00"`), no el párrafo completo.
**Evidencia:** `cortadoAnticipadamente: true` + duraciones de 1,811–3,336 ms en las llamadas cortadas, frente al promedio de 22,000 ms de una llamada completa.
**Impacto:** cada disparo ahorra ~19-20 s de generación que de todas formas iba a descartarse. No elimina el costo del reintento (siguen pagándose 1-2 llamadas más), pero reduce el desperdicio de la llamada fallida en ~90 %.
**Categoría:** ACCIONABLE-CÓDIGO — **ya implementado y funcionando correctamente**, no requiere acción adicional.

### DEF-28 · El streaming al cliente es enteramente simulado — ACCIONABLE-PERCEPCIÓN (el hallazgo de mayor impacto)
**Síntoma:** en los 26 turnos medidos, el primer evento `token` y el evento `done` llegan en el mismo instante relativo — el texto se transmite de una sola vez, troceado artificialmente después de validado, nunca en vivo.
**Evidencia:** campo `medicion.eventos` de la instrumentación cliente en todos los casos (§3); confirma el comentario ya presente en `runtime.ts:76-83`.
**Impacto en UX:** un turno de 30, 70 o 139 segundos se percibe como 30, 70 o 139 segundos de pantalla completamente vacía (sin contar el indicador de "Consultando…" cuando hay tool). Es, con diferencia, la palanca de **percepción** más grande disponible — no reduce el trabajo real del servidor, pero cambia radicalmente cómo se experimenta la espera.
**Categoría:** ACCIONABLE-PERCEPCIÓN. **Esfuerzo:** medio. **Riesgo:** cero, si se implementa condicionado (ver quick win #2 en §8) — nunca se transmite un precio/hora en vivo sin respaldo.

### DEF-29 · `consultarOcupado` re-autentica a Google en cada llamada — ACCIONABLE-CÓDIGO, impacto marginal
**Síntoma:** `latencia_ms` de `consultar_disponibilidad_agenda` se mantiene plano (377-661 ms) a lo largo de 7 llamadas sucesivas en la misma sesión, sin tendencia decreciente que indicaría reutilización de credenciales.
**Evidencia:** tabla de latencias Supabase, §4 filas 13-17.
**Causa raíz:** `clienteCalendar()` en `google-calendar.ts:53-62` crea un `google.auth.JWT` nuevo y llama `auth.authorize()` en cada invocación, en vez de cachear el cliente autenticado a nivel de módulo.
**Impacto real medido:** ≤660 ms por llamada — **1-3 % del tiempo de un turno típico**. Vale la pena arreglarlo por higiene (es gratis y sin riesgo), pero no es un quick win que el usuario vaya a notar.
**Categoría:** ACCIONABLE-CÓDIGO. **Esfuerzo:** bajo.

### DEF-30 · El fan-out de `freebusy` por día existe pero corre en paralelo — impacto menor al estimado antes de medir
**Síntoma:** una consulta de rango de 3 días (lat-tool-05) tardó 661 ms — prácticamente igual a una consulta de 1 solo día (377-548 ms), no el triple.
**Evidencia:** fila 18 de §4 vs. filas 13-17.
**Causa raíz:** `consultarDisponibilidad` en `agenda.ts:125` sí hace un `Promise.all` sobre `calcularDia` por cada día del rango (una llamada Google independiente por día), pero al ejecutarse en paralelo, el costo de pared es cercano al de la llamada más lenta, no la suma.
**Corrección respecto a la revisión de código previa a esta campaña:** se había estimado que esto podía ser un problema serio de escalamiento; medido en la práctica, el costo extra es de ~150-200 ms para un rango de 3 días — órdenes de magnitud por debajo de cualquier llamada al LLM.
**Categoría:** ACCIONABLE-CÓDIGO, impacto marginal. **Esfuerzo:** medio (batchear en un solo `freebusy.query` con un rango amplio).

### DEF-31 · `buscar_repuestos` puede necesitar hasta 3 llamadas para desambiguar un término genérico — ACCIONABLE-PROMPT/CÓDIGO (nuevo, no anticipado)
**Síntoma:** al preguntar "¿Y el kit de embrague cuánto cuesta?" tras una consulta previa sobre un filtro de aceite, el modelo llamó `buscar_repuestos` con `consulta: "kit de embrague"` (sin match útil), luego con `consulta: "embrague", categoria: "transmision"`, y aparentemente una tercera vez, antes de responder. El turno completo tardó **139.1 segundos** — 4 iteraciones de LLM (11.8s + 21.5s + 68.8s + 34.1s).
**Evidencia:** fila 26 de §4, la más extrema de toda la campaña.
**Causa raíz:** no está relacionado con el guardrail de salida — es la lógica de desambiguación de `buscar_repuestos` (T1, `sugerencia_al_agente`) pidiéndole al modelo reintentar con términos más específicos, sin que el modelo acierte a la primera con el nombre exacto del catálogo.
**Categoría:** ACCIONABLE-PROMPT (mejor guía en el prompt sobre cómo formular la búsqueda) o ACCIONABLE-CÓDIGO (ampliar el mapeo de sinónimos de la tool: "kit de embrague" → "embrague"/"transmisión" debería resolver directo). **Esfuerzo:** medio. **Este es, en aislado, el peor turno medido de toda la campaña** — vale la pena investigarlo con más casos antes de dimensionar la solución.

### DEF-32 · La latencia por llamada crece conforme avanza una conversación larga
**Síntoma:** en la sesión de 5 turnos consecutivos sobre disponibilidad, la duración de las llamadas al LLM tendió a crecer: 42.0s → 34.8s → 69.5s → 71.1s → 52.5s (T_llm por turno).
**Evidencia:** filas 13-17 de §4.
**Causa raíz probable:** `obtenerHistorialReciente` reenvía hasta 20 turnos previos en texto completo en cada llamada (`persistencia.ts:35-52`) — el contexto crece con cada turno, y más contexto generalmente implica más tiempo de procesamiento del lado del proveedor.
**Categoría:** ACCIONABLE-CÓDIGO. **Esfuerzo:** medio (resumir o truncar el historial más agresivamente en conversaciones largas). **Confianza:** media — son solo 5 puntos de una sesión, con ruido propio de temperatura 0.3; no se puede descartar coincidencia sin una prueba dedicada de A/B por longitud de conversación.

### DEF-33 · La compilación JIT de Next.js dev añade 4-8 s a la primera petición de cada ruta — metodológico
**Síntoma:** el primer turno de la campaña (lat-seg-01) tardó 7.8 s pese a estar bloqueado en la Capa 1 (sin tocar el LLM).
**Evidencia:** `dev-server.log` línea 28-29: `✓ Compiled /api/chat in 3.9s (2229 modules)`.
**Categoría:** METODOLÓGICO — no ocurre en producción (`next start` precompila todo en el build). Se documenta para que nadie confunda este número con latencia real de producción.

### DEF-34 · El guardrail puede disparar sin margen de corte cuando el dato aparece al final del párrafo, y no distingue un dato inventado de uno que el propio cliente escribió — ACCIONABLE-CÓDIGO/PROMPT (nuevo, hallado en el flujo real)
**Síntoma:** en el turno 3 de LAT-FLUJO-01 (§4, fila 29), el modelo redactó una confirmación completa de 41.9 s ("Gracias, Juan. Antes de confirmar, ¿podría escribir la placa sin caracteres especiales?... Una vez confirmado, agendo el Express 5K para el lunes 31 de agosto **a las 10:00**.") que fue descartada **completa**, no cortada — `cortadoAnticipadamente: false`.
**Evidencia:** `dev-server-err.log` líneas 57-65; `duracionMs: 41865` en la iteración correspondiente (log de `stdout`).
**Causa raíz (dos factores distintos):**
1. **Falta de margen para el corte anticipado.** La hora aparece a solo unos caracteres del final de la oración — no hay los 25 caracteres de margen (`MARGEN_CORTE_ANTICIPADO`, `guardrails.ts`) que el corte anticipado necesita para confirmar que no es el horario general del taller antes de que la generación termine naturalmente. El corte anticipado (Capa 2) solo puede ayudar cuando el dato problemático aparece con suficiente texto **después** en la misma respuesta; una confirmación que cierra mencionando la hora como último dato queda fuera de su alcance.
2. **El guardrail no verifica procedencia, solo patrón.** La hora "10:00" en el texto descartado es literalmente la que el cliente escribió un mensaje antes ("A las 10, mis datos son…") — no fue inventada ni recordada de un turno lejano. El guardrail no puede (ni debería, dado su diseño simple y auditable) distinguir "el modelo inventó esto" de "el modelo está citando lo que el cliente acaba de decir": ambos casos producen el mismo patrón de texto sin una tool ejecutada ese turno.
**Impacto medido:** este disparo específico costó los 41.9 s de la iteración descartada, más las 2 iteraciones siguientes con 2 tools adicionales (revalidar disponibilidad + verificar precio) — una fracción sustancial de los 156 s totales de ese turno.
**Categoría:** ACCIONABLE-CÓDIGO (ampliar el margen no ayuda de forma general — hay respuestas que terminan la oración justo después de la hora, sin importar el margen) / ACCIONABLE-PROMPT (instruir al modelo a llamar la tool de agenda como parte del paso de confirmación, no solo para "descubrir" disponibilidad, sino también para "reconfirmarla" antes de redactar el resumen — de hecho el prompt existente ya pide confirmar fecha/hora exactos antes de agendar, R5, pero no ata explícitamente esa confirmación a una llamada de tool en el MISMO turno). **Esfuerzo:** medio. **Riesgo de no arreglarlo:** ninguno para la protección (el guardrail se comporta como debe, prefiriendo un falso positivo — un reintento de más — sobre un falso negativo); el costo es puramente de latencia.

---

## 7 bis. Grupo C — Flujo real de agendamiento (LAT-FLUJO-01), con datos y correo reales

Ejecutado en una segunda tanda, autorizado explícitamente por el solicitante para usar su correo real (`jacarrascod@gmail.com`) en lugar de un alias de pruebas — desviación consciente del `PLAN-DE-PRUEBAS-LATENCIA-CHAT.md` §6.3, que originalmente pedía un alias dedicado.

**Resultado: éxito de punta a punta.**

| Campo | Valor |
|---|---|
| Código de cita | **CITA-2026-0012** |
| Cliente | Juan Carrasco |
| Correo | jacarrascod@gmail.com |
| Vehículo | Corolla 2018, placa KLN456 (normalizada desde "klñ456" — el modelo detectó el carácter especial y pidió confirmación, comportamiento correcto) |
| Servicio | Express 5K — S/ 189 |
| Fecha/hora | Lunes 31 de agosto de 2026, 10:00–11:00 |
| `google_event_id` | `9qle1t1nk0o5caevg9g4oo5tfo` — **no nulo**: confirma que el arreglo de permisos de Google Calendar (sesión previa a esta campaña) funciona en un agendamiento real de principio a fin |
| Correo de confirmación | Enviado vía Brevo según la respuesta del asistente; **pendiente que el solicitante confirme recepción en su bandeja** |

**Latencia del propio `agendar_cita` (nuevo dato, no medido en la primera tanda):** **2,704 ms** — la tool más lenta de toda la campaña, porque encadena tres llamadas de red reales y secuenciales dentro de `agendarCita()`: inserción en Supabase, creación del evento en Google Calendar (con su propia autenticación, sin caché — DEF-29), y envío del correo vía Brevo. Sigue siendo pequeño frente al LLM (2.7 s vs. 15,000-55,000 ms por llamada), pero es **4 a 10 veces más lento que cualquier otra tool medida** en esta campaña (todas las demás: 236-661 ms). Si se optimiza `consultarOcupado`/`crearEvento` (DEF-29), este número bajaría proporcionalmente.

**Costo total del flujo completo (4 turnos):** 44.7 s + 28.3 s + **156.1 s** + 70.4 s = **299.5 segundos (≈5 minutos)** desde "quiero agendar un mantenimiento" hasta la confirmación final — de los cuales solo 3.2 s (1 %) corresponden a tools, y el resto casi en su totalidad a llamadas al LLM (289.8 s de `T_llm` sumado, 97 % del total).

---

## 8. Quick wins priorizados

### 1. Streaming condicionado por tool ya ejecutada — mayor impacto de percepción, riesgo cero
**Qué hacer:** cuando el turno ya ejecutó una tool de respaldo (agenda, repuestos, mantenimientos), el guardrail de salida no puede activarse por ese motivo — se puede transmitir el texto en vivo, token a token, en vez de acumularlo y trocearlo después. Solo se retiene el buffering completo para turnos SIN tool ejecutada todavía en ese turno.
**Ahorro esperado:** no reduce el tiempo real de servidor, pero convierte turnos de 30-70 s de pantalla en blanco en una respuesta que empieza a aparecer progresivamente — el cambio de percepción más grande posible sin tocar el guardrail.
**Riesgo sobre guardrails:** **ninguno** — es exactamente la opción de riesgo cero identificada en el plan (§5.1, opción 4): el guardrail solo puede fallar por datos sin respaldo de tool, y si la tool ya se ejecutó, esa condición no puede cumplirse.
**Esfuerzo:** medio (tocar el punto de emisión en `runtime.ts`).

### 2. Reforzar R3/R5 para el patrón "consulta secuencial de días" — mayor ahorro medido por esfuerzo
**Qué hacer:** añadir una instrucción explícita: *"Cada vez que el cliente pregunte por OTRO día distinto (incluso en la misma conversación), vuelve a llamar `consultar_disponibilidad_agenda` con la fecha nueva — no asumas que el rango de horas del día anterior aplica al día nuevo."*
**Ahorro esperado:** este patrón disparó el guardrail en 4 de 4 intentos consecutivos (100 %) en esta campaña — el más costoso y frecuente medido. Cada disparo evitado ahorra 10-25 s.
**Riesgo sobre guardrails:** ninguno — refuerza la protección existente, no la relaja.
**Esfuerzo:** bajo (una instrucción de prompt).

### 3. Cliente Google JWT como singleton + un solo `freebusy.query` por rango
**Ahorro esperado:** 150-450 ms por turno con tool de agenda — **medido como marginal** (1-3 % del tiempo de un turno típico). Vale la pena por higiene de código y porque no tiene riesgo, pero no debe venderse como una mejora perceptible.
**Riesgo sobre guardrails:** ninguno.
**Esfuerzo:** bajo-medio.

### 4. Mejorar el mapeo de sinónimos de `buscar_repuestos`
**Ahorro esperado:** difícil de generalizar de un solo caso (DEF-31), pero ese caso costó 139 s — si el patrón se repite con cierta frecuencia en producción, vale la pena. **Recomendación: instrumentar cuántas veces `buscar_repuestos` se llama más de una vez por turno antes de invertir esfuerzo aquí.**
**Riesgo sobre guardrails:** ninguno — no toca la Capa 3.
**Esfuerzo:** medio.

### 5 (hipótesis, no confirmada) · Resumir el historial en conversaciones largas
**Por qué no es un quick win todavía:** la evidencia (DEF-32) es de una sola sesión de 5 turnos — no alcanza para separar señal de ruido. **Antes de invertir esfuerzo, correr una prueba dedicada:** 10 turnos consecutivos en la misma sesión, midiendo `duracionMs` de cada uno, para confirmar la tendencia con una muestra más sólida.

---

## 9. Riesgos descartados (sección obligatoria del plan)

- **Streaming real sin condición** (emitir todo token a token siempre, sin importar si hay tool de respaldo): descartado explícitamente — permitiría que el cliente vea un precio u hora falsos antes de que el guardrail de salida pueda descartarlos. Es exactamente el riesgo que el plan identificó en §5.1 y que motiva el quick win #1 (condicionado, no incondicional).
- **Cachear resultados de tools entre turnos para evitar repetir la llamada** (aceptar como "respaldo" un valor de un turno anterior): descartado en la sesión de cambios del 25-ago, antes de esta campaña — reabriría el mismo hueco de DEF-03 (mezclar datos de fechas/productos distintos). No se reconsideró en esta campaña.
- **Eliminar la doble verificación Google Calendar + Supabase en disponibilidad**: descartado en conversación previa a esta campaña — protege contra bloqueos manuales del taller en Google Calendar y contra citas que Google desconoce (el caso real de CITA-2026-0008, sin evento de Google por un fallo de permisos).

---

## 10. Limpieza post-ejecución

- **⚠️ Sí se creó una cita real** en la segunda tanda: **CITA-2026-0012** (Juan Carrasco, jacarrascod@gmail.com, lunes 31 de agosto 10:00), con evento real en Google Calendar (`google_event_id` no nulo) — autorizado explícitamente para esta prueba. **No se ha cancelado.** Al no usarse un alias descartable sino el correo real del solicitante, esta cita es indistinguible de una reserva genuina para cualquiera que revise el calendario del taller o la bandeja de entrada. **Queda pendiente de tu decisión**: ¿la cancelo (libera el horario y el evento de Google Calendar), o la dejas como registro de la prueba?
- **⚠️ Sí se envió un correo real** de confirmación vía Brevo a jacarrascod@gmail.com — no se verificó la recepción desde este lado; conviene que confirmes si llegó (y revisa spam, como el propio mensaje del asistente sugiere).
- Las citas de las tandas de prueba **anteriores** a esta campaña (CITA-2026-0007 a 0011) no fueron tocadas ni son parte de esta campaña.
- **Las filas de `conversaciones`/`mensajes`** de las 15 sesiones `lat-*` se conservan en Supabase como evidencia de este informe (session IDs: `lat-seg-01` a `08`, `lat-bas-01` a `03`, `lat-tool-01`, `lat-tool-03-04-h2`, `lat-tool-05`, `lat-recap-01`, `03`, `05`, `06`, `lat-flujo-01`).
- **Los archivos de log** (`dev-server.log`, `dev-server-err.log`) se conservan en el directorio de scratchpad de la sesión como anexo de evidencia.
- **El dev server sigue corriendo** en el puerto 3000 con los logs redirigidos a archivo — no se detuvo al terminar la campaña.

---

## 11. Cobertura pendiente para una campaña futura

1. **LAT-FLUJO-02 y LAT-FLUJO-03** — el camino feliz (LAT-FLUJO-01) ya se ejecutó con datos reales (§7 bis); falta el mensaje único con todos los datos de una vez (02) y el flujo de cancelación (03). Nota: se confirmó que el límite de 3 agendamientos/hora (`RATE_LIMIT_AGENDAR_POR_HORA`) solo se aplica al endpoint REST directo `/api/citas`, no al flujo por chat — no es una restricción real para repetir este grupo.
2. **Repetición ×3 del Grupo D** — para convertir la tasa de disparo del 75 % (n=8, esta campaña) en una cifra estadísticamente más sólida.
3. **Grupo F** — casos borde (fin de semana, fecha pasada, rate limit, mensaje vacío, multi-pestaña, recarga a mitad de respuesta).
4. **Prueba dedicada para DEF-32** — 10+ turnos en una sola sesión, para confirmar o descartar el crecimiento de latencia por contexto acumulado.
5. **Instrumentación de frecuencia de DEF-31** en producción — contar cuántos turnos reales llaman `buscar_repuestos` más de una vez, para decidir si vale la pena invertir en el mapeo de sinónimos.
