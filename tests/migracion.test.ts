// Valida la migración de Supabase en un Postgres embebido (PGlite) con el mismo
// modelo de permisos que el proyecto de la tienda: el rol que usa el SQL Editor
// ("editor" aquí, "postgres" en Supabase) NO es superusuario, auth.users
// pertenece a supabase_auth_admin y los registros los inserta Supabase Auth.
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

const MIGRACION = fs.readFileSync('supabase/migrations/20261013120000_vendedores_cotizaciones.sql', 'utf8');
const MIGRACION_MARCA = fs.readFileSync('supabase/migrations/20261019000000_marca_cotizaciones.sql', 'utf8');

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
  create function public.es_admin() returns boolean language sql stable security definer set search_path = public as $$
    select exists (select 1 from public.admins where user_id = auth.uid());
  $$;
  create policy "publico ve productos activos" on public.productos for select to anon, authenticated using (activo or public.es_admin());
  create policy "admin borra productos" on public.productos for delete to authenticated using (public.es_admin());
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

const codigoActual = () =>
  comoEditor(async () => (await db.query<{ valor: string }>(`select valor from public.ajustes_privados where clave = 'codigo_vendedores'`)).rows[0]?.valor);

let ana: string;
let pedro: string;
let admin: string;
let previo: string;
let codigo: string;
let antigua: number;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(BASE_SUPABASE);
  // Alguien que se registró como vendedor antes de ejecutar el SQL.
  previo = await registrar('jo@dto.cl', { rol: 'vendedor', nombre: 'Jo', telefono: '+56 9 2222 2222 anexo 1234567890 ext' });
  // Se ejecuta dos veces: el SQL debe tolerar que se corra de nuevo.
  await comoEditor(() => db.exec(MIGRACION));
  codigo = await codigoActual();
  await comoEditor(() => db.exec(MIGRACION));
  ana = await registrar('ana@dto.cl', { rol: 'vendedor', nombre: 'Ana Rojas', telefono: '+56 9 1111 1111', codigo });
  pedro = await registrar('pedro@dto.cl', { rol: 'vendedor', nombre: 'Pedro Soto', codigo });
  admin = await registrar('admin@dto.cl', {});
  await comoEditor(() => db.query('insert into public.admins (user_id) values ($1)', [admin]));
  // Una cotización registrada antes de que existiera la marca.
  await como(pedro);
  antigua = (await cotizacion('Cliente Antiguo', 99990)).rows[0].id;
  await comoEditor(() => db.exec(MIGRACION_MARCA));
  await comoEditor(() => db.exec(MIGRACION_MARCA));
}, 60_000);

describe('ejecución del SQL en Supabase', () => {
  it('no usa DROP (el SQL Editor no muestra advertencias) y termina con "Listo" y el código', async () => {
    expect(MIGRACION).not.toMatch(/\bdrop\b/i);
    const r = await comoEditor(() => db.exec(MIGRACION));
    const ultima = r[r.length - 1].rows[0] as { resultado: string; codigo_vendedores: string };
    expect(ultima.resultado).toBe('Listo');
    expect(ultima.codigo_vendedores).toBe(codigo);
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

  it('genera un código de vendedor la primera vez, lo conserva y lo exige', async () => {
    expect(codigo).toMatch(/^DTO-[0-9A-F]{6}$/);
    expect(await codigoActual()).toBe(codigo);
    await como(null);
    expect((await db.query<{ r: boolean }>('select public.registro_requiere_codigo() as r')).rows[0].r).toBe(true);
    await expect(registrar('malo@dto.cl', { rol: 'vendedor', nombre: 'Código Malo', codigo: 'otro' })).rejects.toThrow(/CODIGO_VENDEDOR_INVALIDO/);
    await expect(registrar('sin@dto.cl', { rol: 'vendedor', nombre: 'Sin Código' })).rejects.toThrow(/CODIGO_VENDEDOR_INVALIDO/);
    // Un admin creado sin rol vendedor no necesita código.
    await expect(registrar('otroadmin@dto.cl', {})).resolves.toBeTruthy();
  });

  it('con el código vacío el registro queda abierto', async () => {
    await comoEditor(() => db.exec(`update public.ajustes_privados set valor = '' where clave = 'codigo_vendedores'`));
    await como(null);
    expect((await db.query<{ r: boolean }>('select public.registro_requiere_codigo() as r')).rows[0].r).toBe(false);
    await expect(registrar('abierto@dto.cl', { rol: 'vendedor', nombre: 'Registro Abierto' })).resolves.toBeTruthy();
    await comoEditor(() => db.query(`update public.ajustes_privados set valor = $1 where clave = 'codigo_vendedores'`, [codigo]));
  });

  it('ajusta nombre y teléfono fuera de rango en vez de rechazar el registro', async () => {
    const id = await registrar('largo@dto.cl', { rol: 'vendedor', nombre: 'N'.repeat(120), telefono: '9'.repeat(45), codigo });
    const r = await comoEditor(() => db.query<{ nombre: string; telefono: string }>('select nombre, telefono from public.vendedores where id = $1', [id]));
    expect(r.rows[0].nombre).toHaveLength(80);
    expect(r.rows[0].telefono).toHaveLength(30);
  });

  it('crea el perfil de quienes se registraron antes de ejecutar el SQL', async () => {
    const r = await comoEditor(() => db.query<{ nombre: string; telefono: string; activo: boolean }>('select nombre, telefono, activo from public.vendedores where id = $1', [previo]));
    expect(r.rows[0]).toEqual({ nombre: 'jo@dto.cl', telefono: '+56 9 2222 2222 anexo 12345678', activo: true });
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
    expect(vistas.rows.map((r) => r.cliente_nombre).sort()).toEqual(['Cliente Antiguo', 'Marcela Díaz']);
    // Pedro no puede tocar la de Ana: la actualización no afecta filas.
    const r = await db.query(`update public.cotizaciones set valor = 1 where id = $1`, [c.id]);
    expect(r.affectedRows).toBe(0);
  });

  it('los admins de la tienda ven todas las cotizaciones pero no las registran', async () => {
    await como(admin);
    const r = await db.query('select id from public.cotizaciones');
    expect(r.rows.length).toBe(3);
    await expect(cotizacion()).rejects.toThrow(/row-level security|violates/);
  });

  it('nadie sin sesión ve cotizaciones ni vendedores', async () => {
    await como(null);
    await expect(db.query('select id from public.cotizaciones')).rejects.toThrow(/permission denied/);
    await expect(db.query('select id from public.vendedores')).rejects.toThrow(/permission denied/);
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

  it('la tienda puede borrar un producto aunque tenga cotizaciones vendidas', async () => {
    const producto = await comoEditor(async () => (await db.query<{ id: number }>(`insert into public.productos (nombre) values ('Closet 2 puertas') returning id`)).rows[0].id);
    const otro = await comoEditor(async () => (await db.query<{ id: number }>(`insert into public.productos (nombre) values ('Rack TV') returning id`)).rows[0].id);
    await como(ana);
    const nueva = async () =>
      (
        await db.query<{ id: number }>(
          `insert into public.cotizaciones (cliente_nombre, modelo, config, detalle, valor, producto_id)
           values ('Cliente Closet', 'Closet', '{}', '[]', 200000, $1) returning id`,
          [producto],
        )
      ).rows[0].id;
    const vendida = await nueva();
    const vendida2 = await nueva();
    for (const id of [vendida, vendida2]) {
      await db.query(`update public.cotizaciones set estado = 'vendida', fecha_venta = '2026-10-15', valor_venta = 200000 where id = $1`, [id]);
    }
    // El vendedor no puede cambiar ni quitar el producto de una venta.
    await expect(db.query('update public.cotizaciones set producto_id = null where id = $1', [vendida])).rejects.toThrow(/ya está vendida/);
    await expect(db.query('update public.cotizaciones set producto_id = $2 where id = $1', [vendida, otro])).rejects.toThrow(/ya está vendida/);
    // Un admin borra el producto desde la tienda (y la base, desde el panel).
    await como(admin);
    expect((await db.query('delete from public.productos where id = $1', [producto])).affectedRows).toBe(1);
    await comoEditor(() => db.query('delete from public.productos where id = $1', [otro]));
    const r = await comoEditor(() => db.query<{ producto_id: number | null; estado: string }>('select producto_id, estado from public.cotizaciones where id = any($1)', [[vendida, vendida2]]));
    expect(r.rows).toEqual([
      { producto_id: null, estado: 'vendida' },
      { producto_id: null, estado: 'vendida' },
    ]);
  });

  it('las cotizaciones no se borran', async () => {
    await como(ana);
    await expect(db.query('delete from public.cotizaciones')).rejects.toThrow(/permission denied/);
    await expect(db.query('truncate public.cotizaciones')).rejects.toThrow(/permission denied/);
  });

  it('valida cliente, valor y tamaño del detalle', async () => {
    await como(ana);
    await expect(cotizacion('', 100)).rejects.toThrow(/check/);
    await expect(cotizacion('Cliente', 0)).rejects.toThrow(/check/);
    const enorme = JSON.stringify([{ etiqueta: 'Texto', valor: 'x'.repeat(60_000) }]);
    await expect(
      db.query(`insert into public.cotizaciones (cliente_nombre, modelo, config, detalle, valor) values ('Cliente', 'Mueble', '{}', $1, 1000)`, [enorme]),
    ).rejects.toThrow(/check/);
  });

  it('un vendedor desactivado no registra ni ve sus cotizaciones; la administración sí', async () => {
    await comoEditor(() => db.query('update public.vendedores set activo = false where id = $1', [pedro]));
    await como(pedro);
    await expect(cotizacion()).rejects.toThrow(/row-level security|violates/);
    expect((await db.query('select id from public.cotizaciones')).rows).toHaveLength(0);
    await como(admin);
    const r = await db.query<{ cliente_nombre: string }>('select cliente_nombre from public.cotizaciones where vendedor_id = $1 order by id', [pedro]);
    expect(r.rows.map((x) => x.cliente_nombre)).toEqual(['Cliente Antiguo', 'Marcela Díaz']);
    await comoEditor(() => db.query('update public.vendedores set activo = true where id = $1', [pedro]));
    await como(pedro);
    expect((await db.query('select id from public.cotizaciones')).rows).toHaveLength(2);
  });
});

describe('marca de la cotización (20261019000000_marca_cotizaciones.sql)', () => {
  const conMarca = (marca: string, cliente = 'Cliente Molina') =>
    db.query<{ id: number; marca: string }>(
      `insert into public.cotizaciones (cliente_nombre, modelo, config, detalle, valor, marca)
       values ($1, 'Cocina en L', '{"plantilla":"cocina"}', '[]', 450000, $2) returning id, marca`,
      [cliente, marca],
    );

  it('no usa DROP, se puede ejecutar de nuevo y termina con "Listo"', async () => {
    expect(MIGRACION_MARCA).not.toMatch(/\bdrop\b/i);
    const r = await comoEditor(() => db.exec(MIGRACION_MARCA));
    const ultima = r[r.length - 1].rows[0] as { resultado: string };
    expect(ultima.resultado).toBe('Listo');
  });

  it('las cotizaciones anteriores quedan como De Todito Outlet', async () => {
    await como(pedro);
    const r = await db.query<{ marca: string; imagen: string | null }>('select marca, imagen from public.cotizaciones where id = $1', [antigua]);
    expect(r.rows[0]).toEqual({ marca: 'dto', imagen: null });
    // Sin indicar la marca, también es De Todito Outlet.
    expect((await cotizacion('Cliente Sin Marca')).rows[0]).toBeTruthy();
    const sin = await db.query<{ marca: string }>(`select marca from public.cotizaciones where cliente_nombre = 'Cliente Sin Marca'`);
    expect(sin.rows[0].marca).toBe('dto');
  });

  it('el vendedor elige De Todito Outlet o Muebles y Hogar Molina, y la puede cambiar', async () => {
    await como(ana);
    const c = (await conMarca('molina')).rows[0];
    expect(c.marca).toBe('molina');
    await expect(conMarca('otra')).rejects.toThrow(/check/);
    await expect(conMarca(null as unknown as string)).rejects.toThrow(/null/);
    await db.query(`update public.cotizaciones set marca = 'dto' where id = $1`, [c.id]);
    await expect(db.query(`update public.cotizaciones set marca = 'MOLINA' where id = $1`, [c.id])).rejects.toThrow(/check/);
    await como(pedro);
    // Pedro no ve ni cambia la de Ana.
    expect((await db.query(`update public.cotizaciones set marca = 'molina' where id = $1`, [c.id])).affectedRows).toBe(0);
  });

  it('guarda la imagen grande con un tope de tamaño', async () => {
    await como(ana);
    const { id } = (await conMarca('molina', 'Cliente Imagen')).rows[0];
    const imagen = `data:image/jpeg;base64,${'A'.repeat(900_000)}`;
    await db.query('update public.cotizaciones set imagen = $2 where id = $1', [id, imagen]);
    const r = await db.query<{ n: number }>('select char_length(imagen) as n from public.cotizaciones where id = $1', [id]);
    expect(Number(r.rows[0].n)).toBe(imagen.length);
    await expect(db.query('update public.cotizaciones set imagen = $2 where id = $1', [id, 'A'.repeat(2_000_001)])).rejects.toThrow(/check/);
  });

  it('una venta no cambia de marca, y la venta sigue funcionando igual', async () => {
    await como(ana);
    const { id } = (await conMarca('molina', 'Cliente Venta Molina')).rows[0];
    await db.query(`update public.cotizaciones set estado = 'vendida', fecha_venta = '2026-10-19', valor_venta = 440000 where id = $1`, [id]);
    await expect(db.query(`update public.cotizaciones set marca = 'dto' where id = $1`, [id])).rejects.toThrow(/ya está vendida/);
    await expect(db.query(`update public.cotizaciones set valor = 1 where id = $1`, [id])).rejects.toThrow(/ya está vendida/);
    await db.query(`update public.cotizaciones set estado = 'cotizada' where id = $1`, [id]);
    const r = await db.query<{ marca: string; fecha_venta: string | null }>('select marca, fecha_venta from public.cotizaciones where id = $1', [id]);
    expect(r.rows[0]).toEqual({ marca: 'molina', fecha_venta: null });
  });

  it('se detiene con un mensaje claro si falta el registro de cotizaciones', async () => {
    const otro = new PGlite();
    await expect(otro.exec(MIGRACION_MARCA)).rejects.toThrow(/20261013120000_vendedores_cotizaciones/);
    await otro.close();
  });
});
