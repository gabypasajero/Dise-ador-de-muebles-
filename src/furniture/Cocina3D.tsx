// Equipamiento de cocina: cubierta postformada, lavaplatos, grifería,
// encimera a gas y horno empotrado. Todas las medidas en mm.
import { Html } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Lavaplatos as EquipoLavaplatos } from '../../shared/tipos';
import { Cilindro, Panel, useMats } from './base3d';

export interface Hueco {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Radio de las esquinas (cubetas redondeadas). */
  radio?: number;
}

/** Cilindro con UV en mm (para el borde postformado). */
function cilindroUV(r: number, largo: number): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(r, r, largo, 32, 1, false);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.PI * 2 * r, uv.getY(i) * largo);
  return g;
}

// ---------- Cubierta postformada ----------

export function Cubierta({
  x0,
  x1,
  yTop,
  espesor,
  profundidad,
  huecos,
  copete,
  sinBorde = [0, 0],
}: {
  x0: number;
  x1: number;
  yTop: number;
  espesor: number;
  profundidad: number;
  huecos: Hueco[];
  copete: boolean;
  /**
   * mm a la izquierda y a la derecha sin borde postformado (las esquinas de la L o la U): ahí la
   * losa llega a todo el fondo y empalma con la cubierta del lado, que parte en z = profundidad.
   */
  sinBorde?: [number, number];
}) {
  const m = useMats();
  const r = espesor / 2;
  const [s0, s1] = sinBorde;
  const b0 = x0 + s0;
  const b1 = x1 - s1;
  const claveHuecos = huecos.map((h) => `${h.x0},${h.x1},${h.z0},${h.z1},${h.radio ?? 0}`).join('|');
  const losa = useMemo(() => {
    const s = new THREE.Shape();
    const P = profundidad;
    const pts: [number, number][] = [[x0, 0], [x1, 0]];
    if (s1 > 0) pts.push([x1, P], [b1, P], [b1, P - r]);
    else pts.push([x1, P - r]);
    if (s0 > 0) pts.push([b0, P - r], [b0, P], [x0, P]);
    else pts.push([x0, P - r]);
    pts.forEach(([x, z], i) => (i === 0 ? s.moveTo(x, z) : s.lineTo(x, z)));
    s.closePath();
    for (const h of huecos) {
      const p = new THREE.Path();
      trazarHueco(p, h);
      s.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: espesor, bevelEnabled: false, curveSegments: 4 });
    // La forma está en el plano (x, z): se gira para que el espesor quede vertical.
    g.rotateX(Math.PI / 2);
    g.translate(0, yTop, 0);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x0, x1, yTop, espesor, profundidad, r, claveHuecos, s0, s1]);
  const borde = useMemo(() => cilindroUV(r, Math.max(1, b1 - b0)), [r, b1, b0]);
  const lomo = useMemo(() => cilindroUV(7, x1 - x0), [x1, x0]);
  useEffect(() => () => losa.dispose(), [losa]);
  useEffect(() => () => borde.dispose(), [borde]);
  useEffect(() => () => lomo.dispose(), [lomo]);
  const cx = (x0 + x1) / 2;
  return (
    <group>
      <mesh geometry={losa} material={m.cubierta} castShadow receiveShadow />
      {/* Borde frontal redondeado (postformado). */}
      {b1 - b0 > 1 && (
        <mesh geometry={borde} material={m.cubierta} position={[(b0 + b1) / 2, yTop - r, profundidad - r]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow />
      )}
      {copete && (
        <>
          <Panel x0={x0} x1={x1} y0={yTop} y1={yTop + 42} z0={0} z1={14} mat={m.cubierta} eje="x" />
          <mesh geometry={lomo} material={m.cubierta} position={[cx, yTop + 42, 7]} rotation={[0, 0, Math.PI / 2]} castShadow />
        </>
      )}
    </group>
  );
}

// ---------- Solo corte ----------

/**
 * Corte en la cubierta para un equipo que trae el cliente: solo el hueco (ya restado de la
 * losa) con su interior oscuro hundido, sin parrillas, cubeta ni llave.
 */
export function CorteCubierta({ hueco: h, yTop, espesor }: { hueco: Hueco; yTop: number; espesor: number }) {
  const m = useMats();
  // El fondo oscuro queda dentro del espesor de la cubierta: tapa el casco blanco de abajo.
  const fondo = yTop - espesor + 3;
  const e = 2;
  return (
    <group>
      <Panel x0={h.x0} x1={h.x1} y0={fondo} y1={fondo + e} z0={h.z0} z1={h.z1} mat={m.negroMate} sombra={false} />
      <Panel x0={h.x0} x1={h.x0 + e} y0={fondo} y1={yTop - 0.5} z0={h.z0} z1={h.z1} mat={m.grisOscuro} sombra={false} />
      <Panel x0={h.x1 - e} x1={h.x1} y0={fondo} y1={yTop - 0.5} z0={h.z0} z1={h.z1} mat={m.grisOscuro} sombra={false} />
      <Panel x0={h.x0} x1={h.x1} y0={fondo} y1={yTop - 0.5} z0={h.z0} z1={h.z0 + e} mat={m.grisOscuro} sombra={false} />
      <Panel x0={h.x0} x1={h.x1} y0={fondo} y1={yTop - 0.5} z0={h.z1 - e} z1={h.z1} mat={m.grisOscuro} sombra={false} />
    </group>
  );
}

// ---------- Lavaplatos ----------

/** Contorno de un hueco (rectángulo, con esquinas redondeadas si tiene radio) en el plano (x, z). */
export function trazarHueco(p: THREE.Path, h: Hueco) {
  const r = Math.min(h.radio ?? 0, (h.x1 - h.x0) / 2 - 0.5, (h.z1 - h.z0) / 2 - 0.5);
  if (r <= 0) {
    p.moveTo(h.x0, h.z0);
    p.lineTo(h.x0, h.z1);
    p.lineTo(h.x1, h.z1);
    p.lineTo(h.x1, h.z0);
    p.closePath();
    return;
  }
  p.moveTo(h.x0, h.z0 + r);
  p.lineTo(h.x0, h.z1 - r);
  p.quadraticCurveTo(h.x0, h.z1, h.x0 + r, h.z1);
  p.lineTo(h.x1 - r, h.z1);
  p.quadraticCurveTo(h.x1, h.z1, h.x1, h.z1 - r);
  p.lineTo(h.x1, h.z0 + r);
  p.quadraticCurveTo(h.x1, h.z0, h.x1 - r, h.z0);
  p.lineTo(h.x0 + r, h.z0);
  p.quadraticCurveTo(h.x0, h.z0, h.x0, h.z0 + r);
  p.closePath();
}

/**
 * Huecos (cortes) de las cubetas, centrados en (cx, cz). Simple: cubeta de 40 × 36 cm con esquinas
 * redondeadas; doble: dos cubetas rectas; riñonera: una cubeta grande redondeada de 55 × 40 cm.
 */
export function huecosLavaplatos(tipo: EquipoLavaplatos['modelo'], cx: number, cz: number, escala = 1): Hueco[] {
  if (tipo === 'pozo') {
    // De pozo: una cubeta cuadrada y honda, de esquinas apenas redondeadas.
    const w = 480 * escala;
    const d = 400 * escala;
    return [{ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, radio: 14 * escala }];
  }
  if (tipo === 'pozo-doble') {
    // De pozo doble: una cubeta grande y una más chica, separadas por un puente angosto.
    const grande = 430 * escala;
    const chica = 320 * escala;
    const sep = 30 * escala;
    const d = 400 * escala;
    const x0 = cx - (grande + sep + chica) / 2;
    return [
      { x0, x1: x0 + grande, z0: cz - d / 2, z1: cz + d / 2, radio: 14 * escala },
      { x0: x0 + grande + sep, x1: x0 + grande + sep + chica, z0: cz - d / 2, z1: cz + d / 2, radio: 14 * escala },
    ];
  }
  if (tipo === 'rinonera') {
    const w = 550 * escala;
    const d = 400 * escala;
    return [{ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, radio: 90 * escala }];
  }
  const w = (tipo === 'doble' ? 360 : 400) * escala;
  const d = (tipo === 'doble' ? 380 : 360) * escala;
  if (tipo === 'simple') return [{ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, radio: 45 * escala }];
  const sep = 50 * escala;
  return [
    { x0: cx - sep / 2 - w, x1: cx - sep / 2, z0: cz - d / 2, z1: cz + d / 2 },
    { x0: cx + sep / 2, x1: cx + sep / 2 + w, z0: cz - d / 2, z1: cz + d / 2 },
  ];
}

/** Acero de la cubeta: algo más oscuro que el ala y visible por ambas caras (se ve desde adentro). */
const MAT_CUBETA = new THREE.MeshStandardMaterial({ color: '#a4a8ad', metalness: 0.75, roughness: 0.38, side: THREE.DoubleSide });

/** Acero oscuro (grafito) de los lavaplatos de pozo, como en las fotos de la tienda. */
const MAT_POZO = new THREE.MeshStandardMaterial({ color: '#3c3f43', metalness: 0.3, roughness: 0.55, side: THREE.DoubleSide });
const MAT_POZO_ALA = new THREE.MeshStandardMaterial({ color: '#6a6d72', metalness: 0.72, roughness: 0.36 });

/** Cubeta de esquinas redondeadas: paredes (anillo extruido hacia abajo) y fondo. */
function CubetaRedondeada({ h, yTop, p, material = MAT_CUBETA }: { h: Hueco; yTop: number; p: number; material?: THREE.Material }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape();
    trazarHueco(s, { ...h, x0: h.x0 - 1.5, x1: h.x1 + 1.5, z0: h.z0 - 1.5, z1: h.z1 + 1.5, radio: (h.radio ?? 0) + 1.5 });
    const hole = new THREE.Path();
    trazarHueco(hole, h);
    s.holes.push(hole);
    const paredes = new THREE.ExtrudeGeometry(s, { depth: p, bevelEnabled: false, curveSegments: 10 });
    paredes.rotateX(Math.PI / 2);
    paredes.translate(0, yTop, 0);
    const f = new THREE.Shape();
    trazarHueco(f, h);
    const fondo = new THREE.ExtrudeGeometry(f, { depth: 1.5, bevelEnabled: false, curveSegments: 10 });
    fondo.rotateX(Math.PI / 2);
    fondo.translate(0, yTop - p + 1.5, 0);
    return { paredes, fondo };
  }, [h.x0, h.x1, h.z0, h.z1, h.radio, yTop, p]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(
    () => () => {
      geo.paredes.dispose();
      geo.fondo.dispose();
    },
    [geo],
  );
  return (
    <group>
      <mesh geometry={geo.paredes} material={material} />
      <mesh geometry={geo.fondo} material={material} />
    </group>
  );
}

export function Lavaplatos({
  huecos,
  yTop,
  profundidadCuba,
  grifo,
  escala = 1,
  llave = true,
  modelo = 'simple',
  contorno,
}: {
  huecos: Hueco[];
  yTop: number;
  profundidadCuba: number;
  grifo: 'negro' | 'cromado';
  escala?: number;
  /** La llave es del lavaplatos: se puede cotizar sin ella. */
  llave?: boolean;
  /** Simple: cubeta a la izquierda y secador estriado a la derecha; riñonera: repisa para la llave atrás; de pozo: acero oscuro y cubetas hondas. */
  modelo?: EquipoLavaplatos['modelo'];
  /** Ancho total del equipo (x0..x1) cuando es más que las cubetas con su ala (el secador del simple). */
  contorno?: { x0: number; x1: number };
}) {
  const m = useMats();
  const pozo = modelo === 'pozo' || modelo === 'pozo-doble';
  const margen = (modelo === 'rinonera' ? 30 : pozo ? 34 : 38) * escala;
  const ext = {
    x0: contorno?.x0 ?? Math.min(...huecos.map((h) => h.x0)) - margen,
    x1: contorno?.x1 ?? Math.max(...huecos.map((h) => h.x1)) + margen,
    z0: Math.min(...huecos.map((h) => h.z0)) - margen,
    z1: Math.max(...huecos.map((h) => h.z1)) + margen,
  };
  const clave = huecos.map((h) => `${h.x0},${h.x1},${h.z0},${h.z1},${h.radio ?? 0}`).join('|');
  const ala = useMemo(() => {
    const s = new THREE.Shape();
    trazarHueco(s, { ...ext, radio: 10 * escala });
    for (const h of huecos) {
      const p = new THREE.Path();
      trazarHueco(p, h);
      s.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 2.5, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 2, curveSegments: 10 });
    g.rotateX(Math.PI / 2);
    g.translate(0, yTop + 3, 0);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, yTop, margen, ext.x0, ext.x1]);
  useEffect(() => () => ala.dispose(), [ala]);
  // La cubeta no baja del espesor de la cubierta: debajo está el techo del módulo.
  const p = profundidadCuba;
  const e = 1.5;
  const h0 = huecos[0];
  // Llave: atrás, entre la cubeta y el secador (simple), en la repisa (riñonera) o al centro (doble).
  const zGrifo = ext.z0 + 22 * escala;
  // Secador del simple: hacia el lado donde el equipo se extiende más allá de la cubeta.
  const secadorDer = ext.x1 - h0.x1 >= h0.x0 - ext.x0;
  const xGrifo = modelo === 'simple' && contorno ? (secadorDer ? h0.x1 + 30 * escala : h0.x0 - 30 * escala) : (ext.x0 + ext.x1) / 2;
  const matGrifo = grifo === 'negro' ? m.negroMate : m.acero;
  // Secador estriado: 18 nervios a lo ancho, algo más cortos hacia el fondo.
  const nervios: JSX.Element[] = [];
  if (modelo === 'simple' && contorno && Math.max(ext.x1 - h0.x1, h0.x0 - ext.x0) > 120 * escala) {
    const xa = secadorDer ? h0.x1 + 70 * escala : ext.x0 + 35 * escala;
    const xb = secadorDer ? ext.x1 - 35 * escala : h0.x0 - 70 * escala;
    const za = ext.z0 + 45 * escala;
    const zb = ext.z1 - 30 * escala;
    const n = 18;
    for (let k = 0; k < n; k++) {
      const z = za + ((zb - za) * k) / (n - 1);
      const recorte = (1 - k / (n - 1)) * 35 * escala;
      nervios.push(<Panel key={k} x0={secadorDer ? xa + recorte : xa + recorte * 0.4} x1={secadorDer ? xb - recorte * 0.4 : xb - recorte} y0={yTop + 5} y1={yTop + 8} z0={z - 4 * escala} z1={z + 4 * escala} mat={m.aceroCepillado} sombra={false} />);
    }
  }
  return (
    <group>
      <mesh geometry={ala} material={pozo ? MAT_POZO_ALA : m.acero} castShadow receiveShadow />
      {/* Labio levantado del borde del ala. */}
      <Panel x0={ext.x0} x1={ext.x1} y0={yTop + 4} y1={yTop + 7} z0={ext.z0} z1={ext.z0 + 6 * escala} mat={m.aceroCepillado} sombra={false} />
      <Panel x0={ext.x0} x1={ext.x1} y0={yTop + 4} y1={yTop + 7} z0={ext.z1 - 6 * escala} z1={ext.z1} mat={m.aceroCepillado} sombra={false} />
      {nervios}
      {modelo === 'rinonera' && (
        // Repisa redondeada hacia adentro de la cubeta, atrás al centro, donde va la llave.
        <Cilindro r={60 * escala} largo={4} pos={[(h0.x0 + h0.x1) / 2, yTop + 4, h0.z0 + 10 * escala]} mat={m.acero} segmentos={36} />
      )}
      {huecos.map((h, i) => {
        const cx = modelo === 'rinonera' ? h.x0 + (h.x1 - h.x0) * 0.4 : (h.x0 + h.x1) / 2;
        const cz = (h.z0 + h.z1) / 2 + (modelo === 'rinonera' ? 40 * escala : 0);
        return (
          <group key={i}>
            {h.radio ? (
              <CubetaRedondeada h={h} yTop={yTop} p={p} material={pozo ? MAT_POZO : MAT_CUBETA} />
            ) : (
              <>
                <Panel x0={h.x0} x1={h.x1} y0={yTop - p} y1={yTop - p + e} z0={h.z0} z1={h.z1} mat={m.aceroCepillado} sombra={false} />
                <Panel x0={h.x0} x1={h.x0 + e} y0={yTop - p} y1={yTop} z0={h.z0} z1={h.z1} mat={m.aceroCepillado} sombra={false} />
                <Panel x0={h.x1 - e} x1={h.x1} y0={yTop - p} y1={yTop} z0={h.z0} z1={h.z1} mat={m.aceroCepillado} sombra={false} />
                <Panel x0={h.x0} x1={h.x1} y0={yTop - p} y1={yTop} z0={h.z0} z1={h.z0 + e} mat={m.aceroCepillado} sombra={false} />
                <Panel x0={h.x0} x1={h.x1} y0={yTop - p} y1={yTop} z0={h.z1 - e} z1={h.z1} mat={m.aceroCepillado} sombra={false} />
              </>
            )}
            <Cilindro r={22 * escala} largo={3} pos={[cx, yTop - p + 2, cz]} mat={m.acero} sombra={false} />
            <Cilindro r={12 * escala} largo={3.4} pos={[cx, yTop - p + 2.2, cz]} mat={m.grisOscuro} sombra={false} />
          </group>
        );
      })}
      {llave && <Grifo x={xGrifo} y={yTop + 4} z={modelo === 'rinonera' ? h0.z0 + 5 * escala : zGrifo} mat={matGrifo} escala={escala} />}
    </group>
  );
}

export function Grifo({ x, y, z, mat, escala = 1 }: { x: number; y: number; z: number; mat: THREE.Material; escala?: number }) {
  const tubo = useMemo(() => {
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 40, 0),
      new THREE.Vector3(0, 220, 0),
      new THREE.Vector3(0, 300, 25),
      new THREE.Vector3(0, 310, 95),
      new THREE.Vector3(0, 270, 165),
      new THREE.Vector3(0, 215, 185),
    ]);
    return new THREE.TubeGeometry(curva, 48, 11, 14, false);
  }, []);
  useEffect(() => () => tubo.dispose(), [tubo]);
  return (
    <group position={[x, y, z]} scale={escala}>
      <Cilindro r={26} largo={14} pos={[0, 7, 0]} mat={mat} />
      <Cilindro r={20} largo={110} pos={[0, 60, 0]} mat={mat} />
      <mesh geometry={tubo} material={mat} castShadow />
      <Cilindro r={14} largo={32} pos={[0, 200, 188]} mat={mat} />
      {/* Palanca monomando */}
      <Cilindro r={7} largo={70} pos={[28, 110, 0]} eje="x" mat={mat} />
    </group>
  );
}

// ---------- Encimera a gas ----------

type Quemador = [number, number, number];

/**
 * Encimeras de la tienda (ancho total de la placa):
 * - 4 platos, 60 cm: placa de acero cepillado, quemadores 2 × 2 (el de adelante a la izquierda es
 *   el wok), dos parrillas de fierro y una franja de 4 perillas en columna a la derecha.
 * - 3 platos, 73 cm: vidrio negro con canto metálico, dos quemadores grandes a los lados y uno chico
 *   al centro atrás, cada uno con 4 apoyos; 3 perillas en fila adelante al centro.
 * - 2 platos (infantil, de juguete): vidrio negro.
 */
const QUEMADORES: Record<'2' | '3' | '4', { ancho: number; fondo: number; q: Quemador[] }> = {
  '4': { ancho: 600, fondo: 510, q: [[-160, 105, 54], [-160, -120, 38], [60, -120, 34], [60, 105, 42]] },
  '3': { ancho: 730, fondo: 500, q: [[-205, 15, 60], [205, 15, 60], [0, -130, 36]] },
  '2': { ancho: 300, fondo: 520, q: [[0, -120, 40], [0, 100, 46]] },
};

export function medidasEncimera(tipo: '2' | '3' | '4') {
  return QUEMADORES[tipo];
}

function QuemadorGas({ x, z, r, y, apoyos, llama }: { x: number; z: number; r: number; y: number; apoyos: boolean; llama: boolean }) {
  const m = useMats();
  return (
    <group position={[x, y, z]}>
      <Cilindro r={r + 12} largo={3} pos={[0, 1.5, 0]} mat={m.acero} segmentos={36} sombra={false} />
      <Cilindro r={r * 0.82} largo={12} pos={[0, 7, 0]} mat={m.grisOscuro} segmentos={28} />
      <Cilindro r={r * 0.55} largo={5} pos={[0, 15, 0]} mat={m.negroMate} segmentos={28} />
      {llama && (
        <mesh position={[0, 11, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.llama}>
          <torusGeometry args={[r * 0.8, 3.2, 8, 40]} />
        </mesh>
      )}
      {apoyos &&
        [0, 1, 2, 3].map((k) => (
          <group key={k} rotation={[0, (k * Math.PI) / 2 + Math.PI / 4, 0]}>
            <Panel x0={r * 0.6} x1={r + 22} y0={3} y1={22} z0={-4} z1={4} mat={m.negroMate} sombra={false} />
          </group>
        ))}
    </group>
  );
}

export function Encimera({
  cx,
  cz,
  yTop,
  tipo,
  escala = 1,
}: {
  cx: number;
  cz: number;
  yTop: number;
  tipo: '2' | '3' | '4';
  escala?: number;
}) {
  const m = useMats();
  const def = QUEMADORES[tipo];
  const W = def.ancho;
  const F = def.fondo;
  if (tipo === '4') {
    // Parrillas de fierro: dos rejas (mitad izquierda y derecha de la zona de quemadores).
    const reja = (x0: number, x1: number) => {
      const z0 = -F / 2 + 25;
      const z1 = F / 2 - 25;
      const y0 = 30;
      const y1 = 38;
      return (
        <group key={x0}>
          <Panel x0={x0} x1={x1} y0={y0} y1={y1} z0={z0} z1={z0 + 9} mat={m.negroMate} sombra={false} />
          <Panel x0={x0} x1={x1} y0={y0} y1={y1} z0={z1 - 9} z1={z1} mat={m.negroMate} sombra={false} />
          <Panel x0={x0} x1={x0 + 9} y0={y0} y1={y1} z0={z0} z1={z1} mat={m.negroMate} sombra={false} />
          <Panel x0={x1 - 9} x1={x1} y0={y0} y1={y1} z0={z0} z1={z1} mat={m.negroMate} sombra={false} />
          <Panel x0={x0} x1={x1} y0={y0} y1={y1} z0={-4} z1={5} mat={m.negroMate} sombra={false} />
          {[-1, 1].map((s) =>
            [0, 1].map((k) => {
              const zc = k === 0 ? -115 : 105;
              const xc = (x0 + x1) / 2;
              return <Panel key={`${s}${k}`} x0={xc - 4} x1={xc + 4} y0={y0} y1={y1} z0={zc + s * 30} z1={zc + s * 95} mat={m.negroMate} sombra={false} />;
            }),
          )}
          {[x0, x1 - 9].map((x) =>
            [z0, z1 - 9].map((z) => <Panel key={`${x}${z}`} x0={x} x1={x + 9} y0={6} y1={y0} z0={z} z1={z + 9} mat={m.negroMate} sombra={false} />),
          )}
        </group>
      );
    };
    return (
      <group position={[cx, yTop, cz]} scale={escala}>
        <Panel x0={-W / 2} x1={W / 2} y0={0} y1={6} z0={-F / 2} z1={F / 2} mat={m.aceroCepillado} />
        {def.q.map(([qx, qz, r], i) => (
          <QuemadorGas key={i} x={qx} z={qz} r={r} y={6} apoyos={false} llama={i === 0} />
        ))}
        {reja(-W / 2 + 15, -50)}
        {reja(-50, 180)}
        {/* Franja de mandos a la derecha: 4 perillas de acero en columna. */}
        {[0, 1, 2, 3].map((i) => (
          <group key={i} position={[W / 2 - 50, 6, -F / 2 + 85 + i * 112]}>
            <Cilindro r={20} largo={18} pos={[0, 9, 0]} mat={m.acero} segmentos={24} />
            <Panel x0={-3} x1={3} y0={18} y1={21} z0={-17} z1={17} mat={m.aceroCepillado} sombra={false} />
          </group>
        ))}
      </group>
    );
  }
  const perillas = def.q.length;
  return (
    <group position={[cx, yTop, cz]} scale={escala}>
      {/* Canto metálico delgado bajo el vidrio negro. */}
      <Panel x0={-W / 2} x1={W / 2} y0={0} y1={4} z0={-F / 2} z1={F / 2} mat={m.acero} />
      <Panel x0={-W / 2 + 3} x1={W / 2 - 3} y0={4} y1={8} z0={-F / 2 + 3} z1={F / 2 - 3} mat={m.vidrioNegro} />
      {def.q.map(([qx, qz, r], i) => (
        <QuemadorGas key={i} x={qx} z={qz} r={r} y={8} apoyos llama={i === 0} />
      ))}
      {tipo === '3' && (
        <>
          {/* Franja de luz bajo las perillas y marca chica abajo a la izquierda. */}
          <Panel x0={-110} x1={110} y0={8} y1={8.6} z0={F / 2 - 24} z1={F / 2 - 20} mat={m.acero} sombra={false} />
          <Panel x0={-W / 2 + 30} x1={-W / 2 + 90} y0={8} y1={8.6} z0={F / 2 - 30} z1={F / 2 - 22} mat={m.aceroCepillado} sombra={false} />
        </>
      )}
      {Array.from({ length: perillas }, (_, i) => (
        <group key={i} position={tipo === '3' ? [(i - 1) * 62, 8, F / 2 - 52] : [W / 2 - 40 - i * 42, 8, F / 2 - 30]}>
          <Cilindro r={17} largo={16} pos={[0, 8, 0]} mat={tipo === '3' ? m.acero : m.negroMate} segmentos={20} />
          <Panel x0={-2.5} x1={2.5} y0={16} y1={18} z0={-14} z1={14} mat={m.aceroCepillado} sombra={false} />
        </group>
      ))}
    </group>
  );
}

// ---------- Horno empotrado ----------

export function Horno({
  x0,
  x1,
  y0,
  y1,
  zFrente,
  espesor,
}: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  zFrente: number;
  espesor: number;
}) {
  const m = useMats();
  const z0 = zFrente - 2;
  const z1 = zFrente + espesor + 4;
  const panel = 95;
  const w = x1 - x0;
  const vidrioVentana = useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: '#25272b', roughness: 0.05, metalness: 0.3, clearcoat: 1 }),
    [],
  );
  useEffect(() => () => vidrioVentana.dispose(), [vidrioVentana]);
  return (
    <group>
      <Panel x0={x0} x1={x1} y0={y0} y1={y1} z0={zFrente - 520} z1={z0} mat={m.grisOscuro} sombra={false} />
      {/* Panel de control */}
      <Panel x0={x0} x1={x1} y0={y1 - panel} y1={y1} z0={z0} z1={z1} mat={m.negroMate} />
      {[x0 + 70, x1 - 70].map((x) => (
        <Cilindro key={x} r={19} largo={20} pos={[x, y1 - panel / 2, z1 + 10]} eje="z" mat={m.aceroCepillado} />
      ))}
      <Panel x0={x0 + w / 2 - 55} x1={x0 + w / 2 + 55} y0={y1 - panel / 2 - 14} y1={y1 - panel / 2 + 14} z0={z1} z1={z1 + 1} mat={m.vidrioNegro} sombra={false} />
      {/* Puerta de vidrio */}
      <Panel x0={x0} x1={x1} y0={y0} y1={y1 - panel - 3} z0={z0} z1={z1} mat={m.vidrioNegro} />
      <Panel x0={x0 + 75} x1={x1 - 75} y0={y0 + 70} y1={y1 - panel - 150} z0={z1} z1={z1 + 0.8} mat={vidrioVentana} sombra={false} />
      {/* Manilla */}
      <Cilindro r={9} largo={w - 110} pos={[(x0 + x1) / 2, y1 - panel - 55, z1 + 38]} eje="x" mat={m.acero} />
      <Cilindro r={6} largo={38} pos={[x0 + 70, y1 - panel - 55, z1 + 19]} eje="z" mat={m.acero} />
      <Cilindro r={6} largo={38} pos={[x1 - 70, y1 - panel - 55, z1 + 19]} eje="z" mat={m.acero} />
    </group>
  );
}

// ---------- Campanas ----------

/** Alto del cielo de la cocina (mm): hasta ahí sube la chimenea de la campana mural. */
export const ALTO_CIELO = 2700;

/** Caja con la cara superior más chica y corrida (tronco de pirámide de la campana). */
function troncoPiramide(wb: number, db: number, zb: number, wt: number, dt: number, zt: number, h: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(1, 1, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const arriba = p.getY(i) > 0;
    p.setXYZ(i, p.getX(i) * (arriba ? wt : wb), arriba ? h : 0, (arriba ? zt : zb) + p.getZ(i) * (arriba ? dt : db));
  }
  g.computeVertexNormals();
  return g;
}

/** Campana de muro (sin aéreo encima): visera, cuerpo inclinado y chimenea hasta el cielo. x: centro; y0: borde inferior. */
export function CampanaMural({ x, y0, ancho = 600, fondo = 480, yCielo = ALTO_CIELO }: { x: number; y0: number; ancho?: number; fondo?: number; yCielo?: number }) {
  const m = useMats();
  const altoCuerpo = 170;
  const visera = 45;
  const chim = { w: 260, z0: 12, z1: 252 };
  const cuerpo = useMemo(
    () => troncoPiramide(ancho, fondo, fondo / 2, chim.w, chim.z1 - chim.z0, (chim.z0 + chim.z1) / 2, altoCuerpo),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ancho, fondo],
  );
  useEffect(() => () => cuerpo.dispose(), [cuerpo]);
  const yChim = visera + altoCuerpo;
  const altoChim = Math.max(150, yCielo - y0 - yChim);
  return (
    <group position={[x, y0, 0]}>
      <Panel x0={-ancho / 2} x1={ancho / 2} y0={0} y1={visera} z0={0} z1={fondo} mat={m.aceroCepillado} />
      <Panel x0={-ancho / 2 + 25} x1={ancho / 2 - 25} y0={-1.5} y1={0} z0={25} z1={fondo - 25} mat={m.grisOscuro} sombra={false} />
      {[-ancho / 4, ancho / 4].map((dx) => (
        <Cilindro key={dx} r={16} largo={2} pos={[dx, -2.5, fondo - 70]} mat={m.luz} sombra={false} />
      ))}
      <mesh geometry={cuerpo} material={m.aceroCepillado} position={[0, visera, 0]} castShadow receiveShadow />
      <Panel x0={-chim.w / 2} x1={chim.w / 2} y0={yChim} y1={yChim + altoChim} z0={chim.z0} z1={chim.z1} mat={m.aceroCepillado} />
    </group>
  );
}

/**
 * Campana alojada en un módulo aéreo: visera al ras de las puertas en el borde inferior y el
 * motor en el nicho que queda bajo las puertas. Coordenadas del tramo aéreo (mm).
 */
export function CampanaAlojada({
  cx,
  ancho,
  y0,
  y1,
  zFrente,
  espesorFrente,
}: {
  cx: number;
  ancho: number;
  /** Borde inferior del aéreo y borde inferior de las puertas del módulo. */
  y0: number;
  y1: number;
  zFrente: number;
  espesorFrente: number;
}) {
  const m = useMats();
  const visera = 45;
  const zCara = zFrente + espesorFrente;
  return (
    <group>
      {/* Cuerpo de acero bajo las puertas, apenas retirado del plomo de las puertas. */}
      {y1 - y0 - visera > 20 && (
        <Panel x0={cx - ancho / 2} x1={cx + ancho / 2} y0={y0 + visera + 3} y1={y1 - 3} z0={20} z1={zCara - 10} mat={m.aceroCepillado} />
      )}
      {/* Visera (frente extraíble) y filtro por debajo, con sus luces. */}
      <Panel x0={cx - ancho / 2} x1={cx + ancho / 2} y0={y0} y1={y0 + visera} z0={30} z1={zCara + 8} mat={m.aceroCepillado} />
      <Panel x0={cx - ancho / 2 + 6} x1={cx + ancho / 2 - 6} y0={y0 + visera} y1={y0 + visera + 3} z0={zCara - 40} z1={zCara + 4} mat={m.negroMate} sombra={false} />
      <Panel x0={cx - ancho / 2 + 20} x1={cx + ancho / 2 - 20} y0={y0 - 1.5} y1={y0} z0={45} z1={zCara - 15} mat={m.grisOscuro} sombra={false} />
      {[-ancho / 4, ancho / 4].map((dx) => (
        <Cilindro key={dx} r={14} largo={2} pos={[cx + dx, y0 - 2.5, zCara - 55]} mat={m.luz} sombra={false} />
      ))}
    </group>
  );
}

// ---------- Espacio libre ----------

export function EspacioLibre({
  x0,
  x1,
  y1,
  profundidad,
  texto,
}: {
  x0: number;
  x1: number;
  y1: number;
  profundidad: number;
  texto: string;
}) {
  const geo = useMemo(() => new THREE.BoxGeometry(x1 - x0 - 20, y1 - 10, profundidad - 30), [x0, x1, y1, profundidad]);
  const bordes = useMemo(() => new THREE.EdgesGeometry(geo), [geo]);
  useEffect(() => () => {
    geo.dispose();
    bordes.dispose();
  }, [geo, bordes]);
  return (
    <group position={[(x0 + x1) / 2, (y1 - 10) / 2, (profundidad - 30) / 2 + 10]}>
      <mesh geometry={geo}>
        <meshStandardMaterial color="#a8325e" transparent opacity={0.07} depthWrite={false} />
      </mesh>
      <lineSegments geometry={bordes}>
        <lineBasicMaterial color="#a8325e" transparent opacity={0.6} />
      </lineSegments>
      <Html position={[0, 0, (profundidad - 30) / 2]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="etiqueta-hueco">{texto}</div>
      </Html>
    </group>
  );
}
