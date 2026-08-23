-- ═══════════════════════════════════════════════════════════════════
--  TOYOTA TALLER PERÚ — Esquema
--  Ejecutar completo en el SQL Editor de Supabase.
--  Ver SPEC.md §6 y §7 para el diseño de referencia.
-- ═══════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto"  with schema extensions;
create extension if not exists "unaccent" with schema extensions;
create extension if not exists "pg_trgm"  with schema extensions;

-- unaccent() es STABLE; se envuelve para poder indexarla.
create or replace function public.f_unaccent(text)
returns text
language sql immutable strict parallel safe
as $$ select extensions.unaccent($1) $$;

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
