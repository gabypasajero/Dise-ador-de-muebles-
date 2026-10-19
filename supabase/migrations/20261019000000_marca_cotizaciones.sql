-- =====================================================================
-- Diseñador 3D para vendedores · Marca de cada cotización
--
-- CÓMO USARLO: en Supabase abre el proyecto "DTO detoditooutlet",
-- entra a SQL Editor, pega TODO este contenido y presiona "Run".
-- Al terminar debe aparecer la fila "Listo".
--
-- Requiere 20261013120000_vendedores_cotizaciones.sql (ejecútalo antes).
-- Si más adelante vuelves a ejecutar ese SQL, ejecuta también este:
-- ambos definen las reglas del registro (validar_cotizacion).
-- Se puede ejecutar más de una vez sin problema.
--
-- Agrega a las cotizaciones:
--   * marca: con qué marca se emite la cotización: 'dto' (De Todito
--     Outlet) o 'molina' (Muebles y Hogar Molina). Las cotizaciones
--     anteriores quedan como De Todito Outlet.
--   * imagen: imagen grande del mueble para el PDF del cliente y la
--     hoja para el maestro (la miniatura sigue siendo la de la lista).
-- Una cotización vendida no cambia de marca.
-- =====================================================================

-- Verifica que se esté ejecutando en el proyecto de la tienda, con el registro de cotizaciones.
do $$
begin
  if to_regclass('public.cotizaciones') is null or to_regprocedure('public.validar_cotizacion()') is null then
    raise exception 'Falta el registro de cotizaciones: en el proyecto "DTO detoditooutlet" ejecuta primero supabase/migrations/20261013120000_vendedores_cotizaciones.sql.';
  end if;
end;
$$;

-- ---------- Columnas nuevas ----------
alter table public.cotizaciones
  add column if not exists marca text not null default 'dto' check (marca in ('dto', 'molina'));
alter table public.cotizaciones
  add column if not exists imagen text check (imagen is null or char_length(imagen) <= 2000000);

comment on column public.cotizaciones.marca is 'Marca con la que se emite: dto = De Todito Outlet, molina = Muebles y Hogar Molina.';
comment on column public.cotizaciones.imagen is 'Imagen grande del mueble (data URL JPEG) para el PDF del cliente y la hoja para el maestro.';

-- Mismos permisos de siempre (las columnas nuevas quedan cubiertas): sin borrar, sin acceso anónimo.
revoke all on public.cotizaciones from anon;
grant select, insert, update on public.cotizaciones to authenticated;

-- ---------- Reglas del registro ----------
-- Igual que en 20261013120000_vendedores_cotizaciones.sql, y además una venta no cambia de marca.
create or replace function public.validar_cotizacion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.vendedor_id := coalesce(auth.uid(), new.vendedor_id);
    new.estado := 'cotizada';
  else
    if new.vendedor_id <> old.vendedor_id then
      raise exception 'No se puede cambiar el vendedor de una cotización';
    end if;
    -- Si la tienda borra el producto, Postgres deja producto_id en null
    -- (trigger anidado): eso no cuenta como editar la venta.
    if old.estado = 'vendida' and new.estado = 'vendida' and
       row(new.cliente_nombre, new.cliente_telefono, new.cliente_email, new.cliente_direccion, new.observaciones,
           case when new.producto_id is null and pg_trigger_depth() > 1 then old.producto_id else new.producto_id end,
           new.modelo, new.config, new.detalle, new.valor, new.fecha, new.marca)
       is distinct from
       row(old.cliente_nombre, old.cliente_telefono, old.cliente_email, old.cliente_direccion, old.observaciones,
           old.producto_id,
           old.modelo, old.config, old.detalle, old.valor, old.fecha, old.marca) then
      raise exception 'La cotización ya está vendida: registra una nueva para cambiarla';
    end if;
    if old.estado = 'anulada' and new.estado = 'vendida' then
      raise exception 'La cotización está anulada: reactívala antes de registrar la venta';
    end if;
    new.actualizado_en := now();
  end if;
  if new.estado <> 'vendida' then
    new.fecha_venta := null;
    new.valor_venta := null;
    new.medio_pago := null;
    new.nota_venta := null;
  end if;
  return new;
end;
$$;

-- El trigger ya existe (lo crea el SQL anterior); solo se crea si faltara.
do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'validar_cotizacion' and tgrelid = 'public.cotizaciones'::regclass) then
    create trigger validar_cotizacion
      before insert or update on public.cotizaciones
      for each row execute function public.validar_cotizacion();
  end if;
end;
$$;

select 'Listo' as resultado,
  (select count(*) from public.cotizaciones where marca = 'dto') as cotizaciones_de_todito_outlet,
  (select count(*) from public.cotizaciones where marca = 'molina') as cotizaciones_molina,
  'Las cotizaciones anteriores quedaron como De Todito Outlet.' as detalle;
