-- Diseñador 3D para vendedores: perfiles de vendedor (Supabase Auth) y
-- registro de cotizaciones y ventas. No modifica las tablas de la tienda.

-- ---------- Ajustes privados (solo accesibles desde funciones) ----------
create table if not exists public.ajustes_privados (
  clave text primary key,
  valor text not null
);
alter table public.ajustes_privados enable row level security;
revoke all on public.ajustes_privados from anon, authenticated;
comment on table public.ajustes_privados is
  'Ajustes internos. codigo_vendedores: código que se exige para registrar vendedores (vacío = registro abierto).';

-- ---------- Vendedores ----------
create table if not exists public.vendedores (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 3 and 80),
  email text not null,
  telefono text check (telefono is null or char_length(telefono) <= 30),
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);
alter table public.vendedores enable row level security;

create policy "vendedor ve su perfil" on public.vendedores
  for select to authenticated
  using (id = (select auth.uid()) or (select public.es_admin()));

create policy "vendedor edita su perfil" on public.vendedores
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- El vendedor solo puede cambiar su nombre y teléfono. Para desactivar a un
-- vendedor la administración cambia "activo" desde el panel de Supabase.
revoke insert, update, delete on public.vendedores from anon, authenticated;
grant update (nombre, telefono) on public.vendedores to authenticated;

create or replace function public.es_vendedor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.vendedores where id = auth.uid() and activo);
$$;

create or replace function public.registro_requiere_codigo()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.ajustes_privados where clave = 'codigo_vendedores' and valor <> '');
$$;
grant execute on function public.registro_requiere_codigo() to anon, authenticated;

-- Valida el código de vendedor y lo quita de los metadatos antes de guardar el usuario.
create or replace function public.validar_registro_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requerido text;
begin
  if coalesce(new.raw_user_meta_data ->> 'rol', '') <> 'vendedor' then
    return new;
  end if;
  select valor into requerido from public.ajustes_privados where clave = 'codigo_vendedores';
  if coalesce(requerido, '') <> '' and coalesce(new.raw_user_meta_data ->> 'codigo', '') <> requerido then
    raise exception 'CODIGO_VENDEDOR_INVALIDO';
  end if;
  new.raw_user_meta_data := new.raw_user_meta_data - 'codigo';
  return new;
end;
$$;

-- Crea el perfil del vendedor cuando se registra con rol "vendedor".
-- Las cuentas de administración de la tienda no se ven afectadas.
create or replace function public.crear_perfil_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'rol', '') <> 'vendedor' then
    return new;
  end if;
  insert into public.vendedores (id, nombre, email, telefono)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'telefono'), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists validar_registro_vendedor on auth.users;
create trigger validar_registro_vendedor
  before insert on auth.users
  for each row execute function public.validar_registro_vendedor();

drop trigger if exists crear_perfil_vendedor on auth.users;
create trigger crear_perfil_vendedor
  after insert on auth.users
  for each row execute function public.crear_perfil_vendedor();

-- ---------- Cotizaciones y ventas ----------
create table if not exists public.cotizaciones (
  id bigint generated always as identity primary key,
  vendedor_id uuid not null default auth.uid() references public.vendedores (id),
  cliente_nombre text not null check (char_length(cliente_nombre) between 2 and 120),
  cliente_telefono text check (cliente_telefono is null or char_length(cliente_telefono) <= 40),
  cliente_email text check (cliente_email is null or char_length(cliente_email) <= 160),
  cliente_direccion text check (cliente_direccion is null or char_length(cliente_direccion) <= 200),
  observaciones text check (observaciones is null or char_length(observaciones) <= 2000),
  producto_id bigint references public.productos (id) on delete set null,
  modelo text not null check (char_length(modelo) between 1 and 200),
  config jsonb not null check (octet_length(config::text) <= 3000000),
  detalle jsonb not null check (jsonb_typeof(detalle) = 'array'),
  miniatura text check (miniatura is null or char_length(miniatura) <= 600000),
  valor integer not null check (valor > 0 and valor <= 100000000),
  fecha date not null default current_date,
  estado text not null default 'cotizada' check (estado in ('cotizada', 'vendida', 'anulada')),
  fecha_venta date,
  valor_venta integer check (valor_venta is null or (valor_venta > 0 and valor_venta <= 100000000)),
  medio_pago text check (medio_pago is null or char_length(medio_pago) <= 40),
  nota_venta text check (nota_venta is null or char_length(nota_venta) <= 500),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  constraint venta_completa check ((estado = 'vendida') = (fecha_venta is not null and valor_venta is not null))
);
alter table public.cotizaciones enable row level security;
create index if not exists cotizaciones_vendedor_fecha on public.cotizaciones (vendedor_id, fecha desc, id desc);
create index if not exists cotizaciones_producto on public.cotizaciones (producto_id);

create policy "vendedor ve sus cotizaciones" on public.cotizaciones
  for select to authenticated
  using (vendedor_id = (select auth.uid()) or (select public.es_admin()));

create policy "vendedor registra cotizaciones" on public.cotizaciones
  for insert to authenticated
  with check (vendedor_id = (select auth.uid()) and (select public.es_vendedor()));

create policy "vendedor actualiza sus cotizaciones" on public.cotizaciones
  for update to authenticated
  using (vendedor_id = (select auth.uid()) and (select public.es_vendedor()))
  with check (vendedor_id = (select auth.uid()));

-- Las cotizaciones no se borran: se anulan.
revoke delete on public.cotizaciones from anon, authenticated;

-- Reglas del registro: el vendedor no cambia, una venta no se edita y
-- los datos de venta solo existen en cotizaciones vendidas.
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
    if old.estado = 'vendida' and new.estado = 'vendida' and
       row(new.cliente_nombre, new.cliente_telefono, new.cliente_email, new.cliente_direccion, new.observaciones,
           new.producto_id, new.modelo, new.config, new.detalle, new.valor, new.fecha)
       is distinct from
       row(old.cliente_nombre, old.cliente_telefono, old.cliente_email, old.cliente_direccion, old.observaciones,
           old.producto_id, old.modelo, old.config, old.detalle, old.valor, old.fecha) then
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

drop trigger if exists validar_cotizacion on public.cotizaciones;
create trigger validar_cotizacion
  before insert or update on public.cotizaciones
  for each row execute function public.validar_cotizacion();
