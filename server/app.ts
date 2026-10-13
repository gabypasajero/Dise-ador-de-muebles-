import express, { type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Db } from './db';
import { config } from './config';
import type { crearCatalogo } from './productos';
import { numeroCotizacion } from '../shared/resumen';
import type { Cotizacion, Usuario } from '../shared/tipos';

interface Opciones {
  db: Db;
  catalogo: ReturnType<typeof crearCatalogo>;
  servirCliente?: boolean;
  /** Código para registrar vendedores (null = registro abierto). */
  codigoRegistro?: string | null;
}

interface ReqAuth extends Request {
  usuario?: Usuario;
}

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(3, 'Ingresa tu nombre y apellido').max(80),
  email: z.string().trim().toLowerCase().email('Correo no válido').max(160),
  telefono: texto(30),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200),
  codigo: z.string().trim().max(80).optional(),
});

const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().email('Correo no válido'),
  password: z.string().min(1, 'Ingresa tu contraseña'),
});

// El diseño se valida en forma (objeto con plantilla y medidas); el detalle lo normaliza el cliente.
const esquemaConfig = z
  .object({
    version: z.literal(1),
    plantilla: z.enum(['cocina', 'closet', 'comoda', 'tocador', 'escritorio', 'cocina-infantil']),
    ancho: z.number().positive().max(10000),
    alto: z.number().positive().max(5000),
    profundidad: z.number().positive().max(3000),
    cuerpos: z.array(z.object({}).passthrough()).max(20),
  })
  .passthrough();

const esquemaLinea = z.object({
  etiqueta: z.string().max(80),
  valor: z.string().max(600),
  sub: z.array(z.string().max(300)).max(30).optional(),
});

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida');
const monto = z.number().int('El valor debe ser un número entero').positive('Ingresa el valor del mueble').max(100_000_000);

const esquemaCotizacion = z.object({
  cliente: z.object({
    nombre: z.string().trim().min(2, 'Ingresa el nombre del cliente').max(120),
    telefono: texto(40),
    email: z.union([z.string().trim().toLowerCase().email('Correo del cliente no válido').max(160), z.literal('')]).nullable().optional(),
    direccion: texto(200),
  }),
  observaciones: texto(2000),
  productoId: z.number().int().nullable().optional(),
  modelo: z.string().trim().min(1).max(200),
  config: esquemaConfig,
  detalle: z.array(esquemaLinea).min(1).max(30),
  miniatura: z
    .string()
    .max(600_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,/)
    .nullable()
    .optional(),
  valor: monto,
  fecha,
});

const esquemaVenta = z.object({
  fecha,
  valor: monto,
  medioPago: texto(40),
  nota: texto(500),
});

const esquemaEstado = z.object({ estado: z.enum(['cotizada', 'anulada']) });

/** Limitador simple en memoria para frenar fuerza bruta en el inicio de sesión. */
function limitador(maximo: number, ventanaMs: number) {
  const intentos = new Map<string, { n: number; desde: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const clave = req.ip ?? 'anon';
    const ahora = Date.now();
    const r = intentos.get(clave);
    if (!r || ahora - r.desde > ventanaMs) {
      intentos.set(clave, { n: 1, desde: ahora });
      return next();
    }
    r.n += 1;
    if (r.n > maximo) {
      res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos.' });
      return;
    }
    next();
  };
}

function firmar(u: Usuario): string {
  return jwt.sign({ sub: u.id }, config.jwtSecreto, { expiresIn: '7d' });
}

function errorValidacion(res: Response, e: z.ZodError) {
  res.status(400).json({ error: e.issues[0]?.message ?? 'Datos no válidos' });
}

interface FilaCotizacion {
  id: number;
  vendedor_id: number;
  vendedor_nombre: string;
  vendedor_telefono: string | null;
  cliente_nombre: string;
  cliente_telefono: string | null;
  cliente_email: string | null;
  cliente_direccion: string | null;
  observaciones: string | null;
  producto_id: number | null;
  modelo: string;
  config: string;
  detalle: string;
  miniatura: string | null;
  valor: number;
  fecha: string;
  estado: Cotizacion['estado'];
  fecha_venta: string | null;
  valor_venta: number | null;
  medio_pago: string | null;
  nota_venta: string | null;
  creado: string;
  actualizado: string;
}

function aCotizacion(f: FilaCotizacion, conConfig: boolean): Cotizacion {
  return {
    id: Number(f.id),
    numero: numeroCotizacion(Number(f.id)),
    vendedor: { id: Number(f.vendedor_id), nombre: f.vendedor_nombre, telefono: f.vendedor_telefono },
    cliente: { nombre: f.cliente_nombre, telefono: f.cliente_telefono, email: f.cliente_email, direccion: f.cliente_direccion },
    observaciones: f.observaciones,
    productoId: f.producto_id === null ? null : Number(f.producto_id),
    modelo: f.modelo,
    detalle: JSON.parse(f.detalle),
    miniatura: f.miniatura,
    valor: Number(f.valor),
    fecha: f.fecha,
    estado: f.estado,
    venta:
      f.estado === 'vendida' && f.fecha_venta
        ? { fecha: f.fecha_venta, valor: Number(f.valor_venta), medioPago: f.medio_pago, nota: f.nota_venta }
        : null,
    creado: f.creado,
    actualizado: f.actualizado,
    ...(conConfig ? { config: JSON.parse(f.config) } : {}),
  };
}

const SELECT_COTIZACION = `
  SELECT c.*, u.nombre AS vendedor_nombre, u.telefono AS vendedor_telefono
  FROM cotizaciones c JOIN usuarios u ON u.id = c.vendedor_id`;

export function crearApp({ db, catalogo, servirCliente = false, codigoRegistro = config.codigoRegistro }: Opciones) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '8mb' }));

  const buscarUsuario = db.prepare('SELECT id, nombre, email, telefono FROM usuarios WHERE id = ?');

  function autenticar(req: ReqAuth, res: Response, next: NextFunction) {
    const cabecera = req.headers.authorization ?? '';
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
    if (token) {
      try {
        const datos = jwt.verify(token, config.jwtSecreto) as unknown as { sub: number };
        const u = buscarUsuario.get(datos.sub) as Usuario | undefined;
        if (u) req.usuario = { id: Number(u.id), nombre: u.nombre, email: u.email, telefono: u.telefono ?? null };
      } catch {
        // token vencido o inválido
      }
    }
    if (!req.usuario) {
      res.status(401).json({ error: 'Inicia sesión como vendedor para continuar' });
      return;
    }
    next();
  }

  // ---------- Catálogo ----------

  app.get('/api/productos', async (_req, res) => {
    const datos = await catalogo.obtener();
    res.set('Cache-Control', 'public, max-age=120');
    res.json(datos);
  });

  app.get('/api/materiales', (_req, res) => {
    res.set('Cache-Control', 'public, max-age=300');
    res.type('json').send(fs.readFileSync(config.rutaMateriales, 'utf8'));
  });

  app.get('/api/salud', (_req, res) => res.json({ ok: true }));

  // ---------- Vendedores ----------

  const limiteAuth = limitador(20, 10 * 60 * 1000);

  app.get('/api/auth/registro', (_req, res) => {
    res.json({ requiereCodigo: Boolean(codigoRegistro) });
  });

  app.post('/api/auth/registro', limiteAuth, (req, res) => {
    const r = esquemaRegistro.safeParse(req.body);
    if (!r.success) return errorValidacion(res, r.error);
    const { nombre, email, telefono, password, codigo } = r.data;
    if (codigoRegistro && codigo !== codigoRegistro) {
      res.status(403).json({ error: 'Código de vendedor incorrecto. Pídelo a la administración de la tienda.' });
      return;
    }
    if (db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email)) {
      res.status(409).json({ error: 'Ya existe un vendedor con ese correo' });
      return;
    }
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO usuarios (nombre, email, telefono, hash) VALUES (?, ?, ?, ?)').run(nombre, email, telefono ?? null, hash);
    const usuario: Usuario = { id: Number(info.lastInsertRowid), nombre, email, telefono: telefono ?? null };
    res.status(201).json({ token: firmar(usuario), usuario });
  });

  app.post('/api/auth/login', limiteAuth, (req, res) => {
    const r = esquemaLogin.safeParse(req.body);
    if (!r.success) return errorValidacion(res, r.error);
    const fila = db.prepare('SELECT id, nombre, email, telefono, hash FROM usuarios WHERE email = ?').get(r.data.email) as
      | (Usuario & { hash: string })
      | undefined;
    if (!fila || !bcrypt.compareSync(r.data.password, fila.hash)) {
      res.status(401).json({ error: 'Correo o contraseña incorrectos' });
      return;
    }
    const usuario: Usuario = { id: Number(fila.id), nombre: fila.nombre, email: fila.email, telefono: fila.telefono ?? null };
    res.json({ token: firmar(usuario), usuario });
  });

  app.get('/api/auth/yo', autenticar, (req: ReqAuth, res) => {
    res.json({ usuario: req.usuario });
  });

  // ---------- Cotizaciones y ventas ----------

  const obtenerPropia = (id: number, vendedor: number) =>
    db.prepare(`${SELECT_COTIZACION} WHERE c.id = ? AND c.vendedor_id = ?`).get(id, vendedor) as FilaCotizacion | undefined;

  app.get('/api/cotizaciones', autenticar, (req: ReqAuth, res) => {
    const filas = db
      .prepare(`${SELECT_COTIZACION} WHERE c.vendedor_id = ? ORDER BY c.fecha DESC, c.id DESC`)
      .all(req.usuario!.id) as unknown as FilaCotizacion[];
    const cotizaciones = filas.map((f) => aCotizacion(f, false));
    const vigentes = cotizaciones.filter((c) => c.estado !== 'anulada');
    const vendidas = cotizaciones.filter((c) => c.estado === 'vendida');
    res.json({
      cotizaciones,
      totales: {
        cotizaciones: vigentes.length,
        montoCotizado: vigentes.reduce((s, c) => s + c.valor, 0),
        ventas: vendidas.length,
        montoVendido: vendidas.reduce((s, c) => s + (c.venta?.valor ?? c.valor), 0),
      },
    });
  });

  app.get('/api/cotizaciones/:id', autenticar, (req: ReqAuth, res) => {
    const f = obtenerPropia(Number(req.params.id), req.usuario!.id);
    if (!f) {
      res.status(404).json({ error: 'Cotización no encontrada' });
      return;
    }
    res.json({ cotizacion: aCotizacion(f, true) });
  });

  app.post('/api/cotizaciones', autenticar, (req: ReqAuth, res) => {
    const r = esquemaCotizacion.safeParse(req.body);
    if (!r.success) return errorValidacion(res, r.error);
    const c = r.data;
    const info = db
      .prepare(
        `INSERT INTO cotizaciones (vendedor_id, cliente_nombre, cliente_telefono, cliente_email, cliente_direccion, observaciones,
           producto_id, modelo, config, detalle, miniatura, valor, fecha)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        req.usuario!.id,
        c.cliente.nombre,
        c.cliente.telefono ?? null,
        c.cliente.email || null,
        c.cliente.direccion ?? null,
        c.observaciones ?? null,
        c.productoId ?? null,
        c.modelo,
        JSON.stringify(c.config),
        JSON.stringify(c.detalle),
        c.miniatura ?? null,
        c.valor,
        c.fecha,
      );
    const f = obtenerPropia(Number(info.lastInsertRowid), req.usuario!.id)!;
    res.status(201).json({ cotizacion: aCotizacion(f, true) });
  });

  app.put('/api/cotizaciones/:id', autenticar, (req: ReqAuth, res) => {
    const id = Number(req.params.id);
    const actual = obtenerPropia(id, req.usuario!.id);
    if (!actual) {
      res.status(404).json({ error: 'Cotización no encontrada' });
      return;
    }
    if (actual.estado === 'vendida') {
      res.status(409).json({ error: 'La cotización ya está vendida: registra una nueva para cambiarla' });
      return;
    }
    const r = esquemaCotizacion.safeParse(req.body);
    if (!r.success) return errorValidacion(res, r.error);
    const c = r.data;
    db.prepare(
      `UPDATE cotizaciones SET cliente_nombre = ?, cliente_telefono = ?, cliente_email = ?, cliente_direccion = ?, observaciones = ?,
         producto_id = ?, modelo = ?, config = ?, detalle = ?, miniatura = ?, valor = ?, fecha = ?, actualizado = datetime('now')
       WHERE id = ? AND vendedor_id = ?`,
    ).run(
      c.cliente.nombre,
      c.cliente.telefono ?? null,
      c.cliente.email || null,
      c.cliente.direccion ?? null,
      c.observaciones ?? null,
      c.productoId ?? null,
      c.modelo,
      JSON.stringify(c.config),
      JSON.stringify(c.detalle),
      c.miniatura ?? null,
      c.valor,
      c.fecha,
      id,
      req.usuario!.id,
    );
    res.json({ cotizacion: aCotizacion(obtenerPropia(id, req.usuario!.id)!, true) });
  });

  app.post('/api/cotizaciones/:id/venta', autenticar, (req: ReqAuth, res) => {
    const id = Number(req.params.id);
    const actual = obtenerPropia(id, req.usuario!.id);
    if (!actual) {
      res.status(404).json({ error: 'Cotización no encontrada' });
      return;
    }
    if (actual.estado === 'anulada') {
      res.status(409).json({ error: 'La cotización está anulada: reactívala antes de registrar la venta' });
      return;
    }
    const r = esquemaVenta.safeParse(req.body);
    if (!r.success) return errorValidacion(res, r.error);
    db.prepare(
      `UPDATE cotizaciones SET estado = 'vendida', fecha_venta = ?, valor_venta = ?, medio_pago = ?, nota_venta = ?, actualizado = datetime('now')
       WHERE id = ? AND vendedor_id = ?`,
    ).run(r.data.fecha, r.data.valor, r.data.medioPago ?? null, r.data.nota ?? null, id, req.usuario!.id);
    res.json({ cotizacion: aCotizacion(obtenerPropia(id, req.usuario!.id)!, false) });
  });

  app.post('/api/cotizaciones/:id/estado', autenticar, (req: ReqAuth, res) => {
    const id = Number(req.params.id);
    if (!obtenerPropia(id, req.usuario!.id)) {
      res.status(404).json({ error: 'Cotización no encontrada' });
      return;
    }
    const r = esquemaEstado.safeParse(req.body);
    if (!r.success) return errorValidacion(res, r.error);
    db.prepare(
      `UPDATE cotizaciones SET estado = ?, fecha_venta = NULL, valor_venta = NULL, medio_pago = NULL, nota_venta = NULL, actualizado = datetime('now')
       WHERE id = ? AND vendedor_id = ?`,
    ).run(r.data.estado, id, req.usuario!.id);
    res.json({ cotizacion: aCotizacion(obtenerPropia(id, req.usuario!.id)!, false) });
  });

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });

  // ---------- Cliente compilado ----------

  if (servirCliente) {
    const dist = path.join(config.raiz, 'dist');
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }

  app.use((err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.too.large') {
      res.status(413).json({ error: 'La cotización es demasiado grande (reduce la imagen frontal)' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}
