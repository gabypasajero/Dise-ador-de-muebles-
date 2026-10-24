// Categorías de medidas del panel inferior: puertas, cajones, módulos y
// espacios, equipamiento/interior. Cambian según el tipo de mueble.
// Toda edición del mueble pasa por el motor (`operar` → `ejecutar`): si se rechaza, el panel
// muestra el motivo y el diseño no cambia. Al agregar o quitar módulos el mueble no cambia de
// medida: los módulos ajustables se reparten parejo el largo de su tramo.
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { destinosEquipo } from '../../shared/asistente';
import { distanciasEquipos, margenMaximo, textoDistancia } from '../../shared/equipos';
import {
  aperturaAjustable,
  calcularLayout,
  calcularLayoutAereos,
  calcularLayoutAereosLado,
  calcularLayoutTocador,
  disenoBase,
  disenoLado,
  largoPrincipalConEsquinas,
  type Frente,
} from '../../shared/layout';
import {
  LIMITES_AEREOS,
  LIMITES_LADO,
  cuerposDe,
  formaAereos,
  formaBase,
  formatear,
  largoTramo,
  limitesModulo,
  listarEquipamiento,
  maximoTramo,
  moduloCampana,
  nombreModulo,
  nombreModuloEn,
  nombreTramo,
  opcionesEquipo,
  posicionMinima,
  presetsModulo,
  absorbe,
  rolModulo,
  tiposPermitidos,
  tramosDe,
  type Forma,
  type ItemEquipo,
  type Operacion,
  type PresetModulo,
  type Resultado,
  type TramoId,
} from '../../shared/reglas';
import type { Cuerpo, Diseno, Encimera, Lavaplatos, Plantilla, Unidad } from '../../shared/tipos';
import { useApp, type Pestana } from '../store/useApp';
import { CampoMedida, Contador, Interruptor, Segmentado, Selector } from './Controles';
import { IcoAviso, IcoBasura, IcoDer, IcoIzq, IcoMas } from './Iconos';

type Cambiar = (f: (d: Diseno) => Diseno, grupo?: string) => void;

interface PropsPestana {
  d: Diseno;
  unidad: Unidad;
  /** Solo para lo que el motor no cubre (opciones del tocador, fila superior y mudador de la cómoda). */
  cambiar: Cambiar;
}

/** Ejecuta una operación del motor con deshacer, avisos y rechazo (ver useApp.operar). */
const operar = (op: Operacion, grupo?: string): Resultado => useApp.getState().operar(op, grupo);

const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function pestanasDe(p: Plantilla): { id: Pestana; texto: string }[] {
  switch (p) {
    case 'cocina':
    case 'compacto':
      return [
        { id: 'puertas', texto: 'Puertas' },
        { id: 'cajones', texto: 'Cajones' },
        { id: 'modulos', texto: 'Módulos y espacios' },
        { id: 'equipamiento', texto: 'Equipamiento' },
      ];
    case 'cocina-infantil':
      return [
        { id: 'puertas', texto: 'Puertas' },
        { id: 'modulos', texto: 'Módulos y espacios' },
        { id: 'equipamiento', texto: 'Equipamiento' },
      ];
    case 'closet':
    case 'escritorio':
      return [
        { id: 'puertas', texto: 'Puertas' },
        { id: 'cajones', texto: 'Cajones' },
        { id: 'modulos', texto: 'Módulos y espacios' },
        { id: 'equipamiento', texto: 'Interior' },
      ];
    case 'comoda':
      return [
        { id: 'cajones', texto: 'Cajones' },
        { id: 'modulos', texto: 'Módulos y espacios' },
        { id: 'equipamiento', texto: 'Extras' },
      ];
    case 'tocador':
      return [
        { id: 'cajones', texto: 'Cajones' },
        { id: 'modulos', texto: 'Estructura' },
        { id: 'equipamiento', texto: 'Espejo y luz' },
      ];
  }
}

const NOMBRE_TIPO: Record<Cuerpo['tipo'], string> = {
  frentes: 'Puertas / cajones',
  horno: 'Horno empotrado',
  hueco: 'Espacio libre',
  escritorio: 'Escritorio',
  campana: 'Campana',
  nicho: 'Nicho microondas',
  especiero: 'Especiero',
  'espacio-campana': 'Espacio campana',
};

// ---------- Tramos ----------

/** Orden en que se ven los tramos: de izquierda a derecha, primero el mueble base y luego los aéreos. */
const ORDEN_TRAMOS: TramoId[] = ['izq', 'base', 'der', 'aereos-izq', 'aereos', 'aereos-der'];

export function tramosOrdenados(d: Diseno): TramoId[] {
  const ts = tramosDe(d);
  return ORDEN_TRAMOS.filter((t) => ts.includes(t));
}

const esAereo = (t: TramoId) => t === 'aereos' || t === 'aereos-izq' || t === 'aereos-der';

/** Texto corto de la pestaña de cada tramo. */
function etiquetaTramo(d: Diseno, t: TramoId): string {
  if (d.plantilla === 'compacto') return t === 'base' ? 'Mueble base' : 'Mueble superior';
  switch (t) {
    case 'izq':
      return 'Lado izquierdo';
    case 'base':
      return 'Principal';
    case 'der':
      return 'Lado derecho';
    case 'aereos':
      return d.aereos.lados.izq || d.aereos.lados.der ? 'Aéreo principal' : 'Aéreos';
    case 'aereos-izq':
      return 'Aéreo izquierdo';
    case 'aereos-der':
      return 'Aéreo derecho';
  }
}

/** Color del número de módulo según el tramo (el 3D usa los mismos). */
function claseTramo(t: TramoId): string {
  if (t === 'base') return '';
  return esAereo(t) ? ' aereos' : ' lado';
}

/** «Módulo 2», «Aéreo 3», «Superior 1» (dentro de su tramo). */
function prefijoTramo(d: Diseno, t: TramoId): string {
  if (esAereo(t)) return d.plantilla === 'compacto' ? 'Superior' : 'Aéreo';
  return 'Módulo';
}

/** Deja elegido en el panel el módulo `id` (el creado por la operación si no se indica). */
function elegirModulo(r: Resultado, tramo: TramoId, id = r.id) {
  if (!r.ok || !id) return;
  const i = cuerposDe(r.diseno, tramo).findIndex((c) => c.id === id);
  if (i >= 0) useApp.getState().set({ tramoActivo: tramo, moduloActivo: i });
}

// ---------- Rechazos del motor ----------

/** Motivo del último rechazo. */
export function AvisoRechazo() {
  const rechazo = useApp((s) => s.rechazo);
  const set = useApp((s) => s.set);
  if (!rechazo) return null;
  return (
    <div className="aviso-rechazo" role="alert" key={rechazo.id}>
      <IcoAviso width={16} height={16} aria-hidden="true" />
      <p>{rechazo.motivo}</p>
      <div className="aviso-rechazo-acciones">
        <button type="button" className="boton chico" onClick={() => set({ rechazo: null })}>
          Entendido
        </button>
      </div>
    </div>
  );
}

// ---------- Frentes por tramo (Puertas y Cajones) ----------

function medida(f: Frente, unidad: Unidad) {
  return `${formatear(f.rect.x1 - f.rect.x0, unidad, false)} × ${formatear(f.rect.y1 - f.rect.y0, unidad)}`;
}

function CabeceraCuerpo({ d, i, c, tramo, unidad }: { d: Diseno; i: number; c: Cuerpo; tramo: TramoId; unidad: Unidad }) {
  return (
    <header className="tarjeta-cuerpo-cabeza">
      <span className={`numero-cuerpo${claseTramo(tramo)}`}>{i + 1}</span>
      <strong>
        {prefijoTramo(d, tramo)} {i + 1}
      </strong>
      <span className="tenue">{formatear(c.ancho, unidad)}</span>
    </header>
  );
}

interface Grupo {
  tramo: TramoId;
  cuerpos: Cuerpo[];
  frentes: Frente[];
}

/** Tramos con módulos del mueble y sus frentes, de izquierda a derecha (para las pestañas Puertas y Cajones). */
function gruposDe(d: Diseno, conAereos: boolean): Grupo[] {
  const out: Grupo[] = [];
  for (const t of tramosOrdenados(d)) {
    if (esAereo(t) && !conAereos) continue;
    let frentes: Frente[] = [];
    if (t === 'base') frentes = calcularLayout(disenoBase(d)).frentes;
    else if (t === 'izq' || t === 'der') {
      const dl = disenoLado(d, t);
      frentes = dl ? calcularLayout(dl).frentes : [];
    } else if (t === 'aereos') frentes = calcularLayoutAereos(d)?.frentes ?? [];
    else frentes = calcularLayoutAereosLado(d, t === 'aereos-izq' ? 'izq' : 'der')?.frentes ?? [];
    out.push({ tramo: t, cuerpos: cuerposDe(d, t), frentes });
  }
  return out;
}

function SeparadorTramo({ titulo }: { titulo: string }) {
  return (
    <div className="separador-tramo" role="heading" aria-level={3}>
      {titulo}
    </div>
  );
}

/** Apertura de la puerta única (o de la impar de un módulo de 3 puertas). */
function Apertura({ c, onCambio }: { c: Cuerpo; onCambio: (b: Cuerpo['bisagra']) => void }) {
  return (
    <Segmentado
      etiqueta={c.puertas === 1 ? 'Abre hacia la' : 'La puerta 1 abre hacia la'}
      valor={c.bisagra}
      onCambio={onCambio}
      opciones={[
        { valor: 'izq', texto: 'Izquierda', titulo: 'Abre hacia la izquierda (bisagras a la izquierda)' },
        { valor: 'der', texto: 'Derecha', titulo: 'Abre hacia la derecha (bisagras a la derecha)' },
      ]}
    />
  );
}

// ---------- Puertas ----------

export function PestanaPuertas({ d, unidad }: PropsPestana) {
  const grupos = gruposDe(d, true);
  return (
    <div className="pestana-contenido">
      <div className="opciones-globales">
        <Segmentado
          etiqueta="Tirador"
          valor={d.tirador}
          onCambio={(v) => operar({ op: 'fijarAcabados', tirador: v })}
          opciones={[
            { valor: 'barra', texto: 'Barra' },
            { valor: 'boton', texto: 'Botón' },
            { valor: 'sin', texto: 'Sin manilla' },
          ]}
        />
        <Interruptor activo={!!d.cierreSuave} onCambio={(v) => operar({ op: 'fijarAcabados', cierreSuave: v })} texto="Cierre suave (bisagras y correderas)" />
        <p className="ayuda">Las medidas de cada puerta aparecen sobre el modelo 3D. Haz clic en una puerta para abrirla.</p>
      </div>
      <div className="lista-cuerpos">
        {grupos.flatMap((g) => [
          ...(grupos.length > 1 ? [<SeparadorTramo key={`sep-${g.tramo}`} titulo={nombreTramo(d, g.tramo)} />] : []),
          ...g.cuerpos.map((c, i) => {
            const conPuertas = c.tipo === 'frentes' || c.tipo === 'campana' || c.tipo === 'nicho';
            if (!conPuertas)
              return (
                <article key={c.id} className="tarjeta-cuerpo apagada">
                  <CabeceraCuerpo d={d} i={i} c={c} tramo={g.tramo} unidad={unidad} />
                  <p className="tenue">{NOMBRE_TIPO[c.tipo]}: sin puertas.</p>
                </article>
              );
            const puertas = g.frentes.filter((f) => f.tipo === 'puerta' && f.cuerpo === i);
            const fija = c.tipo === 'nicho';
            const act = (cambios: Partial<Cuerpo>) => operar({ op: 'actualizarModulo', tramo: g.tramo, modulo: c.id, cambios });
            return (
              <article key={c.id} className="tarjeta-cuerpo">
                <CabeceraCuerpo d={d} i={i} c={c} tramo={g.tramo} unidad={unidad} />
                {esAereo(g.tramo) && c.tipo === 'frentes' && (
                  <Interruptor activo={!!c.abatible} onCambio={(v) => act({ abatible: v, puertas: 1 })} texto="Puerta abatible (se abre hacia arriba)" />
                )}
                {!fija && !c.abatible && <Contador etiqueta="Puertas" valor={c.puertas} min={c.tipo === 'campana' ? 1 : 0} max={4} onCambio={(v) => act({ puertas: v })} />}
                {fija && <p className="tenue">Puerta abatible sobre el nicho.</p>}
                {aperturaAjustable(c) && <Apertura c={c} onCambio={(v) => act({ bisagra: v })} />}
                {puertas.length > 0 && (
                  <ul className="medidas-frentes">
                    {puertas.map((f) => (
                      <li key={f.indice}>
                        <span>{f.tipo === 'puerta' && f.bisagra === 'arriba' ? 'Abatible' : `Puerta ${f.indice + 1}`}</span>
                        <strong>{medida(f, unidad)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                {c.puertas > 0 && puertas.length === 0 && <p className="tenue">No queda alto para puertas: reduce los cajones.</p>}
              </article>
            );
          }),
        ])}
      </div>
    </div>
  );
}

// ---------- Cajones ----------

export function PestanaCajones({ d, unidad, cambiar }: PropsPestana) {
  if (d.plantilla === 'tocador') return <CajonesTocador d={d} unidad={unidad} cambiar={cambiar} />;
  const grupos = gruposDe(d, false);
  const principal = grupos.find((g) => g.tramo === 'base')!;
  const fila = principal.frentes.filter((f) => f.tipo === 'cajon' && f.cuerpo === -1);
  return (
    <div className="pestana-contenido">
      {d.plantilla === 'comoda' && (
        <div className="opciones-globales">
          <Contador etiqueta="Cajones pequeños en fila superior" valor={d.filaSuperior} max={4} onCambio={(v) => cambiar((x) => ({ ...x, filaSuperior: v }))} />
          {fila.length > 0 && <p className="ayuda">Cada uno mide {medida(fila[0], unidad)}.</p>}
        </div>
      )}
      <div className="lista-cuerpos">
        {grupos.flatMap((g) => [
          ...(grupos.length > 1 ? [<SeparadorTramo key={`sep-${g.tramo}`} titulo={nombreTramo(d, g.tramo)} />] : []),
          ...g.cuerpos.map((c, i) => {
            if (c.tipo !== 'frentes')
              return (
                <article key={c.id} className="tarjeta-cuerpo apagada">
                  <CabeceraCuerpo d={d} i={i} c={c} tramo={g.tramo} unidad={unidad} />
                  <p className="tenue">{c.tipo === 'especiero' ? `${nombreModulo(c)}: cajón extraíble de alto completo.` : `${NOMBRE_TIPO[c.tipo]}: sin cajones.`}</p>
                </article>
              );
            const cajones = g.frentes.filter((f) => f.tipo === 'cajon' && f.cuerpo === i);
            const act = (cambios: Partial<Cuerpo>, grupo?: string) => operar({ op: 'actualizarModulo', tramo: g.tramo, modulo: c.id, cambios }, grupo);
            // Con el cajón arriba la puerta conserva al menos 20 cm: el frente del cajón llega hasta lo que deja libre.
            const puerta = c.cajonesArriba && c.puertas > 0 ? g.frentes.find((f) => f.tipo === 'puerta' && f.cuerpo === i) : undefined;
            const maxCajon =
              puerta && cajones.length ? Math.min(600, Math.max(90, Math.floor(Math.max(...cajones.map((f) => f.rect.y1)) - puerta.rect.y0 - d.luzFrentes - 200))) : 600;
            const altoReal = cajones.length ? Math.round(cajones[0].rect.y1 - cajones[0].rect.y0) : null;
            return (
              <article key={c.id} className="tarjeta-cuerpo">
                <CabeceraCuerpo d={d} i={i} c={c} tramo={g.tramo} unidad={unidad} />
                <Contador etiqueta="Cajones" valor={c.cajones} max={12} onCambio={(v) => act({ cajones: v })} />
                {c.cajones > 0 && c.puertas > 0 && (
                  <Segmentado
                    etiqueta="Cajones"
                    valor={c.cajonesArriba ? 'arriba' : 'abajo'}
                    onCambio={(v) => act({ cajonesArriba: v === 'arriba' })}
                    opciones={[
                      { valor: 'abajo', texto: 'Abajo' },
                      { valor: 'arriba', texto: 'Arriba' },
                    ]}
                  />
                )}
                {c.cajones > 1 && (
                  <Segmentado
                    etiqueta="Columnas"
                    valor={String(c.columnasCajones) as '1' | '2'}
                    onCambio={(v) => act({ columnasCajones: v === '2' ? 2 : 1 })}
                    opciones={[
                      { valor: '1', texto: '1 columna' },
                      { valor: '2', texto: '2 columnas' },
                    ]}
                  />
                )}
                {c.cajones > 0 && (
                  <>
                    <Segmentado
                      etiqueta="Alto de cada cajón"
                      valor={c.altoCajon > 0 ? 'fijo' : 'auto'}
                      onCambio={(v) => act({ altoCajon: v === 'fijo' ? Math.min(180, maxCajon) : 0 })}
                      opciones={[
                        { valor: 'auto', texto: 'Automático' },
                        { valor: 'fijo', texto: 'A medida' },
                      ]}
                    />
                    {c.altoCajon > 0 && (
                      <CampoMedida
                        etiqueta="Alto del frente"
                        compacto
                        valor={c.altoCajon}
                        unidad={unidad}
                        min={90}
                        max={maxCajon}
                        onCambio={(mm) => act({ altoCajon: mm }, `alto-cajon-${c.id}`)}
                      />
                    )}
                    {puerta && c.altoCajon > 0 && altoReal != null && c.altoCajon > altoReal && (
                      <p className="aviso-texto">Con el cajón arriba la puerta conserva al menos 20 cm: el frente queda en {formatear(altoReal, unidad)}.</p>
                    )}
                  </>
                )}
                {cajones.length > 0 && (
                  <ul className="medidas-frentes">
                    {cajones.map((f) => (
                      <li key={f.indice}>
                        <span>Cajón {f.indice + 1}</span>
                        <strong>{medida(f, unidad)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                {cajones.length < c.cajones && <p className="aviso-texto">Solo caben {cajones.length} cajones con ese alto.</p>}
              </article>
            );
          }),
        ])}
      </div>
    </div>
  );
}

function CajonesTocador({ d, unidad, cambiar }: PropsPestana) {
  const l = calcularLayoutTocador(d);
  const grupos: { clave: 'cajonesIzq' | 'cajonesCentro' | 'cajonesDer'; nombre: string; cuerpo: number; max: number }[] = [
    { clave: 'cajonesIzq', nombre: 'Cajonera izquierda', cuerpo: 0, max: 6 },
    { clave: 'cajonesCentro', nombre: 'Cajones centrales', cuerpo: 1, max: 3 },
    { clave: 'cajonesDer', nombre: 'Cajonera derecha', cuerpo: 2, max: 6 },
  ];
  return (
    <div className="pestana-contenido">
      <div className="lista-cuerpos">
        {grupos.map((g) => {
          const cajones = l.frentes.filter((f) => f.cuerpo === g.cuerpo);
          return (
            <article key={g.clave} className="tarjeta-cuerpo">
              <header className="tarjeta-cuerpo-cabeza">
                <strong>{g.nombre}</strong>
              </header>
              <Contador
                etiqueta="Cajones"
                valor={d.tocador[g.clave]}
                max={g.max}
                onCambio={(v) => cambiar((x) => ({ ...x, tocador: { ...x.tocador, [g.clave]: v } }))}
              />
              {cajones.length > 0 && (
                <ul className="medidas-frentes">
                  {cajones.map((f, k) => (
                    <li key={f.indice}>
                      <span>Cajón {k + 1}</span>
                      <strong>{medida(f, unidad)}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Módulos y espacios ----------

/** Dónde se ajusta el resto del módulo, según las pestañas que tiene este mueble. */
function ayudaModulo(d: Diseno, c: Cuerpo, tramo: TramoId): string {
  if (c.tipo === 'hueco') return esAereo(tramo) ? 'Sin mueble: queda libre para una ventana o un extractor.' : 'Hueco libre para refrigerador, lavadora u otro equipo. La cubierta pasa por encima.';
  if (c.tipo === 'horno')
    return d.plantilla === 'cocina-infantil' ? 'Horno de juguete con puerta con ventana.' : 'Módulo para horno empotrado, con faja de melamina arriba.';
  if (c.tipo === 'especiero') return 'Cajón extraíble de alto completo, con sus pisos interiores.';
  if (c.tipo === 'escritorio') return 'Cubierta de trabajo: ajusta aquí su ancho y su alto.';
  if (c.tipo === 'campana') return c.campanaDe ? 'Aloja la campana: va centrado sobre su encimera.' : 'Mueble más bajo con puertas: abajo queda la campana.';
  if (c.tipo === 'espacio-campana')
    return c.campanaDe ? 'Hueco abierto de 60 cm con la campana instalada: va centrado sobre su encimera.' : 'Hueco abierto de 60 cm para instalar la campana (sin puertas ni repisas).';
  if (c.tipo === 'nicho') return 'Puerta abatible arriba y nicho abierto con repisa para el microondas.';
  if (contenidoEnEditor(d)) return '';
  const pestanas = pestanasDe(d.plantilla).filter(
    (p) => p.id === 'puertas' || (p.id === 'cajones' && !esAereo(tramo)) || (p.id === 'equipamiento' && p.texto === 'Interior' && tramo === 'base'),
  );
  if (!pestanas.length) return '';
  const y = (xs: string[]) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);
  const que = y(pestanas.map((p) => p.texto.toLowerCase()));
  return `Sus ${que} se ajustan en ${pestanas.length === 1 ? 'la pestaña' : 'las pestañas'} ${y(pestanas.map((p) => p.texto))}.`;
}

/** En la cocina el editor del módulo también cambia puertas y cajones (en los demás muebles van en sus pestañas). */
function contenidoEnEditor(d: Diseno): boolean {
  return d.plantilla === 'cocina' || d.plantilla === 'compacto';
}

function nombreTipo(t: Cuerpo['tipo'], p: Plantilla): string {
  return t === 'horno' && p === 'cocina-infantil' ? 'Horno de juguete' : NOMBRE_TIPO[t];
}

const FORMAS: { valor: Forma; texto: string }[] = [
  { valor: 'lineal', texto: 'Lineal' },
  { valor: 'L-izq', texto: 'L izquierda' },
  { valor: 'L-der', texto: 'L derecha' },
  { valor: 'U', texto: 'U' },
];

/** Forma del mueble base y de los aéreos (solo la cocina). */
function FormaCocina({ d }: { d: Diseno }) {
  const set = useApp((s) => s.set);
  const forma = formaBase(d);
  const formaA = d.aereos.cuadrado ? 'cuadrado' : formaAereos(d);
  const cambiarForma = (v: Forma) => {
    const antes = tramosDe(d);
    const r = operar({ op: 'fijarForma', forma: v });
    if (!r.ok) return;
    // Se abre el lado nuevo para darle sus medidas; en la U, el izquierdo.
    const nuevo = tramosDe(r.diseno).find((t) => (t === 'izq' || t === 'der') && !antes.includes(t));
    if (nuevo) set({ tramoActivo: nuevo, moduloActivo: 0 });
  };
  return (
    <>
      <Segmentado etiqueta="Forma del mueble" valor={forma} onCambio={cambiarForma} opciones={FORMAS} />
      <Interruptor
        activo={d.aereos.activo}
        onCambio={(v) => {
          const r = operar({ op: 'activarAereos', activo: v });
          if (r.ok) set({ tramoActivo: v ? 'aereos' : 'base', moduloActivo: 0 });
        }}
        texto="Muebles aéreos"
      />
      {d.aereos.activo && (
        <Segmentado
          etiqueta="Forma de los aéreos"
          valor={formaA}
          onCambio={(v) => (v === 'cuadrado' ? operar({ op: 'fijarAereosCuadrados', cuadrado: true }) : operar({ op: 'fijarFormaAereos', forma: v }))}
          opciones={[{ valor: 'cuadrado' as const, texto: 'Igual al mueble (cuadrado)', titulo: 'Siguen la forma y los largos del mueble base' }, ...FORMAS]}
        />
      )}
    </>
  );
}

/** Medidas propias del tramo elegido: lados de la L/U y aéreos. Van antes de la tira para verlas sin desplazar el panel. */
function MedidasTramo({ d, tramo, unidad }: { d: Diseno; tramo: TramoId; unidad: Unidad }) {
  if (tramo === 'izq' || tramo === 'der') {
    const l = d.lados[tramo];
    if (!l) return null;
    const lado = tramo;
    return (
      <div className="opciones-globales espacios">
        <CampoMedida
          etiqueta="Largo (desde el muro)"
          compacto
          valor={l.largo}
          unidad={unidad}
          min={LIMITES_LADO.largo[0]}
          max={LIMITES_LADO.largo[1]}
          onCambio={(mm) => operar({ op: 'fijarLado', lado, largo: mm }, `largo-${lado}`)}
        />
        <CampoMedida
          etiqueta="Fondo"
          compacto
          valor={l.profundidad}
          unidad={unidad}
          min={LIMITES_LADO.profundidad[0]}
          max={LIMITES_LADO.profundidad[1]}
          onCambio={(mm) => operar({ op: 'fijarLado', lado, profundidad: mm }, `fondo-${lado}`)}
        />
        <p className="ayuda">
          Medido completo, con la esquina. Para módulos quedan {formatear(largoTramo(d, tramo), unidad)} (el resto es la esquina bajo la cubierta del tramo principal).
        </p>
      </div>
    );
  }
  if (tramo === 'base') {
    if (d.plantilla !== 'cocina' || formaBase(d) === 'lineal') return null;
    return (
      <p className="ayuda ayuda-tramo">
        Tramo principal: {formatear(largoPrincipalConEsquinas(d), unidad)} medido completo, con las esquinas (sus módulos suman {formatear(d.ancho, unidad)}). Su largo y su fondo se cambian en Medidas.
      </p>
    );
  }
  const a = d.aereos;
  if (tramo === 'aereos') {
    if (d.plantilla === 'compacto')
      return (
        <div className="opciones-globales espacios">
          <CampoMedida
            etiqueta="Alto del mueble base"
            compacto
            valor={a.elevacion}
            unidad={unidad}
            min={LIMITES_AEREOS.base[0]}
            max={LIMITES_AEREOS.base[1]}
            onCambio={(mm) => operar({ op: 'fijarAereos', elevacion: mm }, 'base-compacto')}
          />
          <CampoMedida
            etiqueta="Alto del mueble superior"
            compacto
            valor={a.alto}
            unidad={unidad}
            min={LIMITES_AEREOS.alto[0]}
            max={d.alto - a.elevacion - 300}
            onCambio={(mm) => operar({ op: 'fijarAereos', alto: mm }, 'alto-aereos')}
          />
          <CampoMedida
            etiqueta="Fondo"
            compacto
            valor={a.profundidad}
            unidad={unidad}
            min={LIMITES_AEREOS.profundidad[0]}
            max={Math.min(LIMITES_AEREOS.profundidad[1], d.profundidad)}
            onCambio={(mm) => operar({ op: 'fijarAereos', profundidad: mm }, 'fondo-aereos')}
          />
        </div>
      );
    const forma = formaAereos(d);
    return (
      <div className="opciones-globales espacios">
        <CampoMedida
          etiqueta="Altura desde el piso"
          compacto
          valor={a.elevacion}
          unidad={unidad}
          min={LIMITES_AEREOS.elevacion[0]}
          max={LIMITES_AEREOS.elevacion[1]}
          onCambio={(mm) => operar({ op: 'fijarAereos', elevacion: mm }, 'elevacion')}
        />
        <CampoMedida
          etiqueta="Alto de los aéreos"
          compacto
          valor={a.alto}
          unidad={unidad}
          min={LIMITES_AEREOS.alto[0]}
          max={LIMITES_AEREOS.alto[1]}
          onCambio={(mm) => operar({ op: 'fijarAereos', alto: mm }, 'alto-aereos')}
        />
        <CampoMedida
          etiqueta="Fondo"
          compacto
          valor={a.profundidad}
          unidad={unidad}
          min={LIMITES_AEREOS.profundidad[0]}
          max={LIMITES_AEREOS.profundidad[1]}
          onCambio={(mm) => operar({ op: 'fijarAereos', profundidad: mm }, 'fondo-aereos')}
        />
        {forma !== 'U' && (
          <CampoMedida
            etiqueta="Largo"
            compacto
            valor={largoTramo(d, 'aereos')}
            unidad={unidad}
            min={LIMITES_AEREOS.ancho[0]}
            max={LIMITES_AEREOS.ancho[1]}
            onCambio={(mm) => operar({ op: 'fijarLargoAereos', largo: mm }, 'largo-aereos')}
          />
        )}
        {!a.cuadrado && forma === 'lineal' && (
          <Segmentado
            etiqueta="Alineación"
            valor={a.alineacion}
            onCambio={(v) => operar({ op: 'fijarAereos', alineacion: v })}
            opciones={[
              { valor: 'izq', texto: 'Izquierda' },
              { valor: 'centro', texto: 'Centro' },
              { valor: 'der', texto: 'Derecha' },
            ]}
          />
        )}
        {!a.cuadrado && (
          <button type="button" className="boton secundario chico" onClick={() => operar({ op: 'fijarAereosCuadrados', cuadrado: true })}>
            Cuadrar con el mueble
          </button>
        )}
        <p className="ayuda">
          {a.cuadrado
            ? 'Iguales al mueble: siguen su forma y sus largos. Si cambias el largo aquí, el aéreo queda a medida, independiente del mueble.'
            : forma === 'U'
              ? 'En U el aéreo principal va de muro a muro.'
              : 'El alto y la altura valen para todos los aéreos.'}
        </p>
      </div>
    );
  }
  const lado = tramo === 'aereos-izq' ? 'izq' : 'der';
  const la = a.lados[lado];
  if (!la) return null;
  return (
    <div className="opciones-globales espacios">
      {(
        <CampoMedida
          etiqueta="Largo (desde el muro)"
          compacto
          valor={la.largo}
          unidad={unidad}
          min={LIMITES_AEREOS.ladoLargo[0]}
          max={LIMITES_AEREOS.ladoLargo[1]}
          onCambio={(mm) => operar({ op: 'fijarLadoAereo', lado, largo: mm }, `largo-aereo-${lado}`)}
        />
      )}
      <CampoMedida
        etiqueta="Fondo"
        compacto
        valor={la.profundidad}
        unidad={unidad}
        min={LIMITES_AEREOS.profundidad[0]}
        max={LIMITES_AEREOS.profundidad[1]}
        onCambio={(mm) => operar({ op: 'fijarLadoAereo', lado, profundidad: mm }, `fondo-aereo-${lado}`)}
      />
      <p className="ayuda">
        {a.cuadrado ? `Largo ${formatear(la.largo, unidad)}, igual al lado del mueble. ` : ''}
        Alto {formatear(a.alto, unidad)} a {formatear(a.elevacion, unidad)} del piso, como el aéreo principal.
      </p>
    </div>
  );
}

const TEXTO_ROL = { fijo: 'Fijo', equipado: 'Equipado', ajustable: 'Ajustable' } as const;

/** Texto del chip de rol: el espacio libre no lleva equipamiento, queda reservado para un equipo. */
function textoRol(rol: keyof typeof TEXTO_ROL, c: Cuerpo, conserva = false): string {
  if (conserva) return 'Medida fija';
  return c.tipo === 'hueco' && rol === 'equipado' ? 'Reservado' : TEXTO_ROL[rol];
}

function ayudaRol(d: Diseno, tramo: TramoId, c: Cuerpo, unidad: Unidad): string {
  const rol = rolModulo(d, tramo, c);
  if (rol === 'fijo') return `Mide siempre ${formatear(c.ancho, unidad)}: no cede ni toma espacio.`;
  if (rol === 'equipado') return 'Aloja la campana: va siempre centrado sobre su encimera.';
  const cocina = d.plantilla === 'cocina' || d.plantilla === 'compacto';
  if (!cocina) return 'Se reparte parejo con los demás módulos cuando agregas o quitas módulos.';
  if (c.tipo === 'hueco') return `Espacio libre de ${formatear(200, unidad)} a ${formatear(500, unidad)}: se ajusta si hace falta espacio.`;
  if (absorbe(d, tramo, c))
    return `Es lo primero que se ajusta (de ${formatear(600, unidad)} a ${formatear(900, unidad)}) para mantener la medida del cliente al agregar o quitar módulos.`;
  return 'Medida estándar de 35 cm por puerta: se ajusta solo si las cajoneras no alcanzan. Puedes cambiarla a mano.';
}

export function PestanaModulos({ d, unidad, cambiar }: PropsPestana) {
  const guardado = useApp((s) => s.moduloActivo);
  const tramoGuardado = useApp((s) => s.tramoActivo);
  const set = useApp((s) => s.set);
  const [insertarEn, setInsertarEn] = useState<number | null>(null);
  const tramos = tramosOrdenados(d);
  const tramo: TramoId = tramos.includes(tramoGuardado) ? tramoGuardado : 'base';
  const cuerpos = cuerposDe(d, tramo);
  const n = cuerpos.length;
  const activo = Math.max(0, Math.min(n - 1, guardado));
  const tira = useRef<HTMLDivElement>(null);
  const panelInsertar = useRef<HTMLDivElement>(null);
  const equipos = useMemo(() => listarEquipamiento(d), [d]);
  // El panel de inserción se cierra si cambia el mueble, el tramo, la cantidad de módulos (deshacer) o el módulo elegido.
  useEffect(() => setInsertarEn(null), [n, d.plantilla, guardado, tramo]);
  useEffect(() => {
    if (insertarEn != null) panelInsertar.current?.scrollIntoView({ block: 'nearest' });
  }, [insertarEn]);
  // Con muchos módulos (o en el teléfono) el elegido queda a la vista en la tira.
  useEffect(() => {
    tira.current?.querySelector('.bloque-modulo.activo')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activo, n, tramo]);
  if (d.plantilla === 'tocador') return <EstructuraTocador d={d} unidad={unidad} cambiar={cambiar} />;

  const tipos = tiposPermitidos(d, tramo);
  const presets = presetsModulo(d.plantilla, tramo);
  const c = cuerpos[activo];
  const minPos = posicionMinima(d, tramo);
  const insertar = insertarEn != null && insertarEn >= minPos && insertarEn <= n ? insertarEn : null;
  const prefijo = prefijoTramo(d, tramo);
  const conTramos = d.plantilla === 'cocina' || d.plantilla === 'compacto';
  const pestanas = pestanasDe(d.plantilla).map((p) => p.id);
  const enEditor = contenidoEnEditor(d);

  const agregar = (preset: PresetModulo, posicion: number) => {
    setInsertarEn(null);
    const r = operar({ op: 'agregarModulo', tramo, preset: preset.id, posicion: Math.max(minPos, Math.min(n, posicion)) });
    elegirModulo(r, tramo);
  };
  const elegir = (i: number) => {
    setInsertarEn(null);
    set({ moduloActivo: i });
  };
  const elegirTramo = (t: TramoId) => set({ tramoActivo: t, moduloActivo: 0 });

  const editor = (() => {
    if (!c) return null;
    const act = (cambios: Partial<Cuerpo>, grupo?: string) => operar({ op: 'actualizarModulo', tramo, modulo: c.id, cambios }, grupo);
    const rol = rolModulo(d, tramo, c);
    const lim = limitesModulo(d, tramo, c);
    const campanaAlojada = c.tipo === 'campana' && !!c.campanaDe;
    // El horno y el especiero miden siempre lo mismo; el superior único del compacto, lo mismo que el base.
    const bloqueado = rol === 'fijo' || campanaAlojada || (tramo === 'aereos' && d.plantilla === 'compacto' && n === 1);
    const lleva = equipos.filter((e) => e.tramo === tramo && e.modulo === c.id);
    const mover = (delta: -1 | 1) => elegirModulo(operar({ op: 'moverModulo', tramo, modulo: c.id, delta }), tramo, c.id);
    const conPuertas = enEditor && pestanas.includes('puertas') && (c.tipo === 'frentes' || c.tipo === 'campana') && !c.abatible;
    const conCajones = enEditor && pestanas.includes('cajones') && c.tipo === 'frentes' && !esAereo(tramo);
    return (
      <div className={`modulo-editor${c.tipo === 'hueco' ? ' hueco' : ''}`}>
        <div className="modulo-editor-cabeza">
          <span className={`numero-cuerpo${claseTramo(tramo)}`}>{activo + 1}</span>
          <strong>
            {prefijo} {activo + 1}
          </strong>
          <span className={`chip-rol ${rol}`} title={ayudaRol(d, tramo, c, unidad)}>
            {textoRol(rol, c)}
          </span>
          <span className="acciones-cuerpo">
            <button type="button" className="boton-icono" aria-label="Mover a la izquierda" title="Mover a la izquierda" disabled={activo - 1 < minPos} onClick={() => mover(-1)}>
              <IcoIzq width={15} height={15} />
            </button>
            <button
              type="button"
              className="boton-icono"
              aria-label="Mover a la derecha"
              title="Mover a la derecha"
              disabled={activo === n - 1 || activo < minPos}
              onClick={() => mover(1)}
            >
              <IcoDer width={15} height={15} />
            </button>
            <button
              type="button"
              className="boton-icono peligro"
              aria-label={`Quitar ${prefijo.toLowerCase()} ${activo + 1}`}
              title="Quitar este módulo"
              disabled={n <= 1}
              onClick={() => {
                const r = operar({ op: 'quitarModulo', tramo, modulo: c.id });
                if (r.ok) set({ moduloActivo: Math.max(0, activo - 1) });
              }}
            >
              <IcoBasura width={15} height={15} />
            </button>
          </span>
        </div>
        <p className="rol-modulo">{ayudaRol(d, tramo, c, unidad)}</p>
        {lleva.length > 0 && (
          <p className="equipos-modulo">
            Lleva: {lleva.map((e) => e.nombre).join(', ')}. <span className="tenue">Se cambia en Equipamiento.</span>
          </p>
        )}
        {tipos.length > 1 && !campanaAlojada && (
          <Selector
            etiqueta="Tipo"
            valor={c.tipo}
            opciones={tipos.filter((t) => t !== 'campana' || c.tipo === 'campana').map((t) => ({ valor: t, texto: nombreTipo(t, d.plantilla) }))}
            onCambio={(v) =>
              act({
                tipo: v,
                ...(v === 'frentes' ? { puertas: Math.max(1, c.puertas), abatible: false } : {}),
                ...(v === 'nicho' ? { puertas: 1, abatible: true } : {}),
                ...(v === 'especiero' ? { pisos: 2 } : {}),
                ...(v === 'escritorio' ? { alto: 750 } : { alto: 0 }),
              })
            }
          />
        )}
        <CampoMedida
          etiqueta={bloqueado ? 'Ancho del módulo (fijo)' : 'Ancho del módulo'}
          compacto
          valor={c.ancho}
          unidad={unidad}
          min={lim.min}
          max={Math.max(lim.min, maximoTramo(d, tramo))}
          deshabilitado={bloqueado}
          onCambio={(mm) => operar({ op: 'fijarAnchoModulo', tramo, modulo: c.id, ancho: mm }, `ancho-cuerpo-${c.id}`)}
        />
        {c.tipo === 'escritorio' && (
          <CampoMedida
            etiqueta="Alto del escritorio"
            compacto
            valor={c.alto || 750}
            unidad={unidad}
            min={450}
            max={Math.min(900, d.alto)}
            onCambio={(mm) => act({ alto: mm }, `alto-esc-${c.id}`)}
          />
        )}
        {conPuertas && <Contador etiqueta="Puertas" valor={c.puertas} min={c.tipo === 'campana' ? 1 : 0} max={4} onCambio={(v) => act({ puertas: v })} />}
        {conCajones && <Contador etiqueta="Cajones" valor={c.cajones} max={12} onCambio={(v) => act({ cajones: v })} />}
        {aperturaAjustable(c) && <Apertura c={c} onCambio={(v) => act({ bisagra: v })} />}
        {esAereo(tramo) && c.tipo === 'frentes' && <Interruptor activo={!!c.abatible} onCambio={(v) => act({ abatible: v, puertas: 1 })} texto="Abatible" />}
        {c.tipo === 'especiero' && (
          <Segmentado
            etiqueta="Pisos"
            valor={String(c.pisos ?? 2) as '2' | '3'}
            onCambio={(v) => act({ pisos: Number(v) })}
            opciones={[
              { valor: '2', texto: '2 pisos' },
              { valor: '3', texto: '3 pisos' },
            ]}
          />
        )}
        {ayudaModulo(d, c, tramo) && <p className="tenue">{ayudaModulo(d, c, tramo)}</p>}
      </div>
    );
  })();

  return (
    <div className="pestana-contenido modulos">
      {conTramos && (
        <div className="modulos-forma">
          {d.plantilla === 'cocina' && <FormaCocina d={d} />}
          {tramos.length > 1 && (
            <div className="selector-tramo" role="tablist" aria-label="Tramo que editas">
              {tramos.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={t === tramo} className={t === tramo ? 'activo' : ''} onClick={() => elegirTramo(t)}>
                  {etiquetaTramo(d, t)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <MedidasTramo d={d} tramo={tramo} unidad={unidad} />

      <div className="modulos-cabeza">
        <strong>
          {tramos.length > 1 ? nombreTramo(d, tramo) : 'Distribución'} · {n} {n === 1 ? 'módulo' : 'módulos'} · {formatear(largoTramo(d, tramo), unidad)}
        </strong>
        <div className="modulos-agregar" role="group" aria-label="Agregar al final">
          {presets.map((p) => (
            <button key={p.id} type="button" className="boton secundario chico" title={`${p.ayuda}. Se agrega a la derecha.`} onClick={() => agregar(p, n)}>
              <IcoMas width={14} height={14} /> {p.texto}
            </button>
          ))}
        </div>
      </div>

      <div className={`tira-modulos ${tramo}`} ref={tira} role="group" aria-label={`${nombreTramo(d, tramo)}: módulos de izquierda a derecha`}>
        {cuerpos.map((m, i) => {
          const rol = rolModulo(d, tramo, m);
          return (
            <Fragment key={m.id}>
              {i >= minPos && <BotonInsertar posicion={i} abierto={insertar === i} onClick={() => setInsertarEn(insertar === i ? null : i)} />}
              <button
                type="button"
                className={`bloque-modulo ${m.tipo}${i === activo ? ' activo' : ''}${rol !== 'ajustable' ? ` ${rol}` : ''}`}
                style={{ flexGrow: m.ancho }}
                aria-pressed={i === activo}
                aria-label={`${mayus(nombreModuloEn(d, tramo, i))}: ${nombreModulo(m)}, ${formatear(m.ancho, unidad)}${rol !== 'ajustable' ? `, ${textoRol(rol, m).toLowerCase()}` : ''}`}
                onClick={() => elegir(i)}
              >
                <span className={`numero-cuerpo${claseTramo(tramo)}`}>{i + 1}</span>
                <span className="bloque-modulo-texto">
                  <span className="bloque-modulo-nombre">{nombreModulo(m)}</span>
                  <span className="bloque-modulo-ancho">
                    {formatear(m.ancho, unidad)}
                    {rol !== 'ajustable' ? ` · ${rol}` : ''}
                  </span>
                </span>
              </button>
            </Fragment>
          );
        })}
        <BotonInsertar posicion={n} abierto={insertar === n} onClick={() => setInsertarEn(insertar === n ? null : n)} />
      </div>

      {insertar != null ? (
        <div className="modulos-insertar" ref={panelInsertar}>
          <span>
            {insertar === 0
              ? 'Agregar al comienzo (izquierda):'
              : insertar === n
                ? 'Agregar al final (derecha):'
                : `Agregar entre ${prefijo.toLowerCase() === 'módulo' ? 'el módulo' : `el ${prefijo.toLowerCase()}`} ${insertar} y el ${insertar + 1}:`}
          </span>
          {presets.map((p) => (
            <button key={p.id} type="button" className="boton secundario chico" title={p.ayuda} onClick={() => agregar(p, insertar)}>
              <IcoMas width={14} height={14} /> {p.texto}
            </button>
          ))}
          <button type="button" className="boton chico" onClick={() => setInsertarEn(null)}>
            Cancelar
          </button>
        </div>
      ) : (
        editor
      )}

      {tramo === 'base' && (
        <div className="opciones-globales espacios">
          <CampoMedida
            etiqueta="Separación entre módulos"
            compacto
            valor={d.separacionCuerpos}
            unidad={unidad}
            paso={unidad === 'cm' ? 5 : 1}
            min={0}
            max={200}
            onCambio={(mm) => operar({ op: 'fijarSeparacion', separacion: mm }, 'separacion')}
          />
          <CampoMedida
            etiqueta="Zócalo"
            compacto
            valor={d.zocalo}
            unidad={unidad}
            paso={unidad === 'cm' ? 5 : 1}
            min={0}
            max={200}
            onCambio={(mm) => operar({ op: 'fijarAcabados', zocalo: mm }, 'zocalo')}
          />
          <CampoMedida
            etiqueta="Luz entre frentes"
            compacto
            valor={d.luzFrentes}
            unidad="mm"
            paso={1}
            min={1}
            max={10}
            onCambio={(mm) => operar({ op: 'fijarAcabados', luzFrentes: mm }, 'luz')}
          />
          <Segmentado
            etiqueta="Espesor melamina"
            valor={String(d.espesor) as '15' | '18'}
            onCambio={(v) => operar({ op: 'fijarAcabados', espesor: v === '18' ? 18 : 15 })}
            opciones={[
              { valor: '15', texto: '15 mm' },
              { valor: '18', texto: '18 mm' },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function BotonInsertar({ posicion, abierto, onClick }: { posicion: number; abierto: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={`insertar-modulo${abierto ? ' abierto' : ''}`}
      aria-label={`Agregar módulo o espacio en la posición ${posicion + 1}`}
      aria-expanded={abierto}
      title="Agregar aquí un módulo o espacio"
      onClick={onClick}
    >
      <IcoMas width={12} height={12} />
    </button>
  );
}

function EstructuraTocador({ d, unidad, cambiar }: PropsPestana) {
  return (
    <div className="pestana-contenido">
      <div className="opciones-globales espacios">
        <CampoMedida
          etiqueta="Alto de la cubierta"
          compacto
          valor={d.tocador.altoCubierta}
          unidad={unidad}
          min={450}
          max={Math.min(900, d.alto - 400)}
          onCambio={(mm) => cambiar((x) => ({ ...x, tocador: { ...x.tocador, altoCubierta: mm } }), 'alto-cubierta')}
        />
        <CampoMedida
          etiqueta="Luz entre frentes"
          compacto
          valor={d.luzFrentes}
          unidad="mm"
          paso={1}
          min={1}
          max={10}
          onCambio={(mm) => operar({ op: 'fijarAcabados', luzFrentes: mm }, 'luz')}
        />
        <Segmentado
          etiqueta="Espesor melamina"
          valor={String(d.espesor) as '15' | '18'}
          onCambio={(v) => operar({ op: 'fijarAcabados', espesor: v === '18' ? 18 : 15 })}
          opciones={[
            { valor: '15', texto: '15 mm' },
            { valor: '18', texto: '18 mm' },
          ]}
        />
        <Segmentado
          etiqueta="Tirador"
          valor={d.tirador}
          onCambio={(v) => operar({ op: 'fijarAcabados', tirador: v })}
          opciones={[
            { valor: 'boton', texto: 'Botón' },
            { valor: 'barra', texto: 'Barra' },
            { valor: 'sin', texto: 'Sin manilla' },
          ]}
        />
      </div>
    </div>
  );
}

// ---------- Equipamiento / interior / extras ----------

/** Un equipo (encimera, lavaplatos u horno) con dónde está, a dónde se puede mover y sus opciones. */
function TarjetaEquipo({ d, item, items, unidad }: { d: Diseno; item: ItemEquipo; items: ItemEquipo[]; unidad: Unidad }) {
  const ops = opcionesEquipo(d.plantilla);
  const destinos = useMemo(() => destinosEquipo(d, item.id), [d, item.id]);
  const eq = d.equipos.find((e) => e.id === item.id);
  const campana = items.find((i) => i.tipo === 'campana' && i.de === item.id);
  const actual = destinos.find((x) => x.actual);
  const noVan = destinos.filter((x) => !x.ok);
  const config = (cambios: Parameters<typeof configurar>[1], grupo?: string) => configurar(item.id, cambios, grupo);
  return (
    <article className="tarjeta-cuerpo ancha tarjeta-equipo">
      <header className="tarjeta-cuerpo-cabeza">
        <strong>{item.nombre}</strong>
        <button
          type="button"
          className="boton-icono peligro"
          aria-label={`Quitar ${item.nombre.toLowerCase()}`}
          title="Quitar"
          onClick={() => operar({ op: 'quitarEquipo', id: item.id })}
        >
          <IcoBasura width={15} height={15} />
        </button>
      </header>
      <p className="tenue">
        {mayus(item.donde)} · {item.detalle}
      </p>
      {destinos.length > 1 && (
        <Selector
          etiqueta="Mover a"
          valor={actual ? `${actual.tramo}|${actual.modulo}` : ''}
          opciones={destinos.map((x) => ({
            valor: `${x.tramo}|${x.modulo}`,
            texto: `${mayus(x.nombre)}${x.actual ? ' (aquí)' : x.ok ? '' : ' · no se puede'}`,
            deshabilitada: !x.ok,
          }))}
          onCambio={(v) => {
            const [tramo, modulo] = v.split('|');
            operar({ op: 'moverEquipo', id: item.id, tramo: tramo as TramoId, modulo });
          }}
        />
      )}
      {noVan.length > 0 && (
        <details className="porque-no">
          <summary>
            Por qué no va en {noVan.length === 1 ? '1 módulo' : `${noVan.length} módulos`}
          </summary>
          <ul>
            {noVan.map((x) => (
              <li key={`${x.tramo}-${x.modulo}`}>
                <strong>{mayus(x.nombre)}:</strong> {x.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}
      {eq?.tipo === 'encimera' && <OpcionesEncimera d={d} e={eq} campana={campana} config={config} />}
      {eq?.tipo === 'lavaplatos' && <OpcionesLavaplatos d={d} l={eq} unidad={unidad} config={config} ops={ops} />}
    </article>
  );
}

const configurar = (id: string, cambios: Extract<Operacion, { op: 'configurarEquipo' }>['cambios'], grupo?: string) =>
  operar({ op: 'configurarEquipo', id, cambios }, grupo);

type Configurar = (cambios: Parameters<typeof configurar>[1], grupo?: string) => Resultado;

function OpcionesEncimera({ d, e, campana, config }: { d: Diseno; e: Encimera; campana?: ItemEquipo; config: Configurar }) {
  const ops = opcionesEquipo(d.plantilla);
  const mural = e.campana && !moduloCampana(d, e.id);
  return (
    <>
      <Segmentado etiqueta="Platos" valor={e.platos} onCambio={(v) => config({ platos: v })} opciones={ops.platos.map((p) => ({ valor: p, texto: `${p} platos` }))} />
      <Interruptor activo={e.soloCorte} onCambio={(v) => config({ soloCorte: v })} texto="Solo corte (el cliente trae el equipo)" />
      {ops.campana && <Interruptor activo={e.campana} onCambio={(v) => config({ campana: v })} texto="Campana sobre la encimera" />}
      {e.campana && campana && (
        <p className={mural ? 'aviso-texto' : 'tenue'}>
          {mural
            ? `Campana mural: no hay aéreo sobre la encimera, va al muro con su chimenea (${campana.detalle}).`
            : `Campana en el ${campana.donde}, centrada sobre la encimera.`}
        </p>
      )}
    </>
  );
}

function OpcionesLavaplatos({ d, l, unidad, config, ops }: { d: Diseno; l: Lavaplatos; unidad: Unidad; config: Configurar; ops: ReturnType<typeof opcionesEquipo> }) {
  const modulo = cuerposDe(d, l.tramo).find((c) => c.id === l.modulo);
  const max = modulo ? margenMaximo(modulo, l, d) : 50;
  return (
    <>
      {ops.lavaplatos.length > 1 && (
        <Segmentado
          etiqueta="Modelo"
          valor={l.modelo}
          onCambio={(v) => config({ modelo: v })}
          opciones={ops.lavaplatos.map((m) => ({ valor: m, texto: m === 'simple' ? 'Simple' : m === 'doble' ? 'Doble' : 'Riñonera' }))}
        />
      )}
      <Interruptor activo={l.soloCorte} onCambio={(v) => config({ soloCorte: v })} texto="Solo corte (el cliente trae el equipo)" />
      {ops.llave && !l.soloCorte && <Interruptor activo={l.llave} onCambio={(v) => config({ llave: v })} texto="Con llave" />}
      <Segmentado
        etiqueta="Ubicación en su módulo"
        valor={l.posicion}
        onCambio={(v) => config({ posicion: v })}
        opciones={[
          { valor: 'izq', texto: 'Al borde izq.', titulo: 'Pegado al borde izquierdo de su módulo' },
          { valor: 'centro', texto: 'Centrado' },
          { valor: 'der', texto: 'Al borde der.', titulo: 'Pegado al borde derecho de su módulo' },
        ]}
      />
      {l.posicion !== 'centro' && (
        <CampoMedida
          etiqueta={`Margen al borde ${l.posicion === 'izq' ? 'izquierdo' : 'derecho'}`}
          compacto
          valor={l.margen}
          unidad={unidad}
          min={50}
          onCambio={(mm) => config({ margen: mm }, `margen-${l.id}`)}
        />
      )}
      {l.posicion !== 'centro' && <p className="tenue">Mínimo {formatear(50, unidad)}; en este módulo, hasta {formatear(Math.max(50, max), unidad)}.</p>}
    </>
  );
}

function EquipamientoCocina({ d, unidad }: { d: Diseno; unidad: Unidad }) {
  const ops = opcionesEquipo(d.plantilla);
  const items = useMemo(() => listarEquipamiento(d), [d]);
  const infantil = d.plantilla === 'cocina-infantil';
  const encimeras = d.equipos.filter((e): e is Encimera => e.tipo === 'encimera');
  const lavaplatos = d.equipos.filter((e): e is Lavaplatos => e.tipo === 'lavaplatos');
  const principales = items.filter((i) => i.tipo === 'encimera' || i.tipo === 'lavaplatos' || i.tipo === 'horno');
  const grupos = tramosOrdenados(d)
    .filter((t) => !esAereo(t))
    .map((t) => ({ t, items: principales.filter((i) => i.tramo === t) }))
    .filter((g) => g.items.length);
  const sinCampana = encimeras.find((e) => !e.campana);
  const sinLlave = lavaplatos.find((l) => !l.llave && !l.soloCorte);
  const verDistancias = useApp((s) => s.distancias);
  const distancias = useMemo(() => distanciasEquipos(d), [d]);
  const tramosDistancias = tramosOrdenados(d).filter((t) => distancias.some((x) => x.tramo === t));
  return (
    <div className="pestana-contenido">
      <div className="equipos-agregar" role="group" aria-label="Agregar equipamiento">
        <span className="campo-etiqueta">Agregar</span>
        {ops.platos.length > 0 && (
          <button type="button" className="boton secundario chico" onClick={() => operar({ op: 'agregarEquipo', equipo: 'encimera' })}>
            <IcoMas width={14} height={14} /> Encimera
          </button>
        )}
        {ops.lavaplatos.length > 0 && (
          <button type="button" className="boton secundario chico" onClick={() => operar({ op: 'agregarEquipo', equipo: 'lavaplatos' })}>
            <IcoMas width={14} height={14} /> Lavaplatos
          </button>
        )}
        {ops.horno && (
          <button type="button" className="boton secundario chico" onClick={() => operar({ op: 'agregarEquipo', equipo: 'horno' })}>
            <IcoMas width={14} height={14} /> Horno
          </button>
        )}
        {ops.campana && sinCampana && (
          <button type="button" className="boton secundario chico" onClick={() => operar({ op: 'agregarEquipo', equipo: 'campana', para: sinCampana.id })}>
            <IcoMas width={14} height={14} /> Campana
          </button>
        )}
        {ops.llave && sinLlave && (
          <button type="button" className="boton secundario chico" onClick={() => operar({ op: 'agregarEquipo', equipo: 'llave', para: sinLlave.id })}>
            <IcoMas width={14} height={14} /> Llave
          </button>
        )}
        {!principales.length && <span className="tenue">Sin equipamiento: agrégalo y elige después en qué módulo va.</span>}
      </div>
      <div className="lista-cuerpos equipos">
        {grupos.flatMap((g) => [
          ...(grupos.length > 1 || g.t !== 'base' ? [<SeparadorTramo key={`sep-${g.t}`} titulo={nombreTramo(d, g.t)} />] : []),
          ...g.items.map((it) => <TarjetaEquipo key={it.id} d={d} item={it} items={items} unidad={unidad} />),
        ])}
        {distancias.length > 0 && (
          <article className="tarjeta-cuerpo ancha">
            <header className="tarjeta-cuerpo-cabeza">
              <strong>Distancias entre equipos</strong>
            </header>
            <Interruptor activo={verDistancias} onCambio={(v) => useApp.getState().fijarVista({ distancias: v })} texto="Distancias" />
            <p className="tenue">Espacio libre de cubierta entre los cortes y hasta sus extremos{verDistancias ? '; se acotan en el 3D.' : '.'}</p>
            {tramosDistancias.map((t) => (
              <Fragment key={t}>
                {tramosDistancias.length > 1 || t !== 'base' ? <p className="campo-etiqueta">{nombreTramo(d, t)}</p> : null}
                <ul className="lista-distancias">
                  {distancias
                    .filter((x) => x.tramo === t)
                    .map((x, k) => (
                      <li key={k}>{textoDistancia(x, unidad)}</li>
                    ))}
                </ul>
              </Fragment>
            ))}
          </article>
        )}
        {(lavaplatos.some((l) => l.llave && !l.soloCorte) || (infantil && lavaplatos.some((l) => !l.soloCorte))) && (
          <article className="tarjeta-cuerpo ancha">
            <header className="tarjeta-cuerpo-cabeza">
              <strong>Grifería</strong>
            </header>
            <Segmentado
              valor={d.cocina.grifo}
              onCambio={(v) => operar({ op: 'fijarCocina', cambios: { grifo: v } })}
              opciones={[
                { valor: 'negro', texto: 'Negro mate' },
                { valor: 'cromado', texto: 'Cromado' },
              ]}
            />
          </article>
        )}
        {!infantil && (
          <article className="tarjeta-cuerpo ancha">
            <header className="tarjeta-cuerpo-cabeza">
              <strong>Cubierta postformada</strong>
            </header>
            <Segmentado
              etiqueta="Espesor"
              valor={String(d.cocina.espesorCubierta) as '28' | '30' | '38'}
              onCambio={(v) => operar({ op: 'fijarCocina', cambios: { espesorCubierta: Number(v) } })}
              opciones={[
                { valor: '28', texto: '28 mm' },
                { valor: '30', texto: '30 mm' },
                { valor: '38', texto: '38 mm' },
              ]}
            />
            <CampoMedida
              etiqueta="Vuelo frontal"
              compacto
              valor={d.cocina.vueloCubierta}
              unidad="mm"
              paso={5}
              min={0}
              max={60}
              onCambio={(mm) => operar({ op: 'fijarCocina', cambios: { vueloCubierta: mm } }, 'vuelo')}
            />
            <Interruptor activo={d.cocina.copete} onCambio={(v) => operar({ op: 'fijarCocina', cambios: { copete: v } })} texto="Copete trasero" />
          </article>
        )}
      </div>
    </div>
  );
}

export function PestanaEquipamiento({ d, unidad, cambiar }: PropsPestana) {
  if (d.plantilla === 'cocina' || d.plantilla === 'cocina-infantil' || d.plantilla === 'compacto') return <EquipamientoCocina d={d} unidad={unidad} />;

  if (d.plantilla === 'tocador') {
    const t = d.tocador;
    const set = (cambios: Partial<Diseno['tocador']>) => cambiar((x) => ({ ...x, tocador: { ...x.tocador, ...cambios } }));
    return (
      <div className="pestana-contenido">
        <div className="opciones-globales espacios">
          <Segmentado
            etiqueta="Espejo"
            valor={t.espejo}
            onCambio={(v) => set({ espejo: v })}
            opciones={[
              { valor: 'ovalado', texto: 'Ovalado LED' },
              { valor: 'hollywood', texto: 'Hollywood' },
              { valor: 'rectangular', texto: 'Rectangular LED' },
            ]}
          />
          <Segmentado
            etiqueta="Tono de luz"
            valor={t.luz}
            onCambio={(v) => set({ luz: v })}
            opciones={[
              { valor: 'calida', texto: 'Cálida' },
              { valor: 'neutra', texto: 'Neutra' },
              { valor: 'fria', texto: 'Fría' },
            ]}
          />
          <Interruptor activo={t.repisasLaterales} onCambio={(v) => set({ repisasLaterales: v })} texto="Repisas laterales" />
        </div>
      </div>
    );
  }

  if (d.plantilla === 'comoda') {
    return (
      <div className="pestana-contenido">
        <div className="opciones-globales espacios">
          <Interruptor activo={d.mudador} onCambio={(v) => cambiar((x) => ({ ...x, mudador: v }))} texto="Mudador para bebé sobre la cubierta" />
        </div>
      </div>
    );
  }

  // Clóset y escritorio: interior de cada cuerpo.
  return (
    <div className="pestana-contenido">
      <div className="lista-cuerpos">
        {d.cuerpos.map((c, i) =>
          c.tipo === 'frentes' ? (
            <article key={c.id} className="tarjeta-cuerpo">
              <CabeceraCuerpo d={d} i={i} c={c} tramo="base" unidad={unidad} />
              <Contador etiqueta="Repisas" valor={c.repisas} max={8} onCambio={(v) => operar({ op: 'actualizarModulo', tramo: 'base', modulo: c.id, cambios: { repisas: v } })} />
              <Interruptor
                activo={c.colgador}
                onCambio={(v) => operar({ op: 'actualizarModulo', tramo: 'base', modulo: c.id, cambios: { colgador: v } })}
                texto="Barra para colgar"
              />
              {c.colgador && <p className="tenue">Con barra se usa una repisa superior y el resto queda para colgar.</p>}
            </article>
          ) : (
            <article key={c.id} className="tarjeta-cuerpo apagada">
              <CabeceraCuerpo d={d} i={i} c={c} tramo="base" unidad={unidad} />
              <p className="tenue">{NOMBRE_TIPO[c.tipo]}</p>
            </article>
          ),
        )}
      </div>
      <p className="ayuda">Usa «Abrir puertas» en el visor para ver el interior.</p>
    </div>
  );
}
