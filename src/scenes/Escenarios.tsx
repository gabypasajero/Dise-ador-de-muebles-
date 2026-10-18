// Escenarios que rodean al mueble según su tipo. Unidades en metros.
// El muro trasero está en z = 0 y el mueble se apoya en él, centrado en x = 0.
import { useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import { calcularLayout, calcularLayoutAereos, centroCuerpo, disenoBase, extremosPrincipal } from '../../shared/layout';
import type { Diseno, Escenario } from '../../shared/tipos';
import { texturaAlfombra, texturaAzulejo, texturaBaldosas, texturaParquet, texturaPared } from '../furniture/texturas';

// ---------- Utilidades ----------

/** Plano con UV en milímetros (para usar las texturas a escala real). */
function planoUV(w: number, h: number): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(w, h);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w * 1000, uv.getY(i) * h * 1000);
  return g;
}

function useGeo<T extends THREE.BufferGeometry>(crear: () => T, deps: unknown[]): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const g = useMemo(crear, deps);
  useEffect(() => () => g.dispose(), [g]);
  return g;
}

function Caja({
  pos,
  tam,
  color,
  rugosidad = 0.7,
  metal = 0,
  sombra = true,
  material,
}: {
  pos: [number, number, number];
  tam: [number, number, number];
  color?: string;
  rugosidad?: number;
  metal?: number;
  sombra?: boolean;
  material?: THREE.Material;
}) {
  return (
    <mesh position={pos} castShadow={sombra} receiveShadow material={material}>
      <boxGeometry args={tam} />
      {!material && <meshStandardMaterial color={color} roughness={rugosidad} metalness={metal} />}
    </mesh>
  );
}

function Piso({ textura, ancho, fondo = 9 }: { textura: THREE.Texture; ancho: number; fondo?: number }) {
  const geo = useGeo(() => planoUV(ancho, fondo), [ancho, fondo]);
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, fondo / 2]} receiveShadow>
      <meshStandardMaterial map={textura} roughness={0.55} />
    </mesh>
  );
}

function Muro({
  textura,
  ancho,
  alto = 2.7,
  pos = [0, 0, 0],
  rot = [0, 0, 0],
  color = '#ffffff',
}: {
  textura?: THREE.Texture;
  ancho: number;
  alto?: number;
  pos?: [number, number, number];
  rot?: [number, number, number];
  color?: string;
}) {
  const geo = useGeo(() => planoUV(ancho, alto), [ancho, alto]);
  return (
    <mesh geometry={geo} position={[pos[0], pos[1] + alto / 2, pos[2]]} rotation={rot} receiveShadow>
      <meshStandardMaterial map={textura} color={color} roughness={0.92} />
    </mesh>
  );
}

/** Ventana con marco, vidrio luminoso y alféizar. */
function Ventana({
  pos,
  ancho,
  alto,
  rotY = 0,
  cortinas,
}: {
  pos: [number, number, number];
  ancho: number;
  alto: number;
  rotY?: number;
  cortinas?: string;
}) {
  const marco = '#f4f3ef';
  const e = 0.05;
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[ancho, alto]} />
        <meshStandardMaterial color="#dfeefa" emissive="#cfe6fa" emissiveIntensity={0.9} roughness={0.2} />
      </mesh>
      <Caja pos={[0, alto / 2 - e / 2, 0.03]} tam={[ancho + e * 2, e, 0.06]} color={marco} />
      <Caja pos={[0, -alto / 2 + e / 2, 0.03]} tam={[ancho + e * 2, e, 0.06]} color={marco} />
      <Caja pos={[-ancho / 2, 0, 0.03]} tam={[e, alto, 0.06]} color={marco} />
      <Caja pos={[ancho / 2, 0, 0.03]} tam={[e, alto, 0.06]} color={marco} />
      <Caja pos={[0, 0, 0.03]} tam={[0.035, alto, 0.05]} color={marco} />
      <Caja pos={[0, -alto / 2 - 0.02, 0.08]} tam={[ancho + 0.16, 0.03, 0.18]} color={marco} />
      {cortinas && (
        <>
          <Cortina x={-ancho / 2 - 0.12} alto={alto + 0.45} color={cortinas} />
          <Cortina x={ancho / 2 + 0.12} alto={alto + 0.45} color={cortinas} />
          <Caja pos={[0, alto / 2 + 0.22, 0.12]} tam={[ancho + 0.9, 0.025, 0.025]} color="#b8a58a" metal={0.5} rugosidad={0.4} />
        </>
      )}
    </group>
  );
}

function Cortina({ x, alto, color }: { x: number; alto: number; color: string }) {
  const geo = useGeo(() => {
    // Tela con pliegues: plano ondulado.
    const g = new THREE.PlaneGeometry(0.42, alto, 24, 1);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 48) * 0.025);
    g.computeVertexNormals();
    return g;
  }, [alto]);
  return (
    <mesh geometry={geo} position={[x, 0.2 - 0.25, 0.13]} castShadow receiveShadow>
      <meshStandardMaterial color={color} roughness={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Planta({ pos, escala = 1 }: { pos: [number, number, number]; escala?: number }) {
  const hojas = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const a = (i / 9) * Math.PI * 2;
        const r = 0.08 + (i % 3) * 0.04;
        return [Math.cos(a) * r, 0.42 + (i % 4) * 0.09, Math.sin(a) * r, 0.11 + (i % 2) * 0.03] as const;
      }),
    [],
  );
  return (
    <group position={pos} scale={escala}>
      <mesh position={[0, 0.17, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.15, 0.11, 0.34, 28]} />
        <meshStandardMaterial color="#d9cbb7" roughness={0.8} />
      </mesh>
      {hojas.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <sphereGeometry args={[r, 14, 10]} />
          <meshStandardMaterial color={i % 2 ? '#4f7a46' : '#3f6a3a'} roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Rodapie({ ancho, color = '#f3f2ee' }: { ancho: number; color?: string }) {
  return <Caja pos={[0, 0.04, 0.007]} tam={[ancho, 0.08, 0.014]} color={color} rugosidad={0.5} />;
}

function Luces({ lado, intensidad = 2.4, color = '#fff6ea' }: { lado: number; intensidad?: number; color?: string }) {
  return (
    <>
      <hemisphereLight args={['#fffaf2', '#c9bba8', 0.55]} />
      <directionalLight
        position={[-2.8, 4.6, 4.2]}
        intensity={intensidad}
        color={color}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-lado}
        shadow-camera-right={lado}
        shadow-camera-top={3.2}
        shadow-camera-bottom={-0.5}
        shadow-camera-near={0.5}
        shadow-camera-far={14}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />
      <directionalLight position={[3, 2.5, 5]} intensity={0.45} color="#e8eefc" />
    </>
  );
}

// ---------- Escenario de cocina ----------

function posicionEncimera(d: Diseno): number | null {
  if (d.plantilla !== 'cocina' || d.cocina.encimera === 'ninguna' || !d.cuerpos.length) return null;
  const l = calcularLayout(d);
  const media = 0.32;
  const cx = centroCuerpo(l, d.cocina.encimeraCuerpo) / 1000;
  const W = d.ancho / 1000;
  return Math.max(-W / 2 + media, Math.min(W / 2 - media, cx));
}

function Campana({ x, y }: { x: number; y: number }) {
  const geo = useGeo(() => {
    const g = new THREE.CylinderGeometry(0.17, 0.43, 0.16, 4, 1);
    g.rotateY(Math.PI / 4);
    g.scale(1, 1, 0.78);
    return g;
  }, []);
  const acero = useMemo(() => new THREE.MeshStandardMaterial({ color: '#cfd2d6', metalness: 1, roughness: 0.3 }), []);
  useEffect(() => () => acero.dispose(), [acero]);
  return (
    <group position={[x, y, 0]}>
      <mesh geometry={geo} material={acero} position={[0, 0.08, 0.26]} castShadow />
      <Caja pos={[0, -0.015, 0.25]} tam={[0.6, 0.03, 0.48]} material={acero} />
      <Caja pos={[0, (2.7 - y) / 2 + 0.08, 0.13]} tam={[0.26, 2.7 - y, 0.24]} material={acero} />
    </group>
  );
}

function Refrigerador({ x }: { x: number }) {
  const acero = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9ccd0', metalness: 0.9, roughness: 0.35 }), []);
  useEffect(() => () => acero.dispose(), [acero]);
  return (
    <group position={[x, 0, 0]}>
      <Caja pos={[0, 0.93, 0.34]} tam={[0.7, 1.82, 0.66]} material={acero} />
      <Caja pos={[0, 1.24, 0.675]} tam={[0.7, 0.008, 0.01]} color="#3a3b3e" />
      <Caja pos={[-0.29, 1.5, 0.71]} tam={[0.025, 0.35, 0.03]} color="#3a3b3e" metal={0.6} rugosidad={0.4} />
      <Caja pos={[-0.29, 0.95, 0.71]} tam={[0.025, 0.35, 0.03]} color="#3a3b3e" metal={0.6} rugosidad={0.4} />
      <Caja pos={[0, 0.03, 0.34]} tam={[0.66, 0.06, 0.6]} color="#2b2b2d" />
    </group>
  );
}

function Repisa({ x, y, ancho }: { x: number; y: number; ancho: number }) {
  const madera = texturaParquet('#b48a5c', '#7e5a36');
  return (
    <group position={[x, y, 0]}>
      <mesh position={[0, 0, 0.11]} castShadow receiveShadow>
        <boxGeometry args={[ancho, 0.035, 0.22]} />
        <meshStandardMaterial map={madera} roughness={0.6} />
      </mesh>
      {[-0.28, -0.15, 0.05, 0.22].map((dx, i) =>
        Math.abs(dx) < ancho / 2 - 0.08 ? (
          <mesh key={i} position={[dx, 0.018 + (i % 2 ? 0.09 : 0.065), 0.11]} castShadow>
            <cylinderGeometry args={[i % 2 ? 0.045 : 0.06, i % 2 ? 0.045 : 0.055, i % 2 ? 0.18 : 0.13, 24]} />
            <meshStandardMaterial
              color={['#f3efe7', '#7d8f74', '#e9e4da', '#c56b47'][i]}
              roughness={i === 1 ? 0.2 : 0.5}
              transparent={i === 1}
              opacity={i === 1 ? 0.75 : 1}
            />
          </mesh>
        ) : null,
      )}
    </group>
  );
}

function EscenaCocina({ d }: { d: Diseno }) {
  const base = disenoBase(d);
  const [ex0, ex1] = extremosPrincipal(d).map((v) => v / 1000);
  const H = base.alto / 1000;
  const r = d.retorno;
  const la = calcularLayoutAereos(d);
  const mural = la?.montaje === 'mural';
  // Los aéreos pueden ser más largos que el mueble base: el refrigerador va al lado de ambos.
  const xa0 = la && mural ? Math.min(ex0, la.x0 / 1000) : ex0;
  const xa1 = la && mural ? Math.max(ex1, la.x1 / 1000) : ex1;
  const mitad = Math.max(2.8, Math.max(-xa0, xa1) + 1.7);
  const piso = texturaBaldosas('#d8d4cd', '#b9b4ab', 2, 1200);
  const pared = texturaPared('#f1ede6');
  const azulejo = texturaAzulejo('#f7f6f2', '#d9d6cf');
  const xEnc = posicionEncimera(d);
  const lav =
    d.plantilla === 'cocina' && d.cocina.lavaplatos !== 'ninguno' && d.cuerpos.length
      ? centroCuerpo(calcularLayout(d), d.cocina.lavaplatosCuerpo) / 1000
      : null;
  // Cerámica entre la cubierta y los aéreos (o 62 cm sin aéreos); el compacto ya tiene respaldo.
  const altoAz = la && mural ? Math.max(0.3, la.y0 / 1000 - H) : 0.62;
  const anchoAz = ex1 - ex0;
  const geoAz = useGeo(() => planoUV(anchoAz, altoAz), [anchoAz, altoAz]);
  // Cerámica del muro lateral: todo el retorno, desde la esquina.
  const largoL = r ? r.largo / 1000 : 0;
  const geoAzL = useGeo(() => planoUV(Math.max(0.01, largoL), altoAz), [largoL, altoAz]);
  // Muros laterales: la L se apoya en uno de ellos.
  const xMuroIzq = r?.lado === 'izq' ? ex0 : -mitad;
  const xMuroDer = r?.lado === 'der' ? ex1 : null;
  const zL = largoL / 2;
  const xRefri = r?.lado === 'der' ? xa0 - 0.05 - 0.35 : xa1 + 0.05 + 0.35;
  return (
    <group>
      <Luces lado={mitad} />
      <Piso textura={piso} ancho={mitad * 2 + 6} />
      <Muro textura={pared} ancho={mitad * 2 + 6} />
      {d.plantilla !== 'compacto' && (
        <mesh geometry={geoAz} position={[(ex0 + ex1) / 2, H + altoAz / 2, 0.002]} receiveShadow>
          <meshStandardMaterial map={azulejo} roughness={0.18} />
        </mesh>
      )}
      {r && largoL > 0 && (
        <mesh
          geometry={geoAzL}
          position={[r.lado === 'der' ? ex1 - 0.002 : ex0 + 0.002, H + altoAz / 2, zL]}
          rotation={[0, r.lado === 'der' ? -Math.PI / 2 : Math.PI / 2, 0]}
          receiveShadow
        >
          <meshStandardMaterial map={azulejo} roughness={0.18} />
        </mesh>
      )}
      <Muro textura={pared} ancho={6} pos={[xMuroIzq, 0, 3]} rot={[0, Math.PI / 2, 0]} />
      {xMuroDer !== null && <Muro textura={pared} ancho={6} pos={[xMuroDer, 0, 3]} rot={[0, -Math.PI / 2, 0]} />}
      <Ventana
        pos={[xMuroIzq + 0.005, 1.45, r?.lado === 'izq' ? Math.max(1.6, r.largo / 1000 + 0.8) : 1.6]}
        ancho={1.1}
        alto={1.1}
        rotY={Math.PI / 2}
      />
      {!la && xEnc !== null && <Campana x={xEnc} y={H + 0.68} />}
      {!la && lav !== null && (xEnc === null || Math.abs(lav - xEnc) > 0.85) && <Repisa x={lav} y={H + 0.95} ancho={0.8} />}
      <Refrigerador x={xRefri} />
      {/* Con la L derecha la planta va junto al refrigerador, sin pasar el muro izquierdo. */}
      {r?.lado !== 'izq' && <Planta pos={[r?.lado === 'der' ? xRefri - 0.35 - 0.4 : ex0 - 1.25, 0, 0.28]} escala={0.85} />}
    </group>
  );
}

// ---------- Dormitorio ----------

function Cama({ x, ancho, color, colorFunda, z0 = 0 }: { x: number; ancho: number; color: string; colorFunda: string; z0?: number }) {
  const largo = 1.95;
  return (
    <group position={[x, 0, z0]}>
      <Caja pos={[0, 0.17, largo / 2]} tam={[ancho, 0.3, largo]} color={color} rugosidad={0.95} />
      <Caja pos={[0, 0.42, largo / 2 + 0.01]} tam={[ancho - 0.04, 0.2, largo - 0.04]} color="#f6f4ef" rugosidad={0.95} />
      <Caja pos={[0, 0.53, largo / 2 + 0.25]} tam={[ancho + 0.03, 0.07, largo - 0.5]} color={colorFunda} rugosidad={1} />
      <Caja pos={[0, 0.555, 0.88 + 0.32]} tam={[ancho + 0.035, 0.03, 0.22]} color="#f3f0ea" rugosidad={1} />
      <Caja pos={[0, 0.75, 0.04]} tam={[ancho + 0.08, 1.05, 0.08]} color={color} rugosidad={0.95} />
      {(ancho > 1.1 ? [-ancho / 4, ancho / 4] : [0]).map((px) => (
        <mesh key={px} position={[px, 0.6, 0.3]} scale={[ancho > 1.1 ? 0.28 : 0.32, 0.09, 0.17]} castShadow>
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color="#fbfaf7" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

function Velador({ x }: { x: number }) {
  return (
    <group position={[x, 0, 0]}>
      <Caja pos={[0, 0.27, 0.2]} tam={[0.44, 0.5, 0.38]} color="#e9e4dc" rugosidad={0.6} />
      <Caja pos={[0, 0.53, 0.2]} tam={[0.46, 0.025, 0.4]} color="#b48a5c" rugosidad={0.6} />
      <mesh position={[0, 0.62, 0.2]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.16, 20]} />
        <meshStandardMaterial color="#c9b79c" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.78, 0.2]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 0.17, 28, 1, true]} />
        <meshStandardMaterial color="#fff3df" emissive="#ffe2b0" emissiveIntensity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <pointLight position={[0, 0.8, 0.25]} color="#ffd9a0" intensity={1.2} distance={2.5} decay={2} />
    </group>
  );
}

function Cuadro({ pos, ancho, alto, colores }: { pos: [number, number, number]; ancho: number; alto: number; colores: string[] }) {
  return (
    <group position={pos}>
      <Caja pos={[0, 0, 0.015]} tam={[ancho, alto, 0.03]} color="#2e2a26" rugosidad={0.5} />
      <Caja pos={[0, 0, 0.031]} tam={[ancho - 0.06, alto - 0.06, 0.002]} color={colores[0]} sombra={false} />
      <mesh position={[-ancho * 0.12, -alto * 0.05, 0.034]}>
        <circleGeometry args={[Math.min(ancho, alto) * 0.22, 40]} />
        <meshStandardMaterial color={colores[1]} roughness={0.9} />
      </mesh>
      <Caja pos={[ancho * 0.12, -alto * 0.18, 0.034]} tam={[ancho * 0.35, alto * 0.3, 0.002]} color={colores[2]} sombra={false} />
    </group>
  );
}

function Alfombra({ pos, ancho, largo, textura, redonda }: { pos: [number, number, number]; ancho: number; largo: number; textura: THREE.Texture; redonda?: boolean }) {
  return (
    <mesh position={pos} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      {redonda ? <circleGeometry args={[ancho / 2, 64]} /> : <planeGeometry args={[ancho, largo]} />}
      <meshStandardMaterial map={textura} roughness={1} />
    </mesh>
  );
}

function Pouf({ pos, color }: { pos: [number, number, number]; color: string }) {
  return (
    <group position={pos}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.2, 0.2, 0.14, 32]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      {[0, 1, 2, 3].map((k) => {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={k} position={[Math.cos(a) * 0.14, 0.12, Math.sin(a) * 0.14]} castShadow>
            <cylinderGeometry args={[0.012, 0.012, 0.24, 8]} />
            <meshStandardMaterial color="#c9a45c" metalness={1} roughness={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}

function EscenaDormitorio({ d }: { d: Diseno }) {
  const W = d.ancho / 1000;
  const mitad = Math.max(3.2, W / 2 + 2.6);
  const piso = texturaParquet('#c8a27a', '#946f4a');
  const pared = texturaPared('#e9e2d8');
  const alfombra = texturaAlfombra('#e8e1d6', '#d3c6b4', '#b9a991');
  const xCama = -W / 2 - 0.6 - 0.75;
  return (
    <group>
      <Luces lado={mitad} intensidad={2.2} />
      <Piso textura={piso} ancho={mitad * 2 + 6} />
      <Muro textura={pared} ancho={mitad * 2 + 6} />
      <Rodapie ancho={mitad * 2 + 6} />
      <Cama x={xCama} ancho={1.5} color="#b9b2a8" colorFunda="#8c9a8e" />
      <Alfombra pos={[xCama + 0.2, 0.004, 1.6]} ancho={2.3} largo={1.6} textura={alfombra} />
      <Velador x={-W / 2 - 0.36} />
      <Cuadro pos={[xCama, 1.62, 0]} ancho={0.9} alto={0.6} colores={['#efe9df', '#c88f6b', '#8a9d8a']} />
      <Ventana pos={[W / 2 + 1.05, 1.5, 0]} ancho={1.0} alto={1.2} cortinas="#efe8dc" />
      {d.plantilla === 'tocador' && <Pouf pos={[0, 0, d.profundidad / 1000 + 0.32]} color="#e3bfc0" />}
      <Planta pos={[W / 2 + 1.95, 0, 0.3]} escala={0.9} />
    </group>
  );
}

// ---------- Dormitorio infantil ----------

function Estrella({ pos, r, color }: { pos: [number, number, number]; r: number; color: string }) {
  const geo = useGeo(() => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      const rr = i % 2 ? r * 0.45 : r;
      if (i === 0) s.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
      else s.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, [r]);
  return (
    <mesh geometry={geo} position={pos}>
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

function Bloques({ pos }: { pos: [number, number, number] }) {
  const colores = ['#f2a65a', '#6ab0de', '#f28b9b', '#8fd18a', '#f6d860'];
  return (
    <group position={pos}>
      {colores.map((c, i) => (
        <Caja
          key={i}
          pos={[(i % 3) * 0.09 - 0.09, 0.035 + (i >= 3 ? 0.07 : 0), Math.floor(i / 3) * 0.02]}
          tam={[0.07, 0.07, 0.07]}
          color={c}
          rugosidad={0.5}
        />
      ))}
    </group>
  );
}

function Silla({ pos }: { pos: [number, number, number] }) {
  return (
    <group position={pos}>
      <Caja pos={[0, 0.34, 0]} tam={[0.34, 0.03, 0.32]} color="#f1f0ec" rugosidad={0.5} />
      <Caja pos={[0, 0.56, -0.15]} tam={[0.34, 0.2, 0.025]} color="#f2a6b5" rugosidad={0.5} />
      {[
        [-0.15, -0.14],
        [0.15, -0.14],
        [-0.15, 0.14],
        [0.15, 0.14],
      ].map(([x, z], i) => (
        <Caja key={i} pos={[x, 0.165, z]} tam={[0.025, 0.33, 0.025]} color="#d9c3a5" />
      ))}
    </group>
  );
}

function EscenaInfantil({ d }: { d: Diseno }) {
  const W = d.ancho / 1000;
  const mitad = Math.max(3, W / 2 + 2.3);
  const piso = texturaParquet('#d8bc98', '#a98a63');
  const paredAlta = texturaPared('#f4ece4');
  const alfombra = texturaAlfombra('#f6e7d8', '#f2b8c6', '#9fd1d9');
  const xCama = -W / 2 - 0.55 - 0.48;
  const escritorio = d.cuerpos.findIndex((c) => c.tipo === 'escritorio');
  let xSilla: number | null = null;
  if (escritorio >= 0 && d.plantilla === 'escritorio') {
    const l = calcularLayout(d);
    xSilla = centroCuerpo(l, escritorio) / 1000;
  }
  return (
    <group>
      <Luces lado={mitad} intensidad={2.2} />
      <Piso textura={piso} ancho={mitad * 2 + 6} />
      <Muro textura={paredAlta} ancho={mitad * 2 + 6} pos={[0, 1.0, 0]} alto={1.7} />
      <Muro ancho={mitad * 2 + 6} alto={1.0} color="#bfdcd2" pos={[0, 0, 0.001]} />
      <Caja pos={[0, 1.0, 0.012]} tam={[mitad * 2 + 6, 0.035, 0.024]} color="#f7f4ee" rugosidad={0.5} />
      <Rodapie ancho={mitad * 2 + 6} />
      <Cama x={xCama} ancho={0.96} color="#f0e3d3" colorFunda="#f2b8c6" />
      <Alfombra pos={[0.1, 0.004, d.profundidad / 1000 + 0.75]} ancho={1.6} largo={1.6} textura={alfombra} redonda />
      <Bloques pos={[0.75, 0.005, d.profundidad / 1000 + 0.7]} />
      {xSilla !== null && <Silla pos={[xSilla, 0, d.profundidad / 1000 + 0.12]} />}
      {[
        [xCama - 0.3, 1.75, '#f6d860', 0.08],
        [xCama + 0.1, 1.95, '#f2a6b5', 0.06],
        [xCama + 0.42, 1.68, '#9fd1d9', 0.07],
        [W / 2 + 0.6, 2.05, '#f6d860', 0.07],
        [W / 2 + 0.95, 1.8, '#f2a6b5', 0.05],
      ].map(([x, y, c, r], i) => (
        <Estrella key={i} pos={[x as number, y as number, 0.004]} r={r as number} color={c as string} />
      ))}
      <Planta pos={[W / 2 + 1.5, 0, 0.3]} escala={0.8} />
    </group>
  );
}

// ---------- Estudio neutro ----------

function EscenaEstudio() {
  // Fondo curvo tipo estudio fotográfico. Queda detrás del mueble (que se apoya en z = 0):
  // la curva va de z = -0,15 (piso) a z = -1,35 (muro) para no taparlo.
  const radio = 1.2;
  const zPiso = -0.15;
  const geo = useGeo(() => {
    const g = new THREE.CylinderGeometry(radio, radio, 14, 32, 1, true, Math.PI, Math.PI / 2);
    g.rotateZ(Math.PI / 2);
    return g;
  }, []);
  return (
    <group>
      <Luces lado={4} intensidad={2.0} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, zPiso + 4]} receiveShadow>
        <planeGeometry args={[14, 8]} />
        <meshStandardMaterial color="#ecebe8" roughness={0.9} />
      </mesh>
      <mesh geometry={geo} position={[0, radio, zPiso]} receiveShadow>
        <meshStandardMaterial color="#ecebe8" roughness={0.9} side={THREE.BackSide} />
      </mesh>
      <mesh position={[0, radio + 2.3, zPiso - radio]} receiveShadow>
        <planeGeometry args={[14, 4.6]} />
        <meshStandardMaterial color="#ecebe8" roughness={0.9} />
      </mesh>
    </group>
  );
}

export function Escenario3D({ tipo, diseno }: { tipo: Escenario; diseno: Diseno }): ReactNode {
  switch (tipo) {
    case 'cocina':
      return <EscenaCocina d={diseno} />;
    case 'dormitorio':
      return <EscenaDormitorio d={diseno} />;
    case 'infantil':
      return <EscenaInfantil d={diseno} />;
    default:
      return <EscenaEstudio />;
  }
}
