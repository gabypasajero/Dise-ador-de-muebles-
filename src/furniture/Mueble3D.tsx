import { Html, Line } from '@react-three/drei';
import { useMemo } from 'react';
import {
  aMundoRetorno,
  calcularLayout,
  calcularLayoutAereos,
  disenoBase,
  disenoRetorno,
  esCocina,
  extremosPrincipal,
  transformRetorno,
} from '../../shared/layout';
import { formatear, type Tramo } from '../../shared/reglas';
import type { CatalogoMateriales, Diseno, Unidad } from '../../shared/tipos';
import { Aereos3D } from './Aereos3D';
import { MaterialesProvider, Panel, useMats } from './base3d';
import { materialFrente } from './Frentes';
import { MuebleCuerpos } from './MuebleCuerpos';
import { Tocador3D } from './Tocador3D';

export interface OpcionesVista {
  abierto: boolean;
  cotas: boolean;
  etiquetasFrentes: boolean;
  unidad: Unidad;
  /** Numera los módulos del tramo elegido y marca el activo (pestaña «Módulos y espacios»). */
  modulos?: { tramo: Tramo; activo: number; nombre: (i: number) => string; onElegir: (i: number) => void } | null;
}

/** Mueble completo en metros (internamente modelado en mm). */
export function Mueble3D({ diseno, materiales, vista }: { diseno: Diseno; materiales: CatalogoMateriales | null; vista: OpcionesVista }) {
  const props = { abierto: vista.abierto, etiquetas: vista.etiquetasFrentes, unidad: vista.unidad };
  const base = useMemo(() => disenoBase(diseno), [diseno]);
  const dr = useMemo(() => disenoRetorno(diseno), [diseno]);
  const tr = transformRetorno(diseno);
  const r = diseno.retorno;
  const extension: [number, number] = r ? (r.lado === 'izq' ? [r.profundidad, 0] : [0, r.profundidad]) : [0, 0];
  return (
    <MaterialesProvider diseno={diseno} catalogo={materiales}>
      <group scale={0.001} position={[0, 0, 0.004]}>
        {diseno.plantilla === 'tocador' ? (
          <Tocador3D diseno={diseno} {...props} />
        ) : (
          <>
            <MuebleCuerpos diseno={base} {...props} extensionCubierta={extension} />
            {dr && tr && (
              <group position={[tr.x, 0, tr.z]} rotation={[0, tr.rotY, 0]}>
                <MuebleCuerpos diseno={dr} {...props} />
              </group>
            )}
            {r && <EsquinaL d={base} />}
            {diseno.aereos.activo && <Aereos3D d={diseno} {...props} />}
          </>
        )}
        {vista.cotas && <Cotas diseno={diseno} unidad={vista.unidad} />}
        {vista.modulos && diseno.plantilla !== 'tocador' && <EtiquetasModulos diseno={diseno} unidad={vista.unidad} {...vista.modulos} />}
      </group>
    </MaterialesProvider>
  );
}

/** Esquina de la cocina en L: módulo ciego bajo la cubierta, tapado por el primer módulo del retorno. */
function EsquinaL({ d }: { d: Diseno }) {
  const m = useMats();
  const r = d.retorno!;
  const l = calcularLayout(d);
  const t = d.espesor;
  const x0 = r.lado === 'der' ? d.ancho / 2 : -d.ancho / 2 - r.profundidad;
  const x1 = x0 + r.profundidad;
  const zF = l.zFrente;
  return (
    <group>
      <Panel x0={x0} x1={x1} y0={d.zocalo + 2} y1={l.yTope - d.luzFrentes / 2} z0={zF} z1={zF + l.espesorFrente} mat={materialFrente(m)} eje="x" />
      <Panel x0={x0} x1={x1} y0={d.zocalo} y1={d.zocalo + t} z0={0} z1={zF} mat={m.casco} />
      {d.zocalo > 0 && <Panel x0={x0} x1={x1} y0={0} y1={d.zocalo} z0={zF - 50 - t} z1={zF - 50} mat={m.casco} />}
      <Panel
        x0={r.lado === 'der' ? x1 - t : x0}
        x1={r.lado === 'der' ? x1 : x0 + t}
        y0={0}
        y1={l.yTope}
        z0={0}
        z1={zF}
        mat={m.casco}
      />
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
      <Html position={medio} center zIndexRange={[30, 0]}>
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
  const r = d.retorno;
  // La cota de alto va al lado contrario de la L para no cruzarla.
  const xAlto = r?.lado === 'der' ? x0 - sep : x1 + sep;
  const nx = r?.lado === 'der' ? -1 : 1;
  const xBorde = r?.lado === 'der' ? x0 : x1;
  return (
    // El nombre permite ocultarlas al capturar la miniatura de la cotización.
    <group name="cotas">
      <Cota desde={[x0, H + sep, D]} hasta={[x1, H + sep, D]} normal={[0, 1, 0]} texto={`${r ? 'Largo' : 'Ancho'} ${formatear(W, unidad)}`} />
      <Cota desde={[xAlto, 0, D]} hasta={[xAlto, H, D]} normal={[1, 0, 0]} texto={`Alto ${formatear(H, unidad)}`} />
      <Cota desde={[xAlto, H + sep, 0]} hasta={[xAlto, H + sep, D]} normal={[1, 0, 0]} texto={`Prof. ${formatear(D, unidad)}`} />
      {r && (
        <Cota
          desde={[r.lado === 'der' ? x1 + sep : x0 - sep, H + sep, 0]}
          hasta={[r.lado === 'der' ? x1 + sep : x0 - sep, H + sep, r.largo]}
          normal={[1, 0, 0]}
          texto={`Retorno ${formatear(r.largo, unidad)}`}
        />
      )}
      {/* Líneas de referencia hacia el mueble */}
      <Line points={[[x0, H, D], [x0, H + sep + 40, D]]} color="#a8325e" lineWidth={1} dashed dashSize={20} gapSize={15} />
      <Line points={[[x1, H, D], [x1, H + sep + 40, D]]} color="#a8325e" lineWidth={1} dashed dashSize={20} gapSize={15} />
      <Line points={[[xBorde, 0, D], [xAlto + nx * 40, 0, D]]} color="#a8325e" lineWidth={1} dashed dashSize={20} gapSize={15} />
      <Line points={[[xBorde, H, 0], [xAlto + nx * 40, H + sep + 40, 0]]} color="#a8325e" lineWidth={1} dashed dashSize={20} gapSize={15} />
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

/** Etiquetas y contornos de los módulos de un tramo. */
function marcasTramo(d: Diseno, tramo: Tramo): Marca[] {
  if (tramo === 'aereos') {
    const la = calcularLayoutAereos(d);
    if (!la) return [];
    const z = la.profundidad + 4;
    return la.cuerpos.map((lc) => ({
      clave: lc.cuerpo.id,
      indice: lc.indice,
      ancho: lc.cuerpo.ancho,
      etiqueta: [(lc.x0 + lc.x1) / 2, la.y0 + Math.min(110, (la.y1 - la.y0) / 2), z + 30],
      contorno: [
        [lc.x0 + 6, la.y0 + 6, z],
        [lc.x1 - 6, la.y0 + 6, z],
        [lc.x1 - 6, la.y1 - 6, z],
        [lc.x0 + 6, la.y1 - 6, z],
        [lc.x0 + 6, la.y0 + 6, z],
      ],
    }));
  }
  const dt = tramo === 'retorno' ? disenoRetorno(d) : disenoBase(d);
  if (!dt) return [];
  const l = calcularLayout(dt);
  const z = dt.profundidad + 4;
  // Alto visible de cada módulo (casco más cubierta o techo).
  const tope = (yTope: number) => Math.min(dt.alto, yTope + (esCocina(dt) ? dt.cocina.espesorCubierta : dt.espesor));
  const aMundo = (x: number, y: number, zz: number): [number, number, number] => {
    if (tramo !== 'retorno') return [x, y, zz];
    const [wx, wz] = aMundoRetorno(d, x, zz);
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
  tramo: Tramo;
  activo: number;
  nombre: (i: number) => string;
  onElegir: (i: number) => void;
}) {
  const marcas = useMemo(() => marcasTramo(d, tramo), [d, tramo]);
  const ia = Math.max(0, Math.min(marcas.length - 1, activo));
  const elegida = marcas[ia];
  const prefijo = tramo === 'aereos' ? (d.plantilla === 'compacto' ? 'Superior' : 'Aéreo') : tramo === 'retorno' ? 'L' : 'Módulo';
  return (
    // Ayuda visual: se oculta al capturar la miniatura de la cotización.
    <group name="ayudas">
      {elegida && <Line points={elegida.contorno} color="#a8325e" lineWidth={3} dashed dashSize={40} gapSize={22} />}
      {marcas.map((mc) => (
        <Html key={mc.clave} position={mc.etiqueta} center zIndexRange={[31, 0]}>
          <button
            type="button"
            className={`etiqueta-modulo${mc.indice === ia ? ' activa' : ''}`}
            title={`${prefijo} ${mc.indice + 1}: ${nombre(mc.indice)}, ${formatear(mc.ancho, unidad)}`}
            onClick={() => onElegir(mc.indice)}
          >
            {mc.indice + 1}
          </button>
        </Html>
      ))}
    </group>
  );
}
