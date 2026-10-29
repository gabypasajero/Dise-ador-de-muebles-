import { Html, Line } from '@react-three/drei';
import { useMemo, type ReactNode } from 'react';
import {
  aMundoAereoLado,
  aMundoLado,
  altoBaseInfantil,
  calcularLayout,
  calcularLayoutAereos,
  calcularLayoutAereosLado,
  disenoBase,
  disenoLado,
  esCocina,
  extremosPrincipal,
  LADOS,
  ladoAereoActivo,
  largoEje,
  transformAereoLado,
  transformLado,
  ubicarEquipos,
  type LayoutAereos,
  type Transformacion,
} from '../../shared/layout';
import { distanciasEquipos } from '../../shared/equipos';
import { formatear, nombreModuloEn } from '../../shared/reglas';
import type { CatalogoMateriales, Diseno, LadoId, TramoBase, TramoId, Unidad } from '../../shared/tipos';
import { Aereos3D } from './Aereos3D';
import { MaterialesProvider, Panel, useMats } from './base3d';
import { CampanaMural } from './Cocina3D';
import { MuebleCuerpos, type EquipoDibujo } from './MuebleCuerpos';
import { Tocador3D } from './Tocador3D';

export interface OpcionesVista {
  abierto: boolean;
  cotas: boolean;
  etiquetasFrentes: boolean;
  unidad: Unidad;
  /** Distancias libres entre los equipos de la cubierta (pestaña Equipamiento). */
  distancias?: boolean;
  /** Numera los módulos del tramo elegido y marca el activo (pestaña «Módulos y espacios»). */
  modulos?: { tramo: TramoId; activo: number; nombre: (i: number) => string; onElegir: (i: number) => void } | null;
}

/** Grupo con la ubicación de un tramo lateral (null: el tramo ya está en coordenadas del mueble). */
function EnTramo({ tr, children }: { tr: Transformacion | null; children: ReactNode }) {
  if (!tr) return <>{children}</>;
  return (
    <group position={[tr.x, 0, tr.z]} rotation={[0, tr.rotY, 0]}>
      {children}
    </group>
  );
}

/** Mueble completo en metros (internamente modelado en mm). */
export function Mueble3D({
  diseno,
  materiales,
  vista,
  respaldo = false,
  cubiertaIsla,
}: {
  diseno: Diseno;
  materiales: CatalogoMateriales | null;
  vista: OpcionesVista;
  /** Isla: el respaldo queda a la vista, terminado en la melamina de los frentes. */
  respaldo?: boolean;
  /** Isla con voladizo: cubierta grande (mm, en las coordenadas de este mueble) para sentarse alrededor. */
  cubiertaIsla?: { x0: number; x1: number; z0: number; z1: number };
}) {
  const props = { abierto: vista.abierto, etiquetas: vista.etiquetasFrentes, unidad: vista.unidad };
  const base = useMemo(() => disenoBase(diseno), [diseno]);
  // Dónde va cada equipo (encimeras, lavaplatos, hornos y campanas) en todos los tramos.
  const ubicados = useMemo(() => ubicarEquipos(diseno), [diseno]);
  const equiposDe = (t: TramoBase): EquipoDibujo[] =>
    ubicados.flatMap((u) => {
      if (u.tramo !== t || (u.tipo !== 'encimera' && u.tipo !== 'lavaplatos')) return [];
      const e = diseno.equipos?.find((x) => x.id === u.id);
      return e ? [{ u, e }] : [];
    });
  const campanas = ubicados.filter((u) => u.tipo === 'campana');
  // Lados de la L o la U (la imagen del cliente va solo en los frentes del tramo principal).
  const lados = useMemo(
    () =>
      LADOS.flatMap((lado) => {
        const dl = disenoLado(diseno, lado);
        const tr = transformLado(diseno, lado);
        return dl && tr ? [{ lado, d: { ...dl, imagenFrontal: null }, tr }] : [];
      }),
    [diseno],
  );
  // Aéreo principal y lados del aéreo, cada uno con su ubicación.
  const aereos = useMemo(() => {
    const out: { tramo: TramoId; la: LayoutAereos; tr: Transformacion | null }[] = [];
    if (!diseno.aereos.activo) return out;
    const la = calcularLayoutAereos(diseno);
    if (la) out.push({ tramo: 'aereos', la, tr: null });
    for (const lado of LADOS) {
      const ll = calcularLayoutAereosLado(diseno, lado);
      const tr = transformAereoLado(diseno, lado);
      if (ll && tr) out.push({ tramo: lado === 'izq' ? 'aereos-izq' : 'aereos-der', la: ll, tr });
    }
    return out;
  }, [diseno]);
  const extension: [number, number] = [diseno.lados?.izq?.profundidad ?? 0, diseno.lados?.der?.profundidad ?? 0];
  const trLado = (t: TramoBase) => (t === 'base' ? null : lados.find((x) => x.lado === t)?.tr ?? null);
  return (
    <MaterialesProvider diseno={diseno} catalogo={materiales}>
      <group scale={0.001} position={[0, 0, 0.004]}>
        {diseno.plantilla === 'tocador' ? (
          <Tocador3D diseno={diseno} {...props} />
        ) : (
          <>
            <MuebleCuerpos diseno={base} {...props} extensionCubierta={extension} equipos={equiposDe('base')} />
            {lados.map(({ lado, d, tr }) => (
              <EnTramo key={lado} tr={tr}>
                <MuebleCuerpos diseno={d} {...props} equipos={equiposDe(lado)} />
              </EnTramo>
            ))}
            {lados.map(({ lado }) => (
              <Esquina key={lado} d={base} lado={lado} />
            ))}
            {aereos.map(({ tramo, la, tr }) => (
              <EnTramo key={tramo} tr={tr}>
                <Aereos3D d={diseno} la={la} campanas={campanas.filter((u) => u.montaje === 'aereo' && u.tramo === tramo)} {...props} />
              </EnTramo>
            ))}
            {/* Campana mural: sobre la encimera cuando no hay aéreo encima, con chimenea hasta el cielo. */}
            {campanas
              .filter((u) => u.montaje === 'mural' && (u.tramo === 'base' || u.tramo === 'izq' || u.tramo === 'der'))
              .map((u) => (
                <EnTramo key={u.id} tr={trLado(u.tramo as TramoBase)}>
                  <CampanaMural x={u.x} y0={diseno.aereos.elevacion} ancho={u.ancho} fondo={u.fondo} />
                </EnTramo>
              ))}
          </>
        )}
        {respaldo && <Respaldo d={diseno} />}
        {cubiertaIsla && <CubiertaIsla d={diseno} r={cubiertaIsla} />}
        {vista.cotas && <Cotas diseno={diseno} unidad={vista.unidad} />}
        {vista.distancias && diseno.plantilla !== 'tocador' && <DistanciasEquipos diseno={diseno} unidad={vista.unidad} />}
        {vista.modulos && diseno.plantilla !== 'tocador' && <EtiquetasModulos diseno={diseno} unidad={vista.unidad} {...vista.modulos} />}
      </group>
    </MaterialesProvider>
  );
}

/** Cubierta grande de la isla: una sola pieza sobre todo el mueble que sobresale para sentarse. */
function CubiertaIsla({ d, r }: { d: Diseno; r: { x0: number; x1: number; z0: number; z1: number } }) {
  const m = useMats();
  const e = d.cocina.espesorCubierta;
  // Apenas sobre la cubierta normal, para que no se mezclen.
  return <Panel x0={r.x0} x1={r.x1} y0={d.alto - e + 0.5} y1={d.alto + 1} z0={r.z0} z1={r.z1} mat={m.cubierta} />;
}

/** Respaldo terminado de una isla: tapa toda la cara de atrás bajo la cubierta. */
function Respaldo({ d }: { d: Diseno }) {
  const m = useMats();
  const [x0, x1] = extremosPrincipal(d);
  const yTope = d.alto - (esCocina(d) ? d.cocina.espesorCubierta : 0);
  return <Panel x0={x0} x1={x1} y0={0} y1={yTope} z0={-d.espesor} z1={0} mat={m.frente} />;
}

/** Esquina de la L o la U: módulo ciego bajo la cubierta del tramo principal, tapado por el primer módulo del lado. */
function Esquina({ d, lado }: { d: Diseno; lado: LadoId }) {
  const m = useMats();
  const r = d.lados[lado];
  if (!r) return null;
  const l = calcularLayout(d);
  const t = d.espesor;
  const x0 = lado === 'der' ? d.ancho / 2 : -d.ancho / 2 - r.profundidad;
  const x1 = x0 + r.profundidad;
  const zF = l.zFrente;
  return (
    <group>
      <Panel x0={x0} x1={x1} y0={d.zocalo + 2} y1={l.yTope - d.luzFrentes / 2} z0={zF} z1={zF + l.espesorFrente} mat={m.frente} eje="x" />
      <Panel x0={x0} x1={x1} y0={d.zocalo} y1={d.zocalo + t} z0={0} z1={zF} mat={m.casco} />
      {d.zocalo > 0 && <Panel x0={x0} x1={x1} y0={0} y1={d.zocalo} z0={zF - 50 - t} z1={zF - 50} mat={m.casco} />}
      <Panel x0={lado === 'der' ? x1 - t : x0} x1={lado === 'der' ? x1 : x0 + t} y0={0} y1={l.yTope} z0={0} z1={zF} mat={m.casco} />
    </group>
  );
}

function Cota({
  desde,
  hasta,
  texto,
  normal,
}: {
  desde: [number, number, number];
  hasta: [number, number, number];
  texto: string;
  normal: [number, number, number];
}) {
  const tick = (p: [number, number, number]): [number, number, number][] => [
    [p[0] - normal[0] * 40, p[1] - normal[1] * 40, p[2] - normal[2] * 40],
    [p[0] + normal[0] * 40, p[1] + normal[1] * 40, p[2] + normal[2] * 40],
  ];
  const medio: [number, number, number] = [(desde[0] + hasta[0]) / 2, (desde[1] + hasta[1]) / 2, (desde[2] + hasta[2]) / 2];
  return (
    <group>
      <Line points={[desde, hasta]} color="#a8325e" lineWidth={2} />
      <Line points={tick(desde)} color="#a8325e" lineWidth={2} />
      <Line points={tick(hasta)} color="#a8325e" lineWidth={2} />
      {/* Sin transform, drei aplica `style` al div que recibe el clic: así no tapa los botones del visor. */}
      <Html position={medio} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
        <div className="cota-etiqueta">{texto}</div>
      </Html>
    </group>
  );
}

function Cotas({ diseno: d, unidad }: { diseno: Diseno; unidad: Unidad }) {
  const [x0, x1] = extremosPrincipal(d);
  const W = x1 - x0;
  const H = d.alto;
  const D = d.profundidad;
  const sep = 140;
  const izq = d.lados?.izq ?? null;
  const der = d.lados?.der ?? null;
  const conLados = !!(izq || der);
  const ref = (a: [number, number, number], b: [number, number, number], k: string) => (
    <Line key={k} points={[a, b]} color="#a8325e" lineWidth={1} dashed dashSize={20} gapSize={15} />
  );
  // Alto y fondo van en un extremo libre (sin muro): a la derecha, o a la izquierda si la L es derecha.
  // En la U los dos extremos tienen muro: el alto va en la punta del lado izquierdo y el fondo junto a la esquina derecha.
  let alto: JSX.Element[];
  if (!izq || !der) {
    const s = der ? -1 : 1;
    const xBorde = der ? x0 : x1;
    const xA = xBorde + s * sep;
    alto = [
      <Cota key="alto" desde={[xA, 0, D]} hasta={[xA, H, D]} normal={[1, 0, 0]} texto={`Alto ${formatear(H, unidad)}`} />,
      <Cota key="prof" desde={[xA, H + sep, 0]} hasta={[xA, H + sep, D]} normal={[1, 0, 0]} texto={`Prof. ${formatear(D, unidad)}`} />,
      ref([xBorde, 0, D], [xA + s * 40, 0, D], 'r-alto'),
      ref([xBorde, H, 0], [xA + s * 40, H + sep + 40, 0], 'r-prof'),
    ];
  } else {
    const xP = x0 + izq.profundidad / 2;
    const zP = izq.largo + sep;
    const xF = d.ancho / 2 - 60;
    alto = [
      <Cota key="alto" desde={[xP, 0, zP]} hasta={[xP, H, zP]} normal={[1, 0, 0]} texto={`Alto ${formatear(H, unidad)}`} />,
      ref([xP, 0, izq.largo], [xP, 0, zP + 40], 'r-alto'),
      <Cota key="prof" desde={[xF, H + sep, 0]} hasta={[xF, H + sep, D]} normal={[1, 0, 0]} texto={`Prof. ${formatear(D, unidad)}`} />,
    ];
  }
  const yr = H + sep * 2;
  return (
    // El nombre permite ocultarlas al capturar la miniatura de la cotización.
    <group name="cotas">
      <Cota desde={[x0, H + sep, D]} hasta={[x1, H + sep, D]} normal={[0, 1, 0]} texto={`${conLados ? 'Largo' : 'Ancho'} ${formatear(W, unidad)}`} />
      {ref([x0, H, D], [x0, H + sep + 40, D], 'r-x0')}
      {ref([x1, H, D], [x1, H + sep + 40, D], 'r-x1')}
      {alto}
      {/* Cada lado de la L o la U: su largo desde el muro principal (con la esquina), pegado a su muro lateral. */}
      {LADOS.map((lado) => {
        const r = d.lados?.[lado];
        if (!r) return null;
        const xr = lado === 'der' ? x1 - 20 : x0 + 20;
        return (
          <group key={lado}>
            <Cota desde={[xr, yr, 0]} hasta={[xr, yr, r.largo]} normal={[0, 1, 0]} texto={`Lado ${lado === 'izq' ? 'izq.' : 'der.'} ${formatear(r.largo, unidad)}`} />
            {ref([xr, H, r.largo], [xr, yr + 40, r.largo], `r-${lado}`)}
          </group>
        );
      })}
    </group>
  );
}

/** Espacios libres entre los cortes de la cubierta (y hasta sus extremos), acotados sobre ella. */
function DistanciasEquipos({ diseno: d, unidad }: { diseno: Diseno; unidad: Unidad }) {
  const distancias = useMemo(() => distanciasEquipos(d), [d]);
  if (!distancias.length) return null;
  const db = disenoBase(d);
  const yTop = (d.plantilla === 'cocina-infantil' ? altoBaseInfantil(d) : db.alto) + 6;
  return (
    // Mismo nombre que las cotas: se ocultan al capturar la imagen de la cotización.
    <group name="cotas">
      {(['base', 'izq', 'der'] as TramoBase[]).map((t) => {
        const ds = distancias.filter((x) => x.tramo === t);
        if (!ds.length) return null;
        const tr = t === 'base' ? null : transformLado(d, t);
        if (t !== 'base' && !tr) return null;
        const fondo = t === 'base' ? db.profundidad : (d.lados?.[t]?.profundidad ?? db.profundidad);
        const z = fondo - 45;
        const x = (s: number) => (t === 'base' ? -db.ancho / 2 + s : s - largoEje(db, t) / 2);
        return (
          <EnTramo key={t} tr={tr}>
            {ds.map((dd, k) =>
              dd.mm > 0 ? (
                <Cota key={k} desde={[x(dd.s0), yTop, z]} hasta={[x(dd.s1), yTop, z]} normal={[0, 0, 1]} texto={formatear(dd.mm, unidad)} />
              ) : null,
            )}
          </EnTramo>
        );
      })}
    </group>
  );
}

interface Marca {
  clave: string;
  indice: number;
  ancho: number;
  /** Posición de la etiqueta y contorno del módulo, en coordenadas del mueble (mm). */
  etiqueta: [number, number, number];
  contorno: [number, number, number][];
}

/** Etiquetas y contornos de los módulos de un tramo (principal, lados, aéreo y lados del aéreo). */
function marcasTramo(d: Diseno, tramo: TramoId): Marca[] {
  const lado: LadoId | null = tramo === 'izq' || tramo === 'aereos-izq' ? 'izq' : tramo === 'der' || tramo === 'aereos-der' ? 'der' : null;
  if (tramo === 'aereos' || tramo === 'aereos-izq' || tramo === 'aereos-der') {
    const la = lado ? calcularLayoutAereosLado(d, lado) : calcularLayoutAereos(d);
    if (!la || (lado && !ladoAereoActivo(d, lado))) return [];
    const z = la.profundidad + 4;
    const aMundo = (x: number, y: number, zz: number): [number, number, number] => {
      if (!lado) return [x, y, zz];
      const [wx, wz] = aMundoAereoLado(d, lado, x, zz);
      return [wx, y, wz];
    };
    return la.cuerpos.map((lc) => ({
      clave: lc.cuerpo.id,
      indice: lc.indice,
      ancho: lc.cuerpo.ancho,
      etiqueta: aMundo((lc.x0 + lc.x1) / 2, la.y0 + Math.min(110, (la.y1 - la.y0) / 2), z + 30),
      contorno: [
        aMundo(lc.x0 + 6, la.y0 + 6, z),
        aMundo(lc.x1 - 6, la.y0 + 6, z),
        aMundo(lc.x1 - 6, la.y1 - 6, z),
        aMundo(lc.x0 + 6, la.y1 - 6, z),
        aMundo(lc.x0 + 6, la.y0 + 6, z),
      ],
    }));
  }
  const dt = lado ? disenoLado(d, lado) : disenoBase(d);
  if (!dt) return [];
  const l = calcularLayout(dt);
  const z = dt.profundidad + 4;
  // Alto visible de cada módulo (casco más cubierta o techo).
  const tope = (yTope: number) => Math.min(dt.alto, yTope + (esCocina(dt) ? dt.cocina.espesorCubierta : dt.espesor));
  const aMundo = (x: number, y: number, zz: number): [number, number, number] => {
    if (!lado) return [x, y, zz];
    const [wx, wz] = aMundoLado(d, lado, x, zz);
    return [wx, y, wz];
  };
  return l.cuerpos.map((lc) => {
    const yt = tope(lc.yTope);
    return {
      clave: lc.cuerpo.id,
      indice: lc.indice,
      ancho: lc.cuerpo.ancho,
      // Sobre el frente, cerca del borde superior: no tapa las cotas de ancho y profundidad.
      etiqueta: aMundo((lc.x0 + lc.x1) / 2, Math.max(120, yt - 110), z + 30),
      contorno: [
        aMundo(lc.x0 + 6, 6, z),
        aMundo(lc.x1 - 6, 6, z),
        aMundo(lc.x1 - 6, yt - 6, z),
        aMundo(lc.x0 + 6, yt - 6, z),
        aMundo(lc.x0 + 6, 6, z),
      ],
    };
  });
}

function EtiquetasModulos({
  diseno: d,
  unidad,
  tramo,
  activo,
  nombre,
  onElegir,
}: {
  diseno: Diseno;
  unidad: Unidad;
  tramo: TramoId;
  activo: number;
  nombre: (i: number) => string;
  onElegir: (i: number) => void;
}) {
  const marcas = useMemo(() => marcasTramo(d, tramo), [d, tramo]);
  const ia = Math.max(0, Math.min(marcas.length - 1, activo));
  const elegida = marcas[ia];
  return (
    // Ayuda visual: se oculta al capturar la miniatura de la cotización.
    <group name="ayudas">
      {elegida && <Line points={elegida.contorno} color="#a8325e" lineWidth={3} dashed dashSize={40} gapSize={22} />}
      {marcas.map((mc) => {
        const n = nombreModuloEn(d, tramo, mc.indice);
        return (
          <Html key={mc.clave} position={mc.etiqueta} center zIndexRange={[31, 0]}>
            <button
              type="button"
              className={`etiqueta-modulo${mc.indice === ia ? ' activa' : ''}`}
              title={`${n.charAt(0).toUpperCase()}${n.slice(1)}: ${nombre(mc.indice)}, ${formatear(mc.ancho, unidad)}`}
              onClick={() => onElegir(mc.indice)}
            >
              {mc.indice + 1}
            </button>
          </Html>
        );
      })}
    </group>
  );
}
