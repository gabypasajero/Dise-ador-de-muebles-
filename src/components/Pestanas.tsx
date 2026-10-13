// Categorías de medidas del panel inferior: puertas, cajones, módulos y
// espacios, equipamiento/interior. Cambian según el tipo de mueble.
import { calcularLayout, calcularLayoutAereos, calcularLayoutTocador, disenoRetorno, type Frente } from '../../shared/layout';
import { Fragment, useEffect, useRef, useState } from 'react';
import {
  ANCHO_MIN_CUERPO,
  ANCHO_MIN_HUECO,
  LIMITES_AEREOS,
  LIMITES_RETORNO,
  activarAereos,
  actualizarCuerpo,
  agregarModulo,
  anchoDisponible,
  cuerposDe,
  fijarAereos,
  fijarAnchoAereos,
  fijarForma,
  fijarRetorno,
  fijarSeparacion,
  formatear,
  largoTramo,
  maximoTramo,
  moverCuerpo,
  nombreModulo,
  posicionMinima,
  presetsModulo,
  quitarCuerpo,
  type PresetModulo,
  type Tramo,
} from '../../shared/reglas';
import type { Cuerpo, Diseno, Plantilla, Unidad } from '../../shared/tipos';
import { useApp, type Pestana } from '../store/useApp';
import { CampoMedida, Contador, Interruptor, Segmentado, Selector } from './Controles';
import { IcoBasura, IcoDer, IcoIzq, IcoMas } from './Iconos';

type Cambiar = (f: (d: Diseno) => Diseno, grupo?: string) => void;

interface PropsPestana {
  d: Diseno;
  unidad: Unidad;
  cambiar: Cambiar;
}

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
};

function tiposPermitidos(p: Plantilla, tramo: Tramo = 'base'): Cuerpo['tipo'][] {
  if (tramo === 'aereos') return p === 'compacto' ? ['frentes', 'nicho'] : ['frentes', 'campana', 'nicho', 'hueco'];
  if (tramo === 'retorno') return ['frentes', 'hueco'];
  if (p === 'cocina') return ['frentes', 'horno', 'hueco'];
  if (p === 'cocina-infantil') return ['frentes', 'horno'];
  if (p === 'escritorio') return ['frentes', 'escritorio'];
  return ['frentes'];
}

/** Nombre de los módulos de cada tramo: «Módulo 2», «L 1», «Aéreo 3», «Superior 1». */
function prefijoTramo(d: Diseno, tramo: Tramo): string {
  if (tramo === 'retorno') return 'L';
  if (tramo === 'aereos') return d.plantilla === 'compacto' ? 'Superior' : 'Aéreo';
  return 'Módulo';
}

function tituloTramo(d: Diseno, tramo: Tramo): string {
  if (tramo === 'retorno') return 'Esquina en L';
  if (tramo === 'aereos') return d.plantilla === 'compacto' ? 'Mueble superior' : 'Aéreos';
  return d.plantilla === 'compacto' ? 'Mueble base' : 'Tramo principal';
}

function medida(f: Frente, unidad: Unidad) {
  return `${formatear(f.rect.x1 - f.rect.x0, unidad, false)} × ${formatear(f.rect.y1 - f.rect.y0, unidad)}`;
}

function CabeceraCuerpo({ d, i, c, tramo, unidad }: { d: Diseno; i: number; c: Cuerpo; tramo: Tramo; unidad: Unidad }) {
  return (
    <header className="tarjeta-cuerpo-cabeza">
      <span className={`numero-cuerpo${tramo !== 'base' ? ` ${tramo}` : ''}`}>{i + 1}</span>
      <strong>
        {prefijoTramo(d, tramo)} {i + 1}
      </strong>
      <span className="tenue">{formatear(c.ancho, unidad)}</span>
    </header>
  );
}

/** Tramos con módulos del mueble y sus frentes (para las pestañas Puertas y Cajones). */
function gruposDe(d: Diseno, conAereos: boolean): { tramo: Tramo; cuerpos: Cuerpo[]; frentes: Frente[] }[] {
  const grupos: { tramo: Tramo; cuerpos: Cuerpo[]; frentes: Frente[] }[] = [{ tramo: 'base', cuerpos: d.cuerpos, frentes: calcularLayout(d).frentes }];
  const dr = disenoRetorno(d);
  if (dr && d.retorno) grupos.push({ tramo: 'retorno', cuerpos: d.retorno.cuerpos, frentes: calcularLayout(dr).frentes });
  const la = conAereos ? calcularLayoutAereos(d) : null;
  if (la) grupos.push({ tramo: 'aereos', cuerpos: d.aereos.cuerpos, frentes: la.frentes });
  return grupos;
}

// ---------- Puertas ----------

export function PestanaPuertas({ d, unidad, cambiar }: PropsPestana) {
  const grupos = gruposDe(d, true);
  return (
    <div className="pestana-contenido">
      <div className="opciones-globales">
        <Segmentado
          etiqueta="Tirador"
          valor={d.tirador}
          onCambio={(v) => cambiar((x) => ({ ...x, tirador: v }))}
          opciones={[
            { valor: 'barra', texto: 'Barra' },
            { valor: 'boton', texto: 'Botón' },
            { valor: 'unero', texto: 'Perfil uñero' },
            { valor: 'sin', texto: 'Sin tirador' },
          ]}
        />
        <p className="ayuda">Las medidas de cada puerta aparecen sobre el modelo 3D. Haz clic en una puerta para abrirla.</p>
      </div>
      <div className="lista-cuerpos">
        {grupos.flatMap((g) => [
          ...(grupos.length > 1 ? [<SeparadorTramo key={`sep-${g.tramo}`} titulo={tituloTramo(d, g.tramo)} />] : []),
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
            return (
              <article key={c.id} className="tarjeta-cuerpo">
                <CabeceraCuerpo d={d} i={i} c={c} tramo={g.tramo} unidad={unidad} />
                {g.tramo === 'aereos' && c.tipo === 'frentes' && (
                  <Interruptor activo={!!c.abatible} onCambio={(v) => cambiar((x) => actualizarCuerpo(x, i, { abatible: v, puertas: 1 }, g.tramo))} texto="Puerta abatible (se abre hacia arriba)" />
                )}
                {!fija && !c.abatible && (
                  <Contador etiqueta="Puertas" valor={c.puertas} max={4} onCambio={(v) => cambiar((x) => actualizarCuerpo(x, i, { puertas: v }, g.tramo))} />
                )}
                {fija && <p className="tenue">Puerta abatible sobre el nicho.</p>}
                {c.puertas === 1 && !c.abatible && !fija && (
                  <Segmentado
                    etiqueta="Bisagra"
                    valor={c.bisagra}
                    onCambio={(v) => cambiar((x) => actualizarCuerpo(x, i, { bisagra: v }, g.tramo))}
                    opciones={[
                      { valor: 'izq', texto: 'Izquierda' },
                      { valor: 'der', texto: 'Derecha' },
                    ]}
                  />
                )}
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

function SeparadorTramo({ titulo }: { titulo: string }) {
  return (
    <div className="separador-tramo" role="heading" aria-level={3}>
      {titulo}
    </div>
  );
}

// ---------- Cajones ----------

export function PestanaCajones({ d, unidad, cambiar }: PropsPestana) {
  if (d.plantilla === 'tocador') return <CajonesTocador d={d} unidad={unidad} cambiar={cambiar} />;
  const grupos = gruposDe(d, false);
  const fila = grupos[0].frentes.filter((f) => f.tipo === 'cajon' && f.cuerpo === -1);
  return (
    <div className="pestana-contenido">
      {d.plantilla === 'comoda' && (
        <div className="opciones-globales">
          <Contador
            etiqueta="Cajones pequeños en fila superior"
            valor={d.filaSuperior}
            max={4}
            onCambio={(v) => cambiar((x) => ({ ...x, filaSuperior: v }))}
          />
          {fila.length > 0 && <p className="ayuda">Cada uno mide {medida(fila[0], unidad)}.</p>}
        </div>
      )}
      <div className="lista-cuerpos">
        {grupos.flatMap((g) => [
          ...(grupos.length > 1 ? [<SeparadorTramo key={`sep-${g.tramo}`} titulo={tituloTramo(d, g.tramo)} />] : []),
          ...g.cuerpos.map((c, i) => {
            if (c.tipo !== 'frentes')
              return (
                <article key={c.id} className="tarjeta-cuerpo apagada">
                  <CabeceraCuerpo d={d} i={i} c={c} tramo={g.tramo} unidad={unidad} />
                  <p className="tenue">{NOMBRE_TIPO[c.tipo]}: sin cajones.</p>
                </article>
              );
            const cajones = g.frentes.filter((f) => f.tipo === 'cajon' && f.cuerpo === i);
            const act = (cambios: Partial<Cuerpo>) => cambiar((x) => actualizarCuerpo(x, i, cambios, g.tramo));
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
                      onCambio={(v) => act({ altoCajon: v === 'fijo' ? 180 : 0 })}
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
                        max={600}
                        onCambio={(mm) => cambiar((x) => actualizarCuerpo(x, i, { altoCajon: mm }, g.tramo), `alto-cajon-${g.tramo}-${i}`)}
                      />
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

/** Agrega un módulo avisando si no cabe o si queda más angosto. Devuelve la posición en que quedó. */
function agregarConAviso(d: Diseno, preset: PresetModulo, posicion: number, cambiar: Cambiar, unidad: Unidad, tramo: Tramo = 'base'): number | null {
  const { avisar } = useApp.getState();
  const maximo = formatear(tramo === 'retorno' ? LIMITES_RETORNO.largo[1] : maximoTramo(d, tramo), unidad);
  const ancho = anchoDisponible(d, preset.tipo, preset.ancho, preset.anchoMinimo, tramo);
  if (ancho == null) {
    const necesita = preset.anchoMinimo ? ` de ${formatear(preset.anchoMinimo, unidad)}` : '';
    const donde =
      tramo === 'retorno' ? `el largo máximo de la L es ${maximo}` : tramo === 'aereos' && d.plantilla === 'compacto' ? 'el mueble superior ya está lleno' : `el ancho máximo es ${maximo}`;
    avisar(`No cabe «${preset.texto}»${necesita}: ${donde}. Achica un módulo o el largo total.`, 'error');
    return null;
  }
  const i = Math.max(posicionMinima(d, tramo), Math.min(cuerposDe(d, tramo).length, posicion));
  cambiar((x) => agregarModulo(x, preset, i, tramo));
  if (ancho < preset.ancho) {
    const motivo = tramo === 'aereos' && d.plantilla === 'compacto' ? 'los demás superiores se achicaron para hacerle espacio' : `es lo que quedaba hasta el máximo de ${maximo}`;
    avisar(`Se agregó «${preset.texto}» con ${formatear(ancho, unidad)}: ${motivo}.`, 'info');
  }
  return i;
}

/** Dónde se ajusta el resto del módulo, según las pestañas que tiene este mueble. */
function ayudaModulo(d: Diseno, c: Cuerpo, tramo: Tramo): string {
  if (c.tipo === 'hueco') return tramo === 'aereos' ? 'Sin mueble: queda libre para una ventana o un extractor.' : 'Hueco libre para refrigerador, lavadora u otro equipo. La cubierta pasa por encima.';
  if (c.tipo === 'horno') return d.plantilla === 'cocina-infantil' ? 'Horno de juguete con puerta con ventana.' : 'Horno empotrado de 60 cm con faja de melamina superior.';
  if (c.tipo === 'escritorio') return 'Cubierta de trabajo: ajusta aquí su ancho y su alto.';
  if (c.tipo === 'campana') return 'Mueble más bajo con puertas: abajo queda la campana.';
  if (c.tipo === 'nicho') return 'Puerta abatible arriba y nicho abierto con repisa para el microondas.';
  const pestanas = pestanasDe(d.plantilla).filter(
    (p) => (p.id === 'puertas' || (p.id === 'cajones' && tramo !== 'aereos') || (p.id === 'equipamiento' && p.texto === 'Interior' && tramo === 'base')),
  );
  if (!pestanas.length) return '';
  const y = (xs: string[]) => (xs.length === 1 ? xs[0] : `${xs.slice(0, -1).join(', ')} y ${xs.at(-1)}`);
  const que = y(pestanas.map((p) => p.texto.toLowerCase()));
  return `Sus ${que} se ajustan en ${pestanas.length === 1 ? 'la pestaña' : 'las pestañas'} ${y(pestanas.map((p) => p.texto))}.`;
}

function nombreTipo(t: Cuerpo['tipo'], p: Plantilla): string {
  return t === 'horno' && p === 'cocina-infantil' ? 'Horno de juguete' : NOMBRE_TIPO[t];
}

/** Tramos que existen en el diseño (el retorno solo con forma L, los aéreos si están activos). */
function tramosDe(d: Diseno): Tramo[] {
  const out: Tramo[] = ['base'];
  if (d.retorno) out.push('retorno');
  if (d.aereos.activo) out.push('aereos');
  return out;
}

export function PestanaModulos({ d, unidad, cambiar }: PropsPestana) {
  const guardado = useApp((s) => s.moduloActivo);
  const tramoGuardado = useApp((s) => s.tramoActivo);
  const set = useApp((s) => s.set);
  const [insertarEn, setInsertarEn] = useState<number | null>(null);
  const tramos = tramosDe(d);
  const tramo: Tramo = tramos.includes(tramoGuardado) ? tramoGuardado : 'base';
  const cuerpos = cuerposDe(d, tramo);
  const n = cuerpos.length;
  const activo = Math.max(0, Math.min(n - 1, guardado));
  const tira = useRef<HTMLDivElement>(null);
  const panelInsertar = useRef<HTMLDivElement>(null);
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

  const tipos = tiposPermitidos(d.plantilla, tramo);
  const presets = presetsModulo(d.plantilla, tramo);
  const c = cuerpos[activo];
  const minPos = posicionMinima(d, tramo);
  const insertar = insertarEn != null && insertarEn >= minPos && insertarEn <= n ? insertarEn : null;
  const prefijo = prefijoTramo(d, tramo);
  const largo = tramo === 'retorno' && d.retorno ? d.retorno.largo : largoTramo(d, tramo);
  const cocinaAdulta = d.plantilla === 'cocina' || d.plantilla === 'compacto';

  const agregar = (preset: PresetModulo, posicion: number) => {
    setInsertarEn(null);
    const i = agregarConAviso(d, preset, posicion, cambiar, unidad, tramo);
    if (i != null) set({ moduloActivo: i });
  };
  const elegir = (i: number) => {
    setInsertarEn(null);
    set({ moduloActivo: i });
  };
  const elegirTramo = (t: Tramo) => set({ tramoActivo: t, moduloActivo: 0 });
  const act = (cambios: Partial<Cuerpo>, grupo?: string) => cambiar((x) => actualizarCuerpo(x, activo, cambios, tramo), grupo);

  return (
    <div className="pestana-contenido modulos">
      {cocinaAdulta && (
        <div className="modulos-forma">
          {d.plantilla === 'cocina' && (
            <>
              <Segmentado
                etiqueta="Forma"
                valor={d.retorno ? d.retorno.lado : 'lineal'}
                onCambio={(v) => {
                  cambiar((x) => fijarForma(x, v === 'lineal' ? null : v));
                  set({ tramoActivo: v === 'lineal' ? 'base' : 'retorno', moduloActivo: 0 });
                }}
                opciones={[
                  { valor: 'lineal', texto: 'Lineal' },
                  { valor: 'izq', texto: 'L izquierda' },
                  { valor: 'der', texto: 'L derecha' },
                ]}
              />
              <Interruptor
                activo={d.aereos.activo}
                onCambio={(v) => {
                  cambiar((x) => activarAereos(x, v));
                  set({ tramoActivo: v ? 'aereos' : 'base', moduloActivo: 0 });
                }}
                texto="Muebles aéreos"
              />
            </>
          )}
          {tramos.length > 1 && (
            <div className="selector-tramo" role="tablist" aria-label="Tramo que editas">
              {tramos.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={t === tramo} className={t === tramo ? 'activo' : ''} onClick={() => elegirTramo(t)}>
                  {tituloTramo(d, t)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="modulos-cabeza">
        <strong>
          {tramos.length > 1 ? tituloTramo(d, tramo) : 'Distribución'} · {n} {n === 1 ? 'módulo' : 'módulos'} · {formatear(largo, unidad)}
        </strong>
        <div className="modulos-agregar" role="group" aria-label="Agregar al final">
          {presets.map((p) => (
            <button key={p.id} type="button" className="boton secundario chico" title={`${p.ayuda}. Se agrega a la derecha.`} onClick={() => agregar(p, n)}>
              <IcoMas width={14} height={14} /> {p.texto}
            </button>
          ))}
        </div>
      </div>

      <div className={`tira-modulos ${tramo}`} ref={tira} role="group" aria-label={`${tituloTramo(d, tramo)}: módulos de izquierda a derecha`}>
        {cuerpos.map((m, i) => (
          <Fragment key={m.id}>
            {i >= minPos && <BotonInsertar posicion={i} abierto={insertar === i} onClick={() => setInsertarEn(insertar === i ? null : i)} />}
            <button
              type="button"
              className={`bloque-modulo ${m.tipo}${i === activo ? ' activo' : ''}`}
              style={{ flexGrow: m.ancho }}
              aria-pressed={i === activo}
              aria-label={`${prefijo} ${i + 1}: ${nombreModulo(m)}, ${formatear(m.ancho, unidad)}`}
              onClick={() => elegir(i)}
            >
              <span className={`numero-cuerpo${tramo !== 'base' ? ` ${tramo}` : ''}`}>{i + 1}</span>
              <span className="bloque-modulo-texto">
                <span className="bloque-modulo-nombre">{nombreModulo(m)}</span>
                <span className="bloque-modulo-ancho">{formatear(m.ancho, unidad)}</span>
              </span>
            </button>
          </Fragment>
        ))}
        <BotonInsertar posicion={n} abierto={insertar === n} onClick={() => setInsertarEn(insertar === n ? null : n)} />
      </div>

      {insertar != null ? (
        <div className="modulos-insertar" ref={panelInsertar}>
          <span>
            {insertar === 0
              ? 'Agregar al comienzo (izquierda):'
              : insertar === n
                ? 'Agregar al final (derecha):'
                : `Agregar entre ${prefijo.toLowerCase() === 'módulo' ? 'el módulo' : `el ${prefijo}`} ${insertar} y el ${insertar + 1}:`}
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
      ) : c ? (
        <div className={`modulo-editor${c.tipo === 'hueco' ? ' hueco' : ''}`}>
          <div className="modulo-editor-cabeza">
            <span className={`numero-cuerpo${tramo !== 'base' ? ` ${tramo}` : ''}`}>{activo + 1}</span>
            <strong>
              {prefijo} {activo + 1}
            </strong>
            <span className="acciones-cuerpo">
              <button
                type="button"
                className="boton-icono"
                aria-label="Mover a la izquierda"
                title="Mover a la izquierda"
                disabled={activo - 1 < minPos}
                onClick={() => {
                  cambiar((x) => moverCuerpo(x, activo, -1, tramo));
                  set({ moduloActivo: activo - 1 });
                }}
              >
                <IcoIzq width={15} height={15} />
              </button>
              <button
                type="button"
                className="boton-icono"
                aria-label="Mover a la derecha"
                title="Mover a la derecha"
                disabled={activo === n - 1 || activo < minPos}
                onClick={() => {
                  cambiar((x) => moverCuerpo(x, activo, 1, tramo));
                  set({ moduloActivo: activo + 1 });
                }}
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
                  cambiar((x) => quitarCuerpo(x, activo, tramo));
                  set({ moduloActivo: Math.max(0, activo - 1) });
                }}
              >
                <IcoBasura width={15} height={15} />
              </button>
            </span>
          </div>
          {tipos.length > 1 && (
            <Selector
              etiqueta="Tipo"
              valor={c.tipo}
              opciones={tipos.map((t) => ({ valor: t, texto: nombreTipo(t, d.plantilla) }))}
              onCambio={(v) =>
                act({
                  tipo: v,
                  ...(v === 'frentes' ? { puertas: Math.max(1, c.puertas), abatible: false } : {}),
                  ...(v === 'campana' ? { puertas: 2, abatible: false } : {}),
                  ...(v === 'nicho' ? { puertas: 1, abatible: true } : {}),
                  ...(v === 'escritorio' ? { alto: 750 } : { alto: 0 }),
                })
              }
            />
          )}
          <CampoMedida
            etiqueta="Ancho del módulo"
            compacto
            valor={c.ancho}
            unidad={unidad}
            min={c.tipo === 'hueco' ? ANCHO_MIN_HUECO : ANCHO_MIN_CUERPO}
            max={1500}
            onCambio={(mm) => act({ ancho: mm }, `ancho-cuerpo-${c.id}`)}
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
          {tramo !== 'base' && (c.tipo === 'frentes' || c.tipo === 'campana') && !c.abatible && (
            <Contador etiqueta="Puertas" valor={c.puertas} max={4} onCambio={(v) => act({ puertas: v })} />
          )}
          {tramo === 'retorno' && c.tipo === 'frentes' && <Contador etiqueta="Cajones" valor={c.cajones} max={8} onCambio={(v) => act({ cajones: v })} />}
          {tramo === 'aereos' && c.tipo === 'frentes' && (
            <Interruptor activo={!!c.abatible} onCambio={(v) => act({ abatible: v, puertas: 1 })} texto="Abatible" />
          )}
          <p className="tenue">{ayudaModulo(d, c, tramo)}</p>
        </div>
      ) : null}

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
            onCambio={(mm) => cambiar((x) => fijarSeparacion(x, mm), 'separacion')}
          />
          <CampoMedida
            etiqueta="Zócalo"
            compacto
            valor={d.zocalo}
            unidad={unidad}
            paso={unidad === 'cm' ? 5 : 1}
            min={0}
            max={200}
            onCambio={(mm) => cambiar((x) => ({ ...x, zocalo: mm }), 'zocalo')}
          />
          <CampoMedida
            etiqueta="Luz entre frentes"
            compacto
            valor={d.luzFrentes}
            unidad="mm"
            paso={1}
            min={1}
            max={10}
            onCambio={(mm) => cambiar((x) => ({ ...x, luzFrentes: mm }), 'luz')}
          />
          <Segmentado
            etiqueta="Espesor melamina"
            valor={String(d.espesor) as '15' | '18'}
            onCambio={(v) => cambiar((x) => ({ ...x, espesor: v === '18' ? 18 : 15 }))}
            opciones={[
              { valor: '15', texto: '15 mm' },
              { valor: '18', texto: '18 mm' },
            ]}
          />
        </div>
      )}
      {tramo === 'retorno' && d.retorno && (
        <div className="opciones-globales espacios">
          <CampoMedida
            etiqueta="Largo de la L (desde el muro)"
            compacto
            valor={d.retorno.largo}
            unidad={unidad}
            min={Math.max(LIMITES_RETORNO.largo[0], d.profundidad + 150)}
            max={LIMITES_RETORNO.largo[1]}
            onCambio={(mm) => cambiar((x) => fijarRetorno(x, { largo: mm }), 'largo-l')}
          />
          <CampoMedida
            etiqueta="Fondo de la L"
            compacto
            valor={d.retorno.profundidad}
            unidad={unidad}
            min={LIMITES_RETORNO.profundidad[0]}
            max={LIMITES_RETORNO.profundidad[1]}
            onCambio={(mm) => cambiar((x) => fijarRetorno(x, { profundidad: mm }), 'fondo-l')}
          />
          <p className="ayuda">
            Largo total del tramo principal con la esquina: {formatear(d.ancho + d.retorno.profundidad, unidad)}.
          </p>
        </div>
      )}
      {tramo === 'aereos' && (
        <div className="opciones-globales espacios">
          {d.plantilla === 'compacto' ? (
            <CampoMedida
              etiqueta="Alto del mueble base"
              compacto
              valor={d.aereos.elevacion}
              unidad={unidad}
              min={LIMITES_AEREOS.base[0]}
              max={LIMITES_AEREOS.base[1]}
              onCambio={(mm) => cambiar((x) => fijarAereos(x, { elevacion: mm }), 'base-compacto')}
            />
          ) : (
            <CampoMedida
              etiqueta="Altura desde el piso"
              compacto
              valor={d.aereos.elevacion}
              unidad={unidad}
              min={LIMITES_AEREOS.elevacion[0]}
              max={LIMITES_AEREOS.elevacion[1]}
              onCambio={(mm) => cambiar((x) => fijarAereos(x, { elevacion: mm }), 'elevacion')}
            />
          )}
          <CampoMedida
            etiqueta={d.plantilla === 'compacto' ? 'Alto del mueble superior' : 'Alto de los aéreos'}
            compacto
            valor={d.aereos.alto}
            unidad={unidad}
            min={LIMITES_AEREOS.alto[0]}
            max={d.plantilla === 'compacto' ? d.alto - d.aereos.elevacion - 300 : LIMITES_AEREOS.alto[1]}
            onCambio={(mm) => cambiar((x) => fijarAereos(x, { alto: mm }), 'alto-aereos')}
          />
          <CampoMedida
            etiqueta="Fondo"
            compacto
            valor={d.aereos.profundidad}
            unidad={unidad}
            min={LIMITES_AEREOS.profundidad[0]}
            max={d.plantilla === 'compacto' ? Math.min(LIMITES_AEREOS.profundidad[1], d.profundidad) : LIMITES_AEREOS.profundidad[1]}
            onCambio={(mm) => cambiar((x) => fijarAereos(x, { profundidad: mm }), 'fondo-aereos')}
          />
          {d.plantilla !== 'compacto' && (
            <>
              <CampoMedida
                etiqueta="Largo de los aéreos"
                compacto
                valor={largoTramo(d, 'aereos')}
                unidad={unidad}
                min={LIMITES_AEREOS.ancho[0]}
                max={LIMITES_AEREOS.ancho[1]}
                onCambio={(mm) => cambiar((x) => fijarAnchoAereos(x, mm), 'largo-aereos')}
              />
              <Segmentado
                etiqueta="Alineación"
                valor={d.aereos.alineacion}
                onCambio={(v) => cambiar((x) => fijarAereos(x, { alineacion: v }))}
                opciones={[
                  { valor: 'izq', texto: 'Izquierda' },
                  { valor: 'centro', texto: 'Centro' },
                  { valor: 'der', texto: 'Derecha' },
                ]}
              />
            </>
          )}
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
          onCambio={(mm) => cambiar((x) => ({ ...x, luzFrentes: mm }), 'luz')}
        />
        <Segmentado
          etiqueta="Espesor melamina"
          valor={String(d.espesor) as '15' | '18'}
          onCambio={(v) => cambiar((x) => ({ ...x, espesor: v === '18' ? 18 : 15 }))}
          opciones={[
            { valor: '15', texto: '15 mm' },
            { valor: '18', texto: '18 mm' },
          ]}
        />
        <Segmentado
          etiqueta="Tirador"
          valor={d.tirador}
          onCambio={(v) => cambiar((x) => ({ ...x, tirador: v }))}
          opciones={[
            { valor: 'boton', texto: 'Botón' },
            { valor: 'barra', texto: 'Barra' },
            { valor: 'unero', texto: 'Uñero' },
            { valor: 'sin', texto: 'Sin' },
          ]}
        />
      </div>
    </div>
  );
}

// ---------- Equipamiento / interior / extras ----------

export function PestanaEquipamiento({ d, unidad, cambiar }: PropsPestana) {
  const opcionesCuerpos = d.cuerpos.map((c, i) => ({ valor: i, texto: `Módulo ${i + 1} · ${formatear(c.ancho, unidad)}` }));
  if (d.plantilla === 'cocina' || d.plantilla === 'cocina-infantil' || d.plantilla === 'compacto') {
    const k = d.cocina;
    const set = (cambios: Partial<Diseno['cocina']>) => cambiar((x) => ({ ...x, cocina: { ...x.cocina, ...cambios } }));
    const infantil = d.plantilla === 'cocina-infantil';
    return (
      <div className="pestana-contenido">
        <div className="lista-cuerpos">
          <article className="tarjeta-cuerpo ancha">
            <header className="tarjeta-cuerpo-cabeza">
              <strong>Encimera a gas</strong>
            </header>
            <Segmentado
              valor={k.encimera}
              onCambio={(v) => set({ encimera: v })}
              opciones={[
                { valor: 'ninguna', texto: 'Sin' },
                { valor: '2', texto: '2 platos' },
                { valor: '3', texto: '3 platos' },
                { valor: '4', texto: '4 platos' },
              ]}
            />
            {k.encimera !== 'ninguna' && <Selector etiqueta="Sobre el" valor={k.encimeraCuerpo} opciones={opcionesCuerpos} onCambio={(v) => set({ encimeraCuerpo: v })} />}
          </article>
          <article className="tarjeta-cuerpo ancha">
            <header className="tarjeta-cuerpo-cabeza">
              <strong>Lavaplatos</strong>
            </header>
            <Segmentado
              valor={k.lavaplatos}
              onCambio={(v) => set({ lavaplatos: v })}
              opciones={
                infantil
                  ? [
                      { valor: 'ninguno', texto: 'Sin' },
                      { valor: 'simple', texto: 'Con lavaplatos' },
                    ]
                  : [
                      { valor: 'ninguno', texto: 'Sin' },
                      { valor: 'simple', texto: '1 cubeta' },
                      { valor: 'doble', texto: '2 cubetas' },
                    ]
              }
            />
            {k.lavaplatos !== 'ninguno' && (
              <>
                <Selector etiqueta="Sobre el" valor={k.lavaplatosCuerpo} opciones={opcionesCuerpos} onCambio={(v) => set({ lavaplatosCuerpo: v })} />
                <Segmentado
                  etiqueta="Grifería"
                  valor={k.grifo}
                  onCambio={(v) => set({ grifo: v })}
                  opciones={[
                    { valor: 'negro', texto: 'Negro mate' },
                    { valor: 'cromado', texto: 'Cromado' },
                  ]}
                />
              </>
            )}
          </article>
          {!infantil && (
            <article className="tarjeta-cuerpo ancha">
              <header className="tarjeta-cuerpo-cabeza">
                <strong>Cubierta postformada</strong>
              </header>
              <Segmentado
                etiqueta="Espesor"
                valor={String(k.espesorCubierta) as '28' | '30' | '38'}
                onCambio={(v) => set({ espesorCubierta: Number(v) })}
                opciones={[
                  { valor: '28', texto: '28 mm' },
                  { valor: '30', texto: '30 mm' },
                  { valor: '38', texto: '38 mm' },
                ]}
              />
              <CampoMedida
                etiqueta="Vuelo frontal"
                compacto
                valor={k.vueloCubierta}
                unidad="mm"
                paso={5}
                min={0}
                max={60}
                onCambio={(mm) => set({ vueloCubierta: mm })}
              />
              <Interruptor activo={k.copete} onCambio={(v) => set({ copete: v })} texto="Copete trasero" />
            </article>
          )}
          {d.plantilla === 'cocina' && (
            <article className="tarjeta-cuerpo ancha">
              <header className="tarjeta-cuerpo-cabeza">
                <strong>Horno empotrado</strong>
              </header>
              <p className="tenue">
                {d.cuerpos.some((c) => c.tipo === 'horno')
                  ? 'Tu mueble lleva horno. Puedes moverlo o quitarlo en Módulos y espacios.'
                  : 'Agrega un módulo de 60 cm preparado para horno empotrado.'}
              </p>
              {!d.cuerpos.some((c) => c.tipo === 'horno') && (
                <button
                  type="button"
                  className="boton secundario chico"
                  onClick={() => {
                    const horno = presetsModulo('cocina').find((p) => p.id === 'horno')!;
                    agregarConAviso(d, horno, d.cuerpos.length, cambiar, unidad);
                  }}
                >
                  <IcoMas width={14} height={14} /> Agregar horno
                </button>
              )}
            </article>
          )}
        </div>
      </div>
    );
  }

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
              <Contador etiqueta="Repisas" valor={c.repisas} max={8} onCambio={(v) => cambiar((x) => actualizarCuerpo(x, i, { repisas: v }))} />
              <Interruptor activo={c.colgador} onCambio={(v) => cambiar((x) => actualizarCuerpo(x, i, { colgador: v }))} texto="Barra para colgar" />
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
