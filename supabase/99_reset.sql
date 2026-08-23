-- ═══════════════════════════════════════════════════════════════════
--  TOYOTA TALLER PERÚ — Reset completo (SOLO DESARROLLO)
--  Elimina todo el esquema de la app para volver a ejecutar
--  01_schema.sql + 02_seed.sql desde cero. NUNCA correr en producción.
-- ═══════════════════════════════════════════════════════════════════

drop table if exists public.mensajes cascade;
drop table if exists public.conversaciones cascade;
drop table if exists public.emails_enviados cascade;
drop table if exists public.pedido_items cascade;
drop table if exists public.pedidos cascade;
drop table if exists public.citas cascade;
drop table if exists public.faq_toyota cascade;
drop table if exists public.mantenimientos cascade;
drop table if exists public.inventario cascade;
drop table if exists public.repuesto_compatibilidad cascade;
drop table if exists public.repuestos cascade;
drop table if exists public.modelos_toyota cascade;
drop table if exists public.categorias cascade;

drop function if exists public.cancelar_cita(text, text, text);
drop function if exists public.citas_por_email(text, boolean, int);
drop function if exists public.descontar_stock(uuid, int);
drop function if exists public.buscar_conocimiento(text, int);
drop function if exists public.buscar_repuestos(text, text, int, text, int);
drop function if exists public.fn_codigo_pedido();
drop function if exists public.fn_codigo_cita();
drop function if exists public.fn_validar_horario_cita();
drop function if exists public.fn_normalizar_email_cita();
drop function if exists public.f_unaccent(text);

drop sequence if exists public.seq_codigo_pedido;
drop sequence if exists public.seq_codigo_cita;
