// Valida la migración de Supabase en un Postgres embebido (PGlite) con el mismo
// modelo de permisos que el proyecto de la tienda: el rol que usa el SQL Editor
// ("editor" aquí, "postgres" en Supabase) NO es superusuario, auth.users
// pertenece a supabase_auth_admin y los registros los inserta Supabase Auth.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

const MIGRACION = fs.readFileSync('supabase/migrations/20261013120000_vendedores_cotizaciones.sql', 'utf8');

const BASE_SUPABASE = `
  create role supabase_auth_admin nologin;
  create role anon nologin;
  create role authenticated nologin;
  create role editor nologin;
  create schema auth authorization supabase_auth_admin;
  set role supabase_auth_admin;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  reset role;
  grant usage on schema auth to editor, anon, authenticated;
  grant select, trigger, references on auth.users to editor;
  grant execute on function auth.uid() to editor, anon, authenticated;
  alter schema public owner to editor;
  grant usage on schema public to anon, authenticated;
  -- Privilegios por defecto como en Supabase.
  alter default privileges for role editor in schema public grant all on tables to anon, authenticated;
  alter default privileges for role editor in schema public grant all on sequences to anon, authenticated;
  alter default privileges for role editor in schema public grant execute on functions to anon, authenticated;

  -- Lo que ya existe en el proyecto de la tienda.
  set role editor;
  create table public.admins (user_id uuid primary key references auth.users(id), creado_en timestamptz default now());
  alter table public.admins enable row level security;
  create table public.productos (id bigint generated always as identity primary key, nombre text not null, activo boolean default true);
  alter table public.productos enable row level security;
  create policy "publico ve productos activos" on public.productos for select to anon, authenticated using (activo);
  create function public.es_admin() returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.admins where user_id = auth.uid());
  $$;
  create function public.tocar_actualizado() returns trigger language plpgsql set search_path = public as $$
  begin new.actualizado_en = now(); return new; end; $$;
  insert into public.productos (nombre) values ('Cocina full equipo');
  reset role;
`;

let db: PGlite;

/** Como el SQL Editor de Supabase (rol postgres, sin superusuario). */
async function comoEditor<T>(f: () => Promise<T>): Promise<T> {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false); set role editor;`);
  try {
    return await f();
  } finally {
    await db.exec('reset role');
  }
}

async function como(usuario: string | null) {
  await db.exec('reset role');
  if (usuario) {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [usuario]);
    await db.exec('set role authenticated');
  } else {
    await db.exec(`select set_config('request.jwt.claim.sub', '', false); set role anon`);
  }
}

/** Registro como lo hace Supabase Auth (rol supabase_auth_admin). */
async function registrar(email: string, meta: Record<string, string>): Promise<string> {
  await db.exec(`reset role; set role supabase_auth_admin;`);
  try {
    const r = await db.query<{ id: string }>('insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id', [email, meta]);
    return r.rows[0].id;
  } finally {
    await db.exec('reset role');
  }
}

const cotizacion = (cliente = 'Fernando Pérez', valor = 519990) =>
  db.query<{ id: number; vendedor_id: string; estado: string }>(
    `insert into public.cotizaciones (cliente_nombre, modelo, config, detalle, valor, producto_id)
     values ($1, 'Cocina full equipo', '{"plantilla":"cocina"}', '[{"etiqueta":"Medidas","valor":"150 × 90 × 60 cm"}]', $2, 1)
     returning id, vendedor_id, estado`,
    [cliente, valor],
  );

let ana: string;
let pedro: string;
let admin: string;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(BASE_SUPABASE);
  // Se ejecuta dos veces: el SQL debe tolerar que se corra de nuevo.
  await comoEditor(() => db.exec(MIGRACION));
  await comoEditor(() => db.exec(MIGRACION));
  ana = await registrar('ana@dto.cl', { rol: 'vendedor', nombre: 'Ana Rojas', telefono: '+56 9 1111 1111', codigo: 'x' });
  pedro = await registrar('pedro@dto.cl', { rol: 'vendedor', nombre: 'Pedro Soto' });
  admin = await registrar('admin@dto.cl', {});
  await comoEditor(() => db.query('insert into public.admins (user_id) values ($1)', [admin]));
}, 60_000);

describe('ejecución del SQL en Supabase', () => {
  it('no usa DROP (el SQL Editor no muestra advertencias) y termina con "Listo"', () => {
    expect(MIGRACION).not.toMatch(/\bdrop\b/i);
    expect(MIGRACION).toMatch(/'Listo' as resultado/);
  });

  it('crea los triggers en auth.users sin ser dueño de la tabla', async () => {
    const r = await db.query<{ tgname: string }>(`select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal order by 1`);
    expect(r.rows.map((x) => x.tgname)).toEqual(['crear_perfil_vendedor', 'validar_registro_vendedor']);
  });

  it('se detiene con un mensaje claro si se ejecuta en otro proyecto', async () => {
    const otro = new PGlite();
    await otro.exec(`create role anon nologin; create role authenticated nologin; create schema auth;
      create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
      create function auth.uid() returns uuid language sql as $$ select null::uuid $$;`);
    await expect(otro.exec(MIGRACION)).rejects.toThrow(/DTO detoditooutlet/);
    const t = await otro.query<{ n: number }>(`select count(*)::int as n from pg_tables where schemaname = 'public'`);
    expect(t.rows[0].n).toBe(0);
    await otro.close();
  });
});

describe('registro de vendedores', () => {
  it('crea el perfil de vendedor y quita el código de los metadatos', async () => {
    const r = await comoEditor(() =>
      db.query<{ nombre: string; telefono: string; meta: Record<string, string> }>(
        `select v.nombre, v.telefono, u.raw_user_meta_data as meta from public.vendedores v join auth.users u on u.id = v.id where v.id = $1`,
        [ana],
      ),
    );
    expect(r.rows[0]).toMatchObject({ nombre: 'Ana Rojas', telefono: '+56 9 1111 1111' });
    expect(r.rows[0].meta.codigo).toBeUndefined();
  });

  it('no toca las cuentas que no son de vendedor (admins de la tienda)', async () => {
    const r = await comoEditor(() => db.query('select 1 from public.vendedores where id = $1', [admin]));
    expect(r.rows).toHaveLength(0);
  });

  it('exige el código de vendedor cuando está configurado', async () => {
    await comoEditor(() => db.exec(`insert into public.ajustes_privados values ('codigo_vendedores', 'DTO-2026')`));
    await como(null);
    expect((await db.query<{ r: boolean }>('select public.registro_requiere_codigo() as r')).rows[0].r).toBe(true);
    await expect(registrar('malo@dto.cl', { rol: 'vendedor', nombre: 'Sin Código', codigo: 'otro' })).rejects.toThrow(/CODIGO_VENDEDOR_INVALIDO/);
    const ok = await registrar('bueno@dto.cl', { rol: 'vendedor', nombre: 'Con Código', codigo: 'DTO-2026' });
    expect(ok).toBeTruthy();
    // Un admin creado sin rol vendedor no necesita código.
    await expect(registrar('otroadmin@dto.cl', {})).resolves.toBeTruthy();
    await comoEditor(() => db.exec(`delete from public.ajustes_privados`));
  });

  it('el vendedor edita su nombre pero no su estado', async () => {
    await como(ana);
    await db.query(`update public.vendedores set nombre = 'Ana María Rojas' where id = $1`, [ana]);
    await expect(db.query(`update public.vendedores set activo = false where id = $1`, [ana])).rejects.toThrow(/permission denied/);
    const r = await db.query<{ id: string }>('select id from public.vendedores');
    expect(r.rows.map((x) => x.id)).toEqual([ana]);
  });

  it('la tabla de ajustes no es accesible desde la app', async () => {
    await como(ana);
    await expect(db.query('select * from public.ajustes_privados')).rejects.toThrow(/permission denied/);
  });
});

describe('cotizaciones y ventas', () => {
  it('el vendedor registra a su nombre y solo ve lo suyo', async () => {
    await como(ana);
    const c = (await cotizacion()).rows[0];
    expect(c.vendedor_id).toBe(ana);
    expect(c.estado).toBe('cotizada');
    await como(pedro);
    await cotizacion('Marcela Díaz', 159990);
    const vistas = await db.query<{ cliente_nombre: string }>('select cliente_nombre from public.cotizaciones');
    expect(vistas.rows.map((r) => r.cliente_nombre)).toEqual(['Marcela Díaz']);
    // Pedro no puede tocar la de Ana: la actualización no afecta filas.
    const r = await db.query(`update public.cotizaciones set valor = 1 where id = $1`, [c.id]);
    expect(r.affectedRows).toBe(0);
  });

  it('los admins de la tienda ven todas las cotizaciones pero no las registran', async () => {
    await como(admin);
    const r = await db.query('select id from public.cotizaciones');
    expect(r.rows.length).toBe(2);
    await expect(cotizacion()).rejects.toThrow(/row-level security|violates/);
  });

  it('nadie sin sesión ve cotizaciones', async () => {
    await como(null);
    expect((await db.query('select id from public.cotizaciones')).rows).toHaveLength(0);
  });

  it('venta, bloqueo de cambios, anulación y reactivación', async () => {
    await como(ana);
    const { id } = (await cotizacion('Cliente Venta', 300000)).rows[0];
    await db.query(`update public.cotizaciones set estado = 'vendida', fecha_venta = '2026-10-15', valor_venta = 290000, medio_pago = 'Transferencia' where id = $1`, [id]);
    await expect(db.query(`update public.cotizaciones set valor = 1 where id = $1`, [id])).rejects.toThrow(/ya está vendida/);
    await expect(db.query(`update public.cotizaciones set vendedor_id = $2 where id = $1`, [id, pedro])).rejects.toThrow();
    await db.query(`update public.cotizaciones set estado = 'anulada' where id = $1`, [id]);
    const anulada = await db.query<{ fecha_venta: string | null; valor_venta: number | null }>('select fecha_venta, valor_venta from public.cotizaciones where id = $1', [id]);
    expect(anulada.rows[0]).toEqual({ fecha_venta: null, valor_venta: null });
    await expect(
      db.query(`update public.cotizaciones set estado = 'vendida', fecha_venta = '2026-10-16', valor_venta = 1 where id = $1`, [id]),
    ).rejects.toThrow(/anulada/);
    await db.query(`update public.cotizaciones set estado = 'cotizada' where id = $1`, [id]);
  });

  it('una venta sin fecha o valor es rechazada', async () => {
    await como(ana);
    const { id } = (await cotizacion('Cliente Incompleto')).rows[0];
    await expect(db.query(`update public.cotizaciones set estado = 'vendida' where id = $1`, [id])).rejects.toThrow(/venta_completa/);
  });

  it('las cotizaciones no se borran', async () => {
    await como(ana);
    await expect(db.query('delete from public.cotizaciones')).rejects.toThrow(/permission denied/);
  });

  it('valida cliente y valor', async () => {
    await como(ana);
    await expect(cotizacion('', 100)).rejects.toThrow(/check/);
    await expect(cotizacion('Cliente', 0)).rejects.toThrow(/check/);
  });

  it('un vendedor desactivado no puede registrar', async () => {
    await comoEditor(() => db.query('update public.vendedores set activo = false where id = $1', [pedro]));
    await como(pedro);
    await expect(cotizacion()).rejects.toThrow(/row-level security|violates/);
    await comoEditor(() => db.query('update public.vendedores set activo = true where id = $1', [pedro]));
  });
});
