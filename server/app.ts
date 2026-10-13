import express, { type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Db } from './db';
import { config } from './config';
import type { crearCatalogo } from './productos';
import type { Usuario } from '../shared/tipos';

interface Opciones {
  db: Db;
  catalogo: ReturnType<typeof crearCatalogo>;
  servirCliente?: boolean;
}

interface ReqAuth extends Request {
  usuario?: Usuario;
}

const esquemaRegistro = z.object({
  nombre: z.string().trim().min(2, 'Ingresa tu nombre').max(80),
  email: z.string().trim().toLowerCase().email('Correo no válido').max(160),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(200),
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

const esquemaDiseno = z.object({
  nombre: z.string().trim().min(1, 'Ponle un nombre a tu diseño').max(120),
  productoId: z.number().int().nullable().optional(),
  config: esquemaConfig,
  miniatura: z
    .string()
    .max(600_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,/)
    .nullable()
    .optional(),
});

const esquemaCotizacion = z.object({
  nombre: z.string().trim().max(120).optional(),
  telefono: z.string().trim().max(40).optional(),
  comentario: z.string().trim().max(2000).optional(),
  productoId: z.number().int().nullable().optional(),
  config: esquemaConfig,
  resumen: z.string().min(1).max(5000),
});

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
  return jwt.sign({ sub: u.id, nombre: u.nombre, email: u.email }, config.jwtSecreto, { expiresIn: '7d' });
}

function errorValidacion(res: Response, e: z.ZodError) {
  res.status(400).json({ error: e.issues[0]?.message ?? 'Datos no válidos' });
}

export function crearApp({ db, catalogo, servirCliente = false }: Opciones) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '8mb' }));

  const buscarUsuario = db.prepare('SELECT id, nombre, email FROM usuarios WHERE id = ?');

  function autenticar(obligatorio: boolean) {
    return (req: ReqAuth, res: Response, next: NextFunction) => {
      const cabecera = req.headers.authorization ?? '';
      const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : null;
      if (token) {
        try {
          const datos = jwt.verify(token, config.jwtSecreto) as unknown as { sub: number };
          const u = buscarUsuario.get(datos.sub) as Usuario | undefined;
          if (u) req.usuario = { id: Number(u.id), nombre: u.nombre, email: u.email };
        } catch {
          // token vencido o inválido: se trata como invitado
        }
      }
      if (obligatorio && !req.usuario) {
        res.status(401).json({ error: 'Inicia sesión para continuar' });
        return;
      }
      next();
    };
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

  // ---------- Autenticación ----------

  const limiteAuth = limitador(20, 10 * 60 * 1000);

  app.post('/api/auth/registro', limiteAuth, (req, res) => {
    const r = esquemaRegistro.safeParse(req.body);
    if (!r.success) return errorValidacion(res, r.error);
    const { nombre, email, password } = r.data;
    const existe = db.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email);
    if (existe) {
      res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
      return;
    }
    const hash = bcrypt.hashSync(password, 10);
    const info = db.prepare('INSERT INTO usuarios (nombre, email, hash) VALUES (?, ?, ?)').run(nombre, email, hash);
    const usuario: Usuario = { id: Number(info.lastInsertRowid), nombre, email };
    res.status(201).json({ token: firmar(usuario), usuario });
  });

  app.post('/api/auth/login', limiteAuth, (req, res) => {
    const r = esquemaLogin.safeParse(req.body);
    if (!r.success) return errorValidacion(res, r.error);
    const fila = db.prepare('SELECT id, nombre, email, hash FROM usuarios WHERE email = ?').get(r.data.email) as
      | (Usuario & { hash: string })
      | undefined;
    if (!fila || !bcrypt.compareSync(r.data.password, fila.hash)) {
      res.status(401).json({ error: 'Correo o contraseña incorrectos' });
      return;
    }
    const usuario: Usuario = { id: Number(fila.id), nombre: fila.nombre, email: fila.email };
    res.json({ token: firmar(usuario), usuario });
  });

  app.get('/api/auth/yo', autenticar(true), (req: ReqAuth, res) => {
    res.json({ usuario: req.usuario });
  });

  // ---------- Diseños guardados ----------

  type FilaDiseno = {
    id: number;
    nombre: string;
    producto_id: number | null;
    config: string;
    miniatura: string | null;
    creado: string;
    actualizado: string;
  };
  const aDiseno = (f: FilaDiseno, conConfig = true) => ({
    id: Number(f.id),
    nombre: f.nombre,
    productoId: f.producto_id === null ? null : Number(f.producto_id),
    config: conConfig ? JSON.parse(f.config) : undefined,
    miniatura: f.miniatura,
    creado: f.creado,
    actualizado: f.actualizado,
  });

  app.get('/api/disenos', autenticar(true), (req: ReqAuth, res) => {
    const filas = db
      .prepare('SELECT * FROM disenos WHERE usuario_id = ? ORDER BY actualizado DESC, id DESC')
      .all(req.usuario!.id) as FilaDiseno[];
    res.json({ disenos: filas.map((f) => aDiseno(f)) });
  });

  app.get('/api/disenos/:id', autenticar(true), (req: ReqAuth, res) => {
    const f = db
      .prepare('SELECT * FROM disenos WHERE id = ? AND usuario_id = ?')
      .get(Number(req.params.id), req.usuario!.id) as FilaDiseno | undefined;
    if (!f) {
      res.status(404).json({ error: 'Diseño no encontrado' });
      return;
    }
    res.json({ diseno: aDiseno(f) });
  });

  app.post('/api/disenos', autenticar(true), (req: ReqAuth, res) => {
    const r = esquemaDiseno.safeParse(req.body);
    if (!r.success) return errorValidacion(res, r.error);
    const { nombre, productoId, config: cfg, miniatura } = r.data;
    const info = db
      .prepare('INSERT INTO disenos (usuario_id, nombre, producto_id, config, miniatura) VALUES (?, ?, ?, ?, ?)')
      .run(req.usuario!.id, nombre, productoId ?? null, JSON.stringify(cfg), miniatura ?? null);
    const f = db.prepare('SELECT * FROM disenos WHERE id = ?').get(Number(info.lastInsertRowid)) as FilaDiseno;
    res.status(201).json({ diseno: aDiseno(f) });
  });

  app.put('/api/disenos/:id', autenticar(true), (req: ReqAuth, res) => {
    const r = esquemaDiseno.safeParse(req.body);
    if (!r.success) return errorValidacion(res, r.error);
    const { nombre, productoId, config: cfg, miniatura } = r.data;
    const info = db
      .prepare(
        `UPDATE disenos SET nombre = ?, producto_id = ?, config = ?, miniatura = ?, actualizado = datetime('now')
         WHERE id = ? AND usuario_id = ?`,
      )
      .run(nombre, productoId ?? null, JSON.stringify(cfg), miniatura ?? null, Number(req.params.id), req.usuario!.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Diseño no encontrado' });
      return;
    }
    const f = db.prepare('SELECT * FROM disenos WHERE id = ?').get(Number(req.params.id)) as FilaDiseno;
    res.json({ diseno: aDiseno(f) });
  });

  app.delete('/api/disenos/:id', autenticar(true), (req: ReqAuth, res) => {
    const info = db.prepare('DELETE FROM disenos WHERE id = ? AND usuario_id = ?').run(Number(req.params.id), req.usuario!.id);
    if (info.changes === 0) {
      res.status(404).json({ error: 'Diseño no encontrado' });
      return;
    }
    res.status(204).end();
  });

  // ---------- Cotizaciones ----------

  app.post('/api/cotizaciones', autenticar(false), (req: ReqAuth, res) => {
    const r = esquemaCotizacion.safeParse(req.body);
    if (!r.success) return errorValidacion(res, r.error);
    const c = r.data;
    const info = db
      .prepare(
        'INSERT INTO cotizaciones (usuario_id, nombre, telefono, comentario, producto_id, config, resumen) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        req.usuario?.id ?? null,
        c.nombre ?? req.usuario?.nombre ?? null,
        c.telefono ?? null,
        c.comentario ?? null,
        c.productoId ?? null,
        JSON.stringify(c.config),
        c.resumen,
      );
    res.status(201).json({ id: Number(info.lastInsertRowid) });
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
      res.status(413).json({ error: 'El diseño es demasiado grande (reduce la imagen frontal)' });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}
