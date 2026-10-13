// Tocador con cajoneras, cubierta y espejo (ovalado LED, Hollywood o rectangular LED).
import { MeshReflectorMaterial } from '@react-three/drei';
import { useEffect, useMemo } from 'react';
import { calcularLayoutTocador, type Rect } from '../../shared/layout';
import type { Diseno, Unidad } from '../../shared/tipos';
import { Cilindro, Panel, useMats } from './base3d';
import { Cajon, materialFrente, type ContextoFrente } from './Frentes';
import { ajustarImagenFrentes } from './texturas';

export function Tocador3D({ diseno: d, abierto, etiquetas, unidad }: { diseno: Diseno; abierto: boolean; etiquetas: boolean; unidad: Unidad }) {
  const m = useMats();
  const l = useMemo(() => calcularLayoutTocador(d), [d]);
  const t = d.espesor;
  const W = d.ancho;
  const D = d.profundidad;
  const tf = t;
  const Dc = D - tf;
  const yCub = l.cubierta.y;
  const yBajoCub = yCub - l.cubierta.espesor;
  const matFrente = materialFrente(m);
  const totalFrentes = useMemo<Rect | null>(() => {
    if (!d.imagenFrontal || !l.frentes.length) return null;
    return {
      x0: Math.min(...l.frentes.map((f) => f.rect.x0)),
      x1: Math.max(...l.frentes.map((f) => f.rect.x1)),
      y0: Math.min(...l.frentes.map((f) => f.rect.y0)),
      y1: Math.max(...l.frentes.map((f) => f.rect.y1)),
    };
  }, [d.imagenFrontal, l]);
  useEffect(() => {
    if (totalFrentes) ajustarImagenFrentes(m.imagenFrontal, totalFrentes.x1 - totalFrentes.x0, totalFrentes.y1 - totalFrentes.y0);
  }, [m.imagenFrontal, totalFrentes]);
  const ctx: ContextoFrente = {
    zFrente: Dc,
    espesor: tf,
    tirador: d.tirador,
    manillaArriba: false,
    abiertoGlobal: abierto,
    totalFrentes,
    etiquetas,
    unidad,
  };
  const izq = l.pedestales.find((p) => p.lado === 'izq');
  const der = l.pedestales.find((p) => p.lado === 'der');
  const { espejo, respaldo } = l;
  const ex = (espejo.x0 + espejo.x1) / 2;
  const ey = (espejo.y0 + espejo.y1) / 2;
  const ew = espejo.x1 - espejo.x0;
  const eh = espejo.y1 - espejo.y0;
  const zEsp = 19;

  return (
    <group>
      {/* Cubierta */}
      <Panel x0={-W / 2} x1={W / 2} y0={yBajoCub} y1={yCub} z0={0} z1={D} mat={m.frente} eje="x" />
      {/* Cajoneras */}
      {l.pedestales.map((p) => (
        <group key={p.lado}>
          <Panel x0={p.x0} x1={p.x0 + t} y0={0} y1={yBajoCub} z0={0} z1={Dc} mat={m.casco} />
          <Panel x0={p.x1 - t} x1={p.x1} y0={0} y1={yBajoCub} z0={0} z1={Dc} mat={m.casco} />
          <Panel x0={p.x0 + t} x1={p.x1 - t} y0={20} y1={20 + t} z0={0} z1={Dc} mat={m.casco} />
          <Panel x0={p.x0 + t} x1={p.x1 - t} y0={0} y1={20} z0={Dc - 30} z1={Dc - 15} mat={m.casco} />
          <Panel x0={p.x0 + t} x1={p.x1 - t} y0={20 + t} y1={yBajoCub} z0={0} z1={4} mat={m.fondo} sombra={false} />
        </group>
      ))}
      {!izq && <Panel x0={-W / 2} x1={-W / 2 + t} y0={0} y1={yBajoCub} z0={0} z1={D - 20} mat={m.casco} />}
      {!der && <Panel x0={W / 2 - t} x1={W / 2} y0={0} y1={yBajoCub} z0={0} z1={D - 20} mat={m.casco} />}
      {/* Faldón trasero y caja del cajón central */}
      <Panel x0={izq ? izq.x1 : -W / 2 + t} x1={der ? der.x0 : W / 2 - t} y0={yBajoCub - 160} y1={yBajoCub} z0={20} z1={20 + t} mat={m.casco} />
      {l.centro && (
        <Panel x0={l.centro.x0 - 2} x1={l.centro.x1 + 2} y0={l.centro.y0 - t - 3} y1={l.centro.y0 - 3} z0={20} z1={Dc} mat={m.casco} />
      )}
      {l.frentes.map((f) => {
        const ped = f.cuerpo === 0 ? izq : f.cuerpo === 2 ? der : null;
        const interior = ped ? { x0: ped.x0 + t, x1: ped.x1 - t } : { x0: f.rect.x0, x1: f.rect.x1 };
        return <Cajon key={`c${f.indice}`} frente={f} ctx={ctx} material={matFrente} interior={interior} fondoCaja={Math.max(150, Dc - 60)} />;
      })}

      {/* Respaldo y espejo */}
      <Panel x0={respaldo.x0} x1={respaldo.x1} y0={yCub} y1={respaldo.y1} z0={0} z1={18} mat={m.frente} />
      {d.tocador.espejo === 'ovalado' ? (
        <group position={[ex, ey, zEsp]}>
          <mesh scale={[ew / 2, eh / 2, 1]} position={[0, 0, 2]}>
            <circleGeometry args={[1, 72]} />
            <MaterialEspejo />
          </mesh>
          <mesh scale={[ew / 2 + 14, eh / 2 + 14, 1]} position={[0, 0, 1]} material={m.luz}>
            <circleGeometry args={[1, 72]} />
          </mesh>
        </group>
      ) : (
        <group>
          <Panel x0={espejo.x0} x1={espejo.x1} y0={espejo.y0} y1={espejo.y1} z0={zEsp} z1={zEsp + 3} mat={m.espejo} sombra={false} />
          <mesh position={[ex, ey, zEsp + 3.2]}>
            <planeGeometry args={[ew, eh]} />
            <MaterialEspejo />
          </mesh>
          {d.tocador.espejo === 'rectangular' ? (
            <>
              <Panel x0={espejo.x0 - 12} x1={espejo.x1 + 12} y0={espejo.y0 - 12} y1={espejo.y0} z0={zEsp} z1={zEsp + 2} mat={m.luz} sombra={false} />
              <Panel x0={espejo.x0 - 12} x1={espejo.x1 + 12} y0={espejo.y1} y1={espejo.y1 + 12} z0={zEsp} z1={zEsp + 2} mat={m.luz} sombra={false} />
              <Panel x0={espejo.x0 - 12} x1={espejo.x0} y0={espejo.y0} y1={espejo.y1} z0={zEsp} z1={zEsp + 2} mat={m.luz} sombra={false} />
              <Panel x0={espejo.x1} x1={espejo.x1 + 12} y0={espejo.y0} y1={espejo.y1} z0={zEsp} z1={zEsp + 2} mat={m.luz} sombra={false} />
            </>
          ) : (
            <Ampolletas espejo={espejo} z={zEsp} />
          )}
        </group>
      )}
      <pointLight position={[ex, ey, 380]} color={m.colorLuz} intensity={0.9} distance={1.8} decay={2} />

      {d.tocador.repisasLaterales && respaldo.x1 < W / 2 - 120 && (
        <RepisasLaterales x0={respaldo.x1 + 25} x1={W / 2 - 25} y0={yCub} y1={yCub + (respaldo.y1 - yCub) * 0.82} />
      )}
    </group>
  );
}

/** Espejo con reflejo real de la habitación. */
function MaterialEspejo() {
  return (
    <MeshReflectorMaterial
      mirror={0.92}
      resolution={512}
      mixBlur={0}
      mixStrength={1.1}
      blur={[0, 0]}
      color="#dfe5ea"
      metalness={0.1}
      roughness={0.06}
    />
  );
}

function Ampolletas({ espejo, z }: { espejo: { x0: number; x1: number; y0: number; y1: number }; z: number }) {
  const m = useMats();
  const pos: [number, number][] = [];
  const nV = Math.max(2, Math.round((espejo.y1 - espejo.y0) / 210));
  const nH = Math.max(2, Math.round((espejo.x1 - espejo.x0) / 230));
  for (let i = 0; i < nV; i++) {
    const y = espejo.y0 + 60 + ((espejo.y1 - espejo.y0 - 120) * i) / (nV - 1);
    pos.push([espejo.x0 - 38, y], [espejo.x1 + 38, y]);
  }
  for (let i = 1; i < nH - 1; i++) {
    const x = espejo.x0 + ((espejo.x1 - espejo.x0) * i) / (nH - 1);
    pos.push([x, espejo.y1 + 38]);
  }
  return (
    <group>
      {pos.map(([x, y], i) => (
        <group key={i} position={[x, y, z]}>
          <Cilindro r={12} largo={14} pos={[0, 0, 7]} eje="z" mat={m.acero} segmentos={16} />
          <mesh position={[0, 0, 30]} material={m.luz}>
            <sphereGeometry args={[23, 24, 16]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function RepisasLaterales({ x0, x1, y0, y1 }: { x0: number; x1: number; y0: number; y1: number }) {
  const m = useMats();
  const n = 4;
  return (
    <group>
      <Panel x0={x0} x1={x1} y0={y0} y1={y1} z0={0} z1={15} mat={m.frente} />
      {Array.from({ length: n }, (_, k) => {
        const y = y0 + ((y1 - y0) * (k + 1)) / (n + 0.4);
        return <Panel key={k} x0={x0} x1={x1} y0={y} y1={y + 15} z0={15} z1={150} mat={m.frente} eje="x" />;
      })}
    </group>
  );
}
