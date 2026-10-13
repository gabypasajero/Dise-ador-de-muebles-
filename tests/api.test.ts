import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { disenoLibre } from '../shared/catalogo';
import { crearApp } from '../server/app';
import { abrirDb } from '../server/db';
import { crearCatalogo, leerConfigTienda } from '../server/productos';

const CONFIG_JS = `window.DTO_CONFIG = {
  supabaseUrl: 'https://ejemplo.supabase.co',
  supabaseKey: 'sb_publishable_prueba',
  whatsapp: '56900000000',
  categorias: [
    { id: 'cocina', nombre: 'Muebles de cocina' },
    { id: 'closets', nombre: 'Clósets' }
  ]
};`;

const PRODUCTOS = [
  {
    id: 16,
    nombre: 'Cocina full equipo: horno, encimera y lavaplatos · Clasic Pino Casina',
    categoria: 'cocina',
    descripcion: null,
    medidas: '60 × 150 × 90 cm',
    precio: 549990,
    precio_oferta: 519990,
    imagen_url: null,
    personalizable: false,
    destacado: true,
    orden: 1,
  },
];

function fetchFalso(ok = true): typeof fetch {
  return (async (url: string | URL) => {
    const u = String(url);
    if (!ok) throw new Error('sin red');
    if (u.endsWith('/config.js')) return new Response(CONFIG_JS, { status: 200 });
    if (u.includes('/rest/v1/productos')) return Response.json(PRODUCTOS);
    return new Response('no', { status: 404 });
  }) as typeof fetch;
}

function nuevaApp(ok = true) {
  return crearApp({ db: abrirDb(':memory:'), catalogo: crearCatalogo(fetchFalso(ok)) });
}

describe('leerConfigTienda', () => {
  it('extrae la clave publicable y las categorías del config.js de la tienda', () => {
    const c = leerConfigTienda(CONFIG_JS);
    expect(c.supabaseUrl).toBe('https://ejemplo.supabase.co');
    expect(c.supabaseKey).toBe('sb_publishable_prueba');
    expect(c.whatsapp).toBe('56900000000');
    expect(c.categorias).toHaveLength(2);
  });
});

describe('API de catálogo', () => {
  it('entrega los productos de la tienda clasificados', async () => {
    const r = await request(nuevaApp()).get('/api/productos').expect(200);
    expect(r.body.fuente).toBe('tienda');
    expect(r.body.productos[0]).toMatchObject({ id: 16, plantilla: 'cocina', escenario: 'cocina' });
  });

  it('usa la copia local si la tienda no responde', async () => {
    const r = await request(nuevaApp(false)).get('/api/productos').expect(200);
    expect(r.body.fuente).toBe('respaldo');
    expect(r.body.productos.length).toBeGreaterThan(100);
  });

  it('entrega los materiales', async () => {
    const r = await request(nuevaApp()).get('/api/materiales').expect(200);
    expect(r.body.melaminas.some((m: { id: string }) => m.id === 'pino-casina')).toBe(true);
    expect(r.body.cubiertas.some((m: { id: string }) => m.id === 'florentino')).toBe(true);
  });
});

describe('cuentas y diseños', () => {
  let app: ReturnType<typeof nuevaApp>;
  beforeEach(() => {
    app = nuevaApp();
  });

  async function registrar(email = 'ana@ejemplo.cl') {
    const r = await request(app).post('/api/auth/registro').send({ nombre: 'Ana', email, password: 'secreta123' }).expect(201);
    return r.body.token as string;
  }

  it('registra, inicia sesión y rechaza contraseñas incorrectas', async () => {
    await registrar();
    await request(app).post('/api/auth/registro').send({ nombre: 'Ana', email: 'ANA@ejemplo.cl', password: 'secreta123' }).expect(409);
    const ok = await request(app).post('/api/auth/login').send({ email: 'ana@ejemplo.cl', password: 'secreta123' }).expect(200);
    expect(ok.body.usuario).toMatchObject({ nombre: 'Ana', email: 'ana@ejemplo.cl' });
    await request(app).post('/api/auth/login').send({ email: 'ana@ejemplo.cl', password: 'otra' }).expect(401);
    const yo = await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${ok.body.token}`).expect(200);
    expect(yo.body.usuario.email).toBe('ana@ejemplo.cl');
  });

  it('valida los datos del registro', async () => {
    const r = await request(app).post('/api/auth/registro').send({ nombre: 'A', email: 'malo', password: '123' }).expect(400);
    expect(r.body.error).toBeTruthy();
  });

  it('exige sesión para los diseños', async () => {
    await request(app).get('/api/disenos').expect(401);
    await request(app).get('/api/disenos').set('Authorization', 'Bearer token-falso').expect(401);
  });

  it('crea, lista, actualiza y elimina diseños solo del dueño', async () => {
    const token = await registrar();
    const otro = await registrar('otro@ejemplo.cl');
    const config = disenoLibre('cocina');
    const creado = await request(app)
      .post('/api/disenos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Mi cocina', productoId: 16, config, miniatura: null })
      .expect(201);
    const id = creado.body.diseno.id;
    expect(creado.body.diseno.config.plantilla).toBe('cocina');

    const lista = await request(app).get('/api/disenos').set('Authorization', `Bearer ${token}`).expect(200);
    expect(lista.body.disenos).toHaveLength(1);
    const ajena = await request(app).get('/api/disenos').set('Authorization', `Bearer ${otro}`).expect(200);
    expect(ajena.body.disenos).toHaveLength(0);
    await request(app).get(`/api/disenos/${id}`).set('Authorization', `Bearer ${otro}`).expect(404);

    const nueva = { ...config, ancho: 1800 };
    const act = await request(app)
      .put(`/api/disenos/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'Mi cocina grande', productoId: 16, config: nueva, miniatura: null })
      .expect(200);
    expect(act.body.diseno).toMatchObject({ nombre: 'Mi cocina grande' });
    expect(act.body.diseno.config.ancho).toBe(1800);

    await request(app).delete(`/api/disenos/${id}`).set('Authorization', `Bearer ${otro}`).expect(404);
    await request(app).delete(`/api/disenos/${id}`).set('Authorization', `Bearer ${token}`).expect(204);
  });

  it('rechaza configuraciones que no son diseños', async () => {
    const token = await registrar();
    await request(app)
      .post('/api/disenos')
      .set('Authorization', `Bearer ${token}`)
      .send({ nombre: 'x', config: { hola: 'mundo' } })
      .expect(400);
  });

  it('registra cotizaciones de invitados', async () => {
    const r = await request(app)
      .post('/api/cotizaciones')
      .send({ nombre: 'Luis', telefono: '+56 9 1234 5678', productoId: 16, config: disenoLibre('cocina'), resumen: 'Hola Rachel…' })
      .expect(201);
    expect(r.body.id).toBeGreaterThan(0);
  });
});
