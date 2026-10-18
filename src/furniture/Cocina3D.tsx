// Equipamiento de cocina: cubierta postformada, lavaplatos, grifería,
// encimera a gas y horno empotrado. Todas las medidas en mm.
import { Html } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Cilindro, Panel, useMats } from './base3d';

export interface Hueco {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
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
}: {
  x0: number;
  x1: number;
  yTop: number;
  espesor: number;
  profundidad: number;
  huecos: Hueco[];
  copete: boolean;
}) {
  const m = useMats();
  const r = espesor / 2;
  const claveHuecos = huecos.map((h) => `${h.x0},${h.x1},${h.z0},${h.z1}`).join('|');
  const losa = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(x0, 0);
    s.lineTo(x1, 0);
    s.lineTo(x1, profundidad - r);
    s.lineTo(x0, profundidad - r);
    s.closePath();
    for (const h of huecos) {
      const p = new THREE.Path();
      p.moveTo(h.x0, h.z0);
      p.lineTo(h.x0, h.z1);
      p.lineTo(h.x1, h.z1);
      p.lineTo(h.x1, h.z0);
      p.closePath();
      s.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: espesor, bevelEnabled: false, curveSegments: 4 });
    // La forma está en el plano (x, z): se gira para que el espesor quede vertical.
    g.rotateX(Math.PI / 2);
    g.translate(0, yTop, 0);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x0, x1, yTop, espesor, profundidad, r, claveHuecos]);
  const borde = useMemo(() => cilindroUV(r, x1 - x0), [r, x1, x0]);
  const lomo = useMemo(() => cilindroUV(7, x1 - x0), [x1, x0]);
  useEffect(() => () => losa.dispose(), [losa]);
  useEffect(() => () => borde.dispose(), [borde]);
  useEffect(() => () => lomo.dispose(), [lomo]);
  const cx = (x0 + x1) / 2;
  return (
    <group>
      <mesh geometry={losa} material={m.cubierta} castShadow receiveShadow />
      {/* Borde frontal redondeado (postformado). */}
      <mesh geometry={borde} material={m.cubierta} position={[cx, yTop - r, profundidad - r]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow />
      {copete && (
        <>
          <Panel x0={x0} x1={x1} y0={yTop} y1={yTop + 42} z0={0} z1={14} mat={m.cubierta} eje="x" />
          <mesh geometry={lomo} material={m.cubierta} position={[cx, yTop + 42, 7]} rotation={[0, 0, Math.PI / 2]} castShadow />
        </>
      )}
    </group>
  );
}

// ---------- Lavaplatos ----------

export function huecosLavaplatos(tipo: 'simple' | 'doble', cx: number, cz: number, escala = 1): Hueco[] {
  const w = (tipo === 'doble' ? 360 : 400) * escala;
  const d = (tipo === 'doble' ? 380 : 360) * escala;
  if (tipo === 'simple') return [{ x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2 }];
  const sep = 50 * escala;
  return [
    { x0: cx - sep / 2 - w, x1: cx - sep / 2, z0: cz - d / 2, z1: cz + d / 2 },
    { x0: cx + sep / 2, x1: cx + sep / 2 + w, z0: cz - d / 2, z1: cz + d / 2 },
  ];
}

export function Lavaplatos({
  huecos,
  yTop,
  profundidadCuba,
  grifo,
  escala = 1,
}: {
  huecos: Hueco[];
  yTop: number;
  profundidadCuba: number;
  grifo: 'negro' | 'cromado';
  escala?: number;
}) {
  const m = useMats();
  const margen = 38 * escala;
  const ext = {
    x0: Math.min(...huecos.map((h) => h.x0)) - margen,
    x1: Math.max(...huecos.map((h) => h.x1)) + margen,
    z0: Math.min(...huecos.map((h) => h.z0)) - margen,
    z1: Math.max(...huecos.map((h) => h.z1)) + margen,
  };
  const clave = huecos.map((h) => `${h.x0},${h.x1},${h.z0},${h.z1}`).join('|');
  const ala = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(ext.x0, ext.z0);
    s.lineTo(ext.x1, ext.z0);
    s.lineTo(ext.x1, ext.z1);
    s.lineTo(ext.x0, ext.z1);
    s.closePath();
    for (const h of huecos) {
      const p = new THREE.Path();
      p.moveTo(h.x0, h.z0);
      p.lineTo(h.x0, h.z1);
      p.lineTo(h.x1, h.z1);
      p.lineTo(h.x1, h.z0);
      p.closePath();
      s.holes.push(p);
    }
    const g = new THREE.ExtrudeGeometry(s, { depth: 2.5, bevelEnabled: true, bevelThickness: 1.2, bevelSize: 1.2, bevelSegments: 2 });
    g.rotateX(Math.PI / 2);
    g.translate(0, yTop + 3, 0);
    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, yTop, margen]);
  useEffect(() => () => ala.dispose(), [ala]);
  const p = profundidadCuba;
  const e = 1.5;
  const zGrifo = ext.z0 + 18 * escala;
  const xGrifo = (ext.x0 + ext.x1) / 2;
  const matGrifo = grifo === 'negro' ? m.negroMate : m.acero;
  return (
    <group>
      <mesh geometry={ala} material={m.acero} castShadow receiveShadow />
      {huecos.map((h, i) => {
        const cx = (h.x0 + h.x1) / 2;
        const cz = (h.z0 + h.z1) / 2;
        return (
          <group key={i}>
            <Panel x0={h.x0} x1={h.x1} y0={yTop - p} y1={yTop - p + e} z0={h.z0} z1={h.z1} mat={m.aceroCepillado} sombra={false} />
            <Panel x0={h.x0} x1={h.x0 + e} y0={yTop - p} y1={yTop} z0={h.z0} z1={h.z1} mat={m.aceroCepillado} sombra={false} />
            <Panel x0={h.x1 - e} x1={h.x1} y0={yTop - p} y1={yTop} z0={h.z0} z1={h.z1} mat={m.aceroCepillado} sombra={false} />
            <Panel x0={h.x0} x1={h.x1} y0={yTop - p} y1={yTop} z0={h.z0} z1={h.z0 + e} mat={m.aceroCepillado} sombra={false} />
            <Panel x0={h.x0} x1={h.x1} y0={yTop - p} y1={yTop} z0={h.z1 - e} z1={h.z1} mat={m.aceroCepillado} sombra={false} />
            <Cilindro r={22 * escala} largo={3} pos={[cx, yTop - p + 2, cz]} mat={m.acero} sombra={false} />
            <Cilindro r={12 * escala} largo={3.4} pos={[cx, yTop - p + 2.2, cz]} mat={m.grisOscuro} sombra={false} />
          </group>
        );
      })}
      <Grifo x={xGrifo} y={yTop + 4} z={zGrifo} mat={matGrifo} escala={escala} />
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

const QUEMADORES: Record<'2' | '3' | '4', { ancho: number; fondo: number; q: Quemador[] }> = {
  '4': { ancho: 580, fondo: 510, q: [[-150, -120, 44], [95, -120, 38], [-150, 105, 52], [95, 105, 42]] },
  '3': { ancho: 580, fondo: 500, q: [[-165, -105, 42], [-165, 115, 42], [95, 0, 58]] },
  '2': { ancho: 300, fondo: 520, q: [[0, -120, 40], [0, 100, 46]] },
};

export function medidasEncimera(tipo: '2' | '3' | '4') {
  return QUEMADORES[tipo];
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
  const perillas = def.q.length;
  return (
    <group position={[cx, yTop, cz]} scale={escala}>
      <Panel x0={-def.ancho / 2} x1={def.ancho / 2} y0={0} y1={6} z0={-def.fondo / 2} z1={def.fondo / 2} mat={m.vidrioNegro} />
      {def.q.map(([qx, qz, r], i) => (
        <group key={i} position={[qx, 6, qz]}>
          <Cilindro r={r + 10} largo={3} pos={[0, 1.5, 0]} mat={m.aceroCepillado} segmentos={32} sombra={false} />
          <Cilindro r={r * 0.78} largo={14} pos={[0, 8, 0]} mat={m.grisOscuro} segmentos={28} />
          <Cilindro r={r * 0.6} largo={5} pos={[0, 17, 0]} mat={m.negroMate} segmentos={28} />
          {i === 0 && (
            <mesh position={[0, 12, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.llama}>
              <torusGeometry args={[r * 0.8, 3.2, 8, 40]} />
            </mesh>
          )}
          {/* Parrilla de fierro fundido */}
          <group position={[0, 26, 0]}>
            {[0, 1, 2, 3].map((k) => {
              const a = (k * Math.PI) / 2;
              const L = r * 2.3;
              return (
                <group key={k} rotation={[0, a, 0]}>
                  <Panel x0={-L} x1={L} y0={-4} y1={4} z0={L - 5} z1={L + 5} mat={m.negroMate} sombra={false} />
                  <Panel x0={r * 0.55} x1={L} y0={-4} y1={6} z0={-4} z1={4} mat={m.negroMate} sombra={false} />
                  <Panel x0={L - 6} x1={L + 4} y0={-24} y1={4} z0={L - 5} z1={L + 5} mat={m.negroMate} sombra={false} />
                </group>
              );
            })}
          </group>
        </group>
      ))}
      {Array.from({ length: perillas }, (_, i) => (
        <group key={i} position={[def.ancho / 2 - 40 - i * 42, 6, def.fondo / 2 - 30]}>
          <Cilindro r={16} largo={16} pos={[0, 8, 0]} mat={m.negroMate} segmentos={20} />
          <Panel x0={-2.5} x1={2.5} y0={16} y1={18} z0={-14} z1={14} mat={m.acero} sombra={false} />
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
