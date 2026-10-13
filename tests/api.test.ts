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

function nuevaApp(ok = true, codigoRegistro: string | null = null) {
  return crearApp({ db: abrirDb(':memory:'), catalogo: crearCatalogo(fetchFalso(ok)), codigoRegistro });
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

function datosCotizacion(cliente = 'Fernando Pérez') {
  return {
    cliente: { nombre: cliente, telefono: '+56 9 1234 5678', email: '', direccion: 'La Granja' },
    observaciones: 'Despacho el sábado',
    productoId: 16,
    modelo: 'Cocina full equipo',
    config: disenoLibre('cocina'),
    detalle: [
      { etiqueta: 'Medidas', valor: '150 × 90 × 60 cm' },
      { etiqueta: 'Distribución', valor: '3 cuerpos', sub: ['Cuerpo 1 (60 cm): horno empotrado'] },
    ],
    miniatura: null,
    valor: 519990,
    fecha: '2026-10-13',
  };
}

describe('vendedores', () => {
  it('registra un vendedor, inicia sesión y rechaza contraseñas incorrectas', async () => {
    const app = nuevaApp();
    const r = await request(app)
      .post('/api/auth/registro')
      .send({ nombre: 'Camila Rojas', email: 'camila@dto.cl', telefono: '+56 9 8765 4321', password: 'secreta123' })
      .expect(201);
    expect(r.body.usuario).toMatchObject({ nombre: 'Camila Rojas', telefono: '+56 9 8765 4321' });
    await request(app).post('/api/auth/registro').send({ nombre: 'Otra Camila', email: 'CAMILA@dto.cl', password: 'secreta123' }).expect(409);
    const ok = await request(app).post('/api/auth/login').send({ email: 'camila@dto.cl', password: 'secreta123' }).expect(200);
    await request(app).post('/api/auth/login').send({ email: 'camila@dto.cl', password: 'otra' }).expect(401);
    const yo = await request(app).get('/api/auth/yo').set('Authorization', `Bearer ${ok.body.token}`).expect(200);
    expect(yo.body.usuario.email).toBe('camila@dto.cl');
  });

  it('exige el código de vendedor cuando la tienda lo configura', async () => {
    const app = nuevaApp(true, 'DTO-2026');
    expect((await request(app).get('/api/auth/registro').expect(200)).body.requiereCodigo).toBe(true);
    const datos = { nombre: 'Pedro Soto', email: 'pedro@dto.cl', password: 'secreta123' };
    await request(app).post('/api/auth/registro').send(datos).expect(403);
    await request(app).post('/api/auth/registro').send({ ...datos, codigo: 'otro' }).expect(403);
    await request(app).post('/api/auth/registro').send({ ...datos, codigo: 'DTO-2026' }).expect(201);
  });

  it('valida los datos del registro', async () => {
    const r = await request(nuevaApp()).post('/api/auth/registro').send({ nombre: 'A', email: 'malo', password: '123' }).expect(400);
    expect(r.body.error).toBeTruthy();
  });
});

describe('cotizaciones y ventas', () => {
  let app: ReturnType<typeof nuevaApp>;
  beforeEach(() => {
    app = nuevaApp();
  });

  async function vendedor(email = 'camila@dto.cl', nombre = 'Camila Rojas') {
    const r = await request(app).post('/api/auth/registro').send({ nombre, email, password: 'secreta123' }).expect(201);
    return r.body.token as string;
  }

  it('exige sesión de vendedor', async () => {
    await request(app).get('/api/cotizaciones').expect(401);
    await request(app).post('/api/cotizaciones').send(datosCotizacion()).expect(401);
    await request(app).get('/api/cotizaciones').set('Authorization', 'Bearer token-falso').expect(401);
  });

  it('registra la cotización a nombre del cliente con vendedor, fecha y valor', async () => {
    const token = await vendedor();
    const r = await request(app).post('/api/cotizaciones').set('Authorization', `Bearer ${token}`).send(datosCotizacion()).expect(201);
    const c = r.body.cotizacion;
    expect(c).toMatchObject({
      numero: 'COT-0001',
      vendedor: { nombre: 'Camila Rojas' },
      cliente: { nombre: 'Fernando Pérez', telefono: '+56 9 1234 5678', email: null, direccion: 'La Granja' },
      fecha: '2026-10-13',
      valor: 519990,
      estado: 'cotizada',
      venta: null,
    });
    expect(c.detalle[1].sub).toEqual(['Cuerpo 1 (60 cm): horno empotrado']);
    expect(c.config.plantilla).toBe('cocina');
  });

  it('cada vendedor ve solo su registro y sus totales', async () => {
    const camila = await vendedor();
    const pedro = await vendedor('pedro@dto.cl', 'Pedro Soto');
    await request(app).post('/api/cotizaciones').set('Authorization', `Bearer ${camila}`).send(datosCotizacion()).expect(201);
    const otra = await request(app).post('/api/cotizaciones').set('Authorization', `Bearer ${camila}`).send({ ...datosCotizacion('Ana Díaz'), valor: 100000 }).expect(201);
    const lista = await request(app).get('/api/cotizaciones').set('Authorization', `Bearer ${camila}`).expect(200);
    expect(lista.body.cotizaciones).toHaveLength(2);
    expect(lista.body.cotizaciones[0].config).toBeUndefined();
    expect(lista.body.totales).toEqual({ cotizaciones: 2, montoCotizado: 619990, ventas: 0, montoVendido: 0 });
    const ajena = await request(app).get('/api/cotizaciones').set('Authorization', `Bearer ${pedro}`).expect(200);
    expect(ajena.body.cotizaciones).toHaveLength(0);
    await request(app).get(`/api/cotizaciones/${otra.body.cotizacion.id}`).set('Authorization', `Bearer ${pedro}`).expect(404);
    await request(app).post(`/api/cotizaciones/${otra.body.cotizacion.id}/venta`).set('Authorization', `Bearer ${pedro}`).send({ fecha: '2026-10-14', valor: 1 }).expect(404);
  });

  it('actualiza, vende, anula y reactiva', async () => {
    const token = await vendedor();
    const auth = { Authorization: `Bearer ${token}` };
    const { body } = await request(app).post('/api/cotizaciones').set(auth).send(datosCotizacion()).expect(201);
    const id = body.cotizacion.id;

    const act = await request(app).put(`/api/cotizaciones/${id}`).set(auth).send({ ...datosCotizacion(), valor: 499990 }).expect(200);
    expect(act.body.cotizacion.valor).toBe(499990);

    const venta = await request(app)
      .post(`/api/cotizaciones/${id}/venta`)
      .set(auth)
      .send({ fecha: '2026-10-15', valor: 480000, medioPago: 'Transferencia', nota: 'Abono 50%' })
      .expect(200);
    expect(venta.body.cotizacion).toMatchObject({ estado: 'vendida', venta: { fecha: '2026-10-15', valor: 480000, medioPago: 'Transferencia' } });
    // Una cotización vendida no se modifica.
    await request(app).put(`/api/cotizaciones/${id}`).set(auth).send(datosCotizacion()).expect(409);
    const totales = (await request(app).get('/api/cotizaciones').set(auth)).body.totales;
    expect(totales).toMatchObject({ ventas: 1, montoVendido: 480000 });

    const anulada = await request(app).post(`/api/cotizaciones/${id}/estado`).set(auth).send({ estado: 'anulada' }).expect(200);
    expect(anulada.body.cotizacion).toMatchObject({ estado: 'anulada', venta: null });
    await request(app).post(`/api/cotizaciones/${id}/venta`).set(auth).send({ fecha: '2026-10-15', valor: 1 }).expect(409);
    const activa = await request(app).post(`/api/cotizaciones/${id}/estado`).set(auth).send({ estado: 'cotizada' }).expect(200);
    expect(activa.body.cotizacion.estado).toBe('cotizada');
    await request(app).post(`/api/cotizaciones/${id}/estado`).set(auth).send({ estado: 'vendida' }).expect(400);
  });

  it('valida cliente, valor y fecha', async () => {
    const token = await vendedor();
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/cotizaciones').set(auth).send({ ...datosCotizacion(), cliente: { nombre: '' } }).expect(400);
    await request(app).post('/api/cotizaciones').set(auth).send({ ...datosCotizacion(), valor: 0 }).expect(400);
    await request(app).post('/api/cotizaciones').set(auth).send({ ...datosCotizacion(), fecha: '13/10/2026' }).expect(400);
    await request(app).post('/api/cotizaciones').set(auth).send({ ...datosCotizacion(), config: { hola: 'mundo' } }).expect(400);
  });
});
