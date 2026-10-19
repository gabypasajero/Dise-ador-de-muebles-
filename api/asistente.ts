// Función de Vercel: asistente de diseño con IA (Google Gemini).
// POST /api/asistente  { instruccion, diseno, contexto: { colores, historial, producto } }
// Header: Authorization: Bearer <access_token de Supabase>
// Responde { plan, modelo } o { error } (mensajes en español). La clave de Gemini
// (GEMINI_API_KEY) vive solo en el servidor; el navegador nunca la ve.
import { ApiError, GoogleGenAI, ThinkingLevel } from '@google/genai';
import { createClient } from '@supabase/supabase-js';
import {
  LIMITE_INSTRUCCION,
  contextoAsistente,
  esquemaPlan,
  instruccionesAsistente,
  mensajeAsistente,
  normalizar,
  sanearColores,
  sanearHistorial,
  sanearPlan,
} from './_motor.mjs';
import type { DisenoGuardado } from '../shared/tipos';

export const config = { maxDuration: 60 };

/** Modelo estable de Gemini (Flash: rápido y económico). Se cambia con GEMINI_MODEL. */
const MODELO_POR_DEFECTO = 'gemini-3.8-flash';
/** Tamaño máximo del cuerpo (el diseño va sin la imagen de los frentes). */
const MAX_CUERPO = 300_000;
const POR_MINUTO = 8;

// Mismos valores públicos que usa la app (src/datos/supabase.ts / .env.example).
const URL_SUPABASE = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://bmxmqhbkgvgyqpwsuazm.supabase.co';
const CLAVE_PUBLICA = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_C4bwkSAfBBHNg8z523_qpw_P-PDzciI';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const error = (mensaje: string, status: number) => json({ error: mensaje }, status);

// Límite simple por vendedor (por instancia): evita gastar la cuota por doble clic o abuso.
const pedidos = new Map<string, number[]>();
function dentroDelLimite(usuario: string): boolean {
  const ahora = Date.now();
  const lista = (pedidos.get(usuario) ?? []).filter((t) => ahora - t < 60_000);
  if (lista.length >= POR_MINUTO) return false;
  lista.push(ahora);
  pedidos.set(usuario, lista);
  if (pedidos.size > 500) pedidos.clear();
  return true;
}

/** Verifica el token de Supabase y que la cuenta sea de un vendedor activo (o de la administración). */
async function verificarVendedor(token: string): Promise<{ id: string } | Response> {
  const sb = createClient(URL_SUPABASE, CLAVE_PUBLICA, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error: e } = await sb.auth.getUser(token);
  if (e || !data.user) return error('Tu sesión venció: vuelve a ingresar.', 401);
  const [vendedor, admin] = await Promise.all([sb.rpc('es_vendedor'), sb.rpc('es_admin')]);
  if (vendedor.data !== true && admin.data !== true) return error('El asistente es solo para vendedores con la cuenta activa.', 403);
  return { id: data.user.id };
}

/** Traduce los errores de Gemini a mensajes para el vendedor. */
function errorGemini(e: unknown): Response {
  const status = e instanceof ApiError ? e.status : 0;
  const texto = e instanceof Error ? e.message : String(e);
  console.error('Gemini:', status, texto.slice(0, 500));
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(texto))
    return error('Se acabó la cuota de la IA por ahora (límite de Google AI Studio). Espera un minuto e intenta de nuevo; si sigue pasando, avisa a la administración.', 429);
  if (/API_KEY_INVALID|API key not valid|API key expired|PERMISSION_DENIED/i.test(texto) || status === 401 || status === 403)
    return error('La clave de la IA no es válida o no tiene permiso. La administración debe revisar GEMINI_API_KEY en Vercel.', 502);
  if (status === 404 || /not found|is not supported/i.test(texto)) return error('El modelo de IA configurado no está disponible. La administración debe revisar GEMINI_MODEL en Vercel.', 502);
  if (status === 503 || status === 500 || /overloaded|UNAVAILABLE/i.test(texto)) return error('La IA está saturada en este momento. Intenta de nuevo en unos segundos.', 503);
  if (/timeout|timed out|aborted/i.test(texto)) return error('La IA se demoró demasiado. Intenta de nuevo o con una instrucción más corta.', 504);
  return error('No se pudo consultar a la IA. Intenta de nuevo en un momento.', 502);
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'Usa POST.' }), { status: 405, headers: { allow: 'POST', 'content-type': 'application/json; charset=utf-8' } });

    const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    if (!token) return error('Ingresa con tu cuenta de vendedor para usar el asistente.', 401);

    const largo = Number(request.headers.get('content-length') ?? 0);
    if (largo > MAX_CUERPO) return error('El diseño es demasiado grande para enviarlo al asistente.', 413);
    let cuerpo: Record<string, unknown>;
    try {
      const textoCuerpo = await request.text();
      if (textoCuerpo.length > MAX_CUERPO) return error('El diseño es demasiado grande para enviarlo al asistente.', 413);
      const x = JSON.parse(textoCuerpo) as unknown;
      if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('cuerpo');
      cuerpo = x as Record<string, unknown>;
    } catch {
      return error('La solicitud no es válida.', 400);
    }

    const instruccion = typeof cuerpo.instruccion === 'string' ? cuerpo.instruccion.trim() : '';
    if (!instruccion) return error('Escribe qué necesitas.', 400);
    if (instruccion.length > LIMITE_INSTRUCCION) return error(`La instrucción es muy larga (máximo ${LIMITE_INSTRUCCION} caracteres).`, 400);

    const verificado = await verificarVendedor(token).catch(() => error('No se pudo verificar tu sesión. Intenta de nuevo.', 503));
    if (verificado instanceof Response) return verificado;
    if (!dentroDelLimite(verificado.id)) return error('Vas muy rápido: espera un minuto antes de pedir otro diseño.', 429);

    const clave = process.env.GEMINI_API_KEY;
    if (!clave) return error('El asistente aún no está configurado (falta GEMINI_API_KEY en Vercel).', 503);

    let contexto;
    try {
      if (!cuerpo.diseno || typeof cuerpo.diseno !== 'object') throw new Error('sin diseño');
      contexto = contextoAsistente(normalizar({ ...(cuerpo.diseno as DisenoGuardado), imagenFrontal: null }));
    } catch {
      return error('No se pudo leer el diseño actual.', 400);
    }
    const extra = (cuerpo.contexto && typeof cuerpo.contexto === 'object' ? cuerpo.contexto : {}) as Record<string, unknown>;

    const modelo = process.env.GEMINI_MODEL?.trim() || MODELO_POR_DEFECTO;
    const ai = new GoogleGenAI({ apiKey: clave });
    let respuesta;
    try {
      respuesta = await ai.models.generateContent({
        model: modelo,
        contents: mensajeAsistente({
          instruccion,
          contexto,
          colores: sanearColores(extra.colores),
          historial: sanearHistorial(extra.historial),
          producto: typeof extra.producto === 'string' ? extra.producto : null,
        }),
        config: {
          systemInstruction: instruccionesAsistente(),
          responseMimeType: 'application/json',
          responseJsonSchema: esquemaPlan(),
          maxOutputTokens: 8192,
          // Los modelos Gemini 3 piensan antes de responder: «low» basta para planear y responde más rápido.
          ...(/^gemini-[3-9]/.test(modelo) ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
          httpOptions: { timeout: 50_000 },
        },
      });
    } catch (e) {
      return errorGemini(e);
    }

    if (respuesta.promptFeedback?.blockReason) return error('La IA no quiso responder esa instrucción. Escríbela de otra forma, solo sobre el diseño del mueble.', 422);
    const fin = respuesta.candidates?.[0]?.finishReason;
    let plan;
    try {
      plan = sanearPlan(JSON.parse(respuesta.text ?? ''));
    } catch {
      plan = null;
    }
    if (!plan) {
      console.error('Respuesta de Gemini sin plan:', fin, (respuesta.text ?? '').slice(0, 300));
      return error(fin === 'MAX_TOKENS' ? 'La IA no alcanzó a terminar: divide el pedido en instrucciones más cortas.' : 'La IA respondió algo que no se pudo leer. Intenta de nuevo.', 502);
    }
    return json({ plan, modelo });
  },
};
