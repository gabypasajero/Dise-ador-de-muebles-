// Puertas, cajones y tiradores, con apertura animada.
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { Frente, Rect } from '../../shared/layout';
import { formatear } from '../../shared/reglas';
import type { TipoTirador, Unidad } from '../../shared/tipos';
import { Cilindro, Panel, useMats } from './base3d';

const LARGOS_BARRA = [96, 128, 160, 192, 256, 320, 448];

function largoBarra(espacio: number): number {
  const ideal = espacio * 0.42;
  return LARGOS_BARRA.reduce((a, b) => (Math.abs(b - ideal) < Math.abs(a - ideal) ? b : a));
}

function amortiguar(actual: number, objetivo: number, velocidad: number, dt: number): number {
  return actual + (objetivo - actual) * (1 - Math.exp(-velocidad * Math.min(dt, 0.1)));
}

export interface ContextoFrente {
  zFrente: number;
  espesor: number;
  tirador: TipoTirador;
  /** Cocina baja: tiradores de puertas arriba. */
  manillaArriba: boolean;
  /** Muebles aéreos: tiradores de puertas abajo. */
  manillaAbajo?: boolean;
  abiertoGlobal: boolean;
  /** Rectángulo de todos los frentes, para imprimir la imagen del cliente. */
  totalFrentes: Rect | null;
  etiquetas: boolean;
  unidad: Unidad;
}

// ---------- Tiradores ----------

export function Tirador({
  tipo,
  x,
  y,
  z,
  vertical,
  espacio,
}: {
  tipo: TipoTirador;
  x: number;
  y: number;
  z: number;
  vertical: boolean;
  espacio: number;
}) {
  const m = useMats();
  if (tipo === 'sin') return null;
  if (tipo === 'boton') {
    return (
      <group position={[x, y, z]}>
        <Cilindro r={7} largo={16} pos={[0, 0, 8]} eje="z" mat={m.tirador} segmentos={16} />
        <mesh position={[0, 0, 22]} scale={[1, 1, 0.7]} material={m.tirador} castShadow>
          <sphereGeometry args={[15, 24, 16]} />
        </mesh>
      </group>
    );
  }
  if (tipo === 'unero') {
    const largo = espacio;
    return vertical ? (
      <Panel x0={x - 8} x1={x + 8} y0={y - largo / 2} y1={y + largo / 2} z0={z} z1={z + 14} mat={m.tirador} sombra={false} />
    ) : (
      <Panel x0={x - largo / 2} x1={x + largo / 2} y0={y - 9} y1={y + 9} z0={z} z1={z + 14} mat={m.tirador} sombra={false} />
    );
  }
  // Barra
  const largo = largoBarra(espacio);
  const sep = 30;
  return (
    <group position={[x, y, z]}>
      {vertical ? (
        <>
          <Cilindro r={6} largo={largo + 40} pos={[0, 0, sep]} mat={m.tirador} segmentos={16} />
          <Cilindro r={4.5} largo={sep} pos={[0, largo / 2, sep / 2]} eje="z" mat={m.tirador} segmentos={12} />
          <Cilindro r={4.5} largo={sep} pos={[0, -largo / 2, sep / 2]} eje="z" mat={m.tirador} segmentos={12} />
        </>
      ) : (
        <>
          <Cilindro r={6} largo={largo + 40} pos={[0, 0, sep]} eje="x" mat={m.tirador} segmentos={16} />
          <Cilindro r={4.5} largo={sep} pos={[largo / 2, 0, sep / 2]} eje="z" mat={m.tirador} segmentos={12} />
          <Cilindro r={4.5} largo={sep} pos={[-largo / 2, 0, sep / 2]} eje="z" mat={m.tirador} segmentos={12} />
        </>
      )}
    </group>
  );
}

function EtiquetaFrente({ rect, z, unidad }: { rect: Rect; z: number; unidad: Unidad }) {
  const w = rect.x1 - rect.x0;
  const h = rect.y1 - rect.y0;
  return (
    <Html position={[(rect.x0 + rect.x1) / 2, (rect.y0 + rect.y1) / 2, z + 40]} center zIndexRange={[20, 0]}>
      <div className="etiqueta-frente">
        {formatear(w, unidad, false)} × {formatear(h, unidad)}
      </div>
    </Html>
  );
}

function usarClic(): [boolean | null, (e: ThreeEvent<MouseEvent>) => void, (e: ThreeEvent<PointerEvent>) => void, () => void] {
  const [local, setLocal] = useState<boolean | null>(null);
  const alClic = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setLocal((v) => !(v ?? false));
  };
  const sobre = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
  };
  const fuera = () => (document.body.style.cursor = '');
  return [local, alClic, sobre, fuera];
}

// ---------- Puerta ----------

export function Puerta({
  frente,
  ctx,
  material,
  children,
}: {
  frente: Extract<Frente, { tipo: 'puerta' }>;
  ctx: ContextoFrente;
  material: THREE.Material | THREE.Material[];
  children?: ReactNode;
}) {
  const ref = useRef<THREE.Group>(null);
  const [local, alClic, sobre, fuera] = usarClic();
  const abierto = local ?? ctx.abiertoGlobal;
  const { rect } = frente;
  const arriba = frente.bisagra === 'arriba';
  const izq = frente.bisagra === 'izq';
  const pivX = arriba ? 0 : izq ? rect.x0 : rect.x1;
  const pivY = arriba ? rect.y1 : 0;
  const zCara = ctx.zFrente + ctx.espesor;
  useFrame((_, dt) => {
    if (!ref.current) return;
    if (arriba) {
      // Abatible: gira sobre el borde superior hacia arriba.
      ref.current.rotation.x = amortiguar(ref.current.rotation.x, abierto ? -THREE.MathUtils.degToRad(80) : 0, 5, dt);
      return;
    }
    const objetivo = abierto ? (izq ? -1 : 1) * THREE.MathUtils.degToRad(100) : 0;
    ref.current.rotation.y = amortiguar(ref.current.rotation.y, objetivo, 5, dt);
  });
  const ancho = rect.x1 - rect.x0;
  const alto = rect.y1 - rect.y0;
  if (arriba) {
    return (
      <group ref={ref} position={[0, pivY, zCara]}>
        <group position={[0, -pivY, -zCara]} onClick={alClic} onPointerOver={sobre} onPointerOut={fuera}>
          <Panel x0={rect.x0} x1={rect.x1} y0={rect.y0} y1={rect.y1} z0={ctx.zFrente} z1={zCara} mat={material} eje="x" />
          {ctx.tirador === 'unero' ? (
            <Tirador tipo="unero" x={(rect.x0 + rect.x1) / 2} y={rect.y0 + 9} z={zCara} vertical={false} espacio={ancho} />
          ) : (
            <Tirador tipo={ctx.tirador} x={(rect.x0 + rect.x1) / 2} y={rect.y0 + Math.min(45, alto / 4)} z={zCara} vertical={false} espacio={Math.min(ancho, 700)} />
          )}
          {children}
        </group>
        {ctx.etiquetas && (
          <group position={[0, -pivY, -zCara]}>
            <EtiquetaFrente rect={rect} z={zCara} unidad={ctx.unidad} />
          </group>
        )}
      </group>
    );
  }
  const xT = izq ? rect.x1 - 38 : rect.x0 + 38;
  let yT: number;
  const largo = largoBarra(Math.min(alto, 700));
  if (ctx.manillaArriba) yT = rect.y1 - 45 - (ctx.tirador === 'barra' ? largo / 2 : 0);
  else if (ctx.manillaAbajo) yT = rect.y0 + 45 + (ctx.tirador === 'barra' ? largo / 2 : 0);
  else yT = Math.min(rect.y1 - largo / 2 - 60, Math.max(rect.y0 + largo / 2 + 60, 1000));
  if (alto < 500 && !ctx.manillaArriba && !ctx.manillaAbajo) yT = (rect.y0 + rect.y1) / 2;
  return (
    <group ref={ref} position={[pivX, 0, zCara]}>
      <group position={[-pivX, 0, -zCara]} onClick={alClic} onPointerOver={sobre} onPointerOut={fuera}>
        <Panel
          x0={rect.x0}
          x1={rect.x1}
          y0={rect.y0}
          y1={rect.y1}
          z0={ctx.zFrente}
          z1={zCara}
          mat={material}
          uvFrente={ctx.totalFrentes && Array.isArray(material) ? { pieza: rect, total: ctx.totalFrentes } : undefined}
        />
        {ctx.tirador === 'unero' ? (
          <Tirador tipo="unero" x={(rect.x0 + rect.x1) / 2} y={rect.y1 - 9} z={zCara} vertical={false} espacio={ancho} />
        ) : (
          <Tirador tipo={ctx.tirador} x={xT} y={yT} z={zCara} vertical espacio={Math.min(alto, 700)} />
        )}
        {children}
      </group>
      {ctx.etiquetas && (
        <group position={[-pivX, 0, -zCara]}>
          <EtiquetaFrente rect={rect} z={zCara} unidad={ctx.unidad} />
        </group>
      )}
    </group>
  );
}

// ---------- Cajón ----------

export function Cajon({
  frente,
  ctx,
  material,
  interior,
  fondoCaja,
}: {
  frente: Extract<Frente, { tipo: 'cajon' }>;
  ctx: ContextoFrente;
  material: THREE.Material | THREE.Material[];
  /** Límites interiores del casco para dimensionar la caja del cajón. */
  interior: { x0: number; x1: number };
  fondoCaja: number;
}) {
  const m = useMats();
  const ref = useRef<THREE.Group>(null);
  const [local, alClic, sobre, fuera] = usarClic();
  const abierto = local ?? ctx.abiertoGlobal;
  const { rect } = frente;
  const zCara = ctx.zFrente + ctx.espesor;
  const recorrido = Math.min(420, fondoCaja * 0.75);
  useFrame((_, dt) => {
    if (!ref.current) return;
    ref.current.position.z = amortiguar(ref.current.position.z, abierto ? recorrido : 0, 5, dt);
  });
  const ancho = rect.x1 - rect.x0;
  const alto = rect.y1 - rect.y0;
  // Caja del cajón (lados de 12 mm) dentro del casco.
  const cx0 = Math.max(interior.x0, rect.x0) + 14;
  const cx1 = Math.min(interior.x1, rect.x1) - 14;
  const cy0 = rect.y0 + 18;
  const cy1 = Math.max(cy0 + 40, rect.y1 - 35);
  const cz0 = ctx.zFrente - fondoCaja;
  const cz1 = ctx.zFrente - 1;
  const g = 12;
  const yT = alto > 260 ? rect.y1 - alto * 0.28 : (rect.y0 + rect.y1) / 2;
  const dosBotones = ctx.tirador === 'boton' && ancho > 650;
  return (
    <group ref={ref}>
      <group onClick={alClic} onPointerOver={sobre} onPointerOut={fuera}>
        <Panel
          x0={rect.x0}
          x1={rect.x1}
          y0={rect.y0}
          y1={rect.y1}
          z0={ctx.zFrente}
          z1={zCara}
          mat={material}
          eje="x"
          uvFrente={ctx.totalFrentes && Array.isArray(material) ? { pieza: rect, total: ctx.totalFrentes } : undefined}
        />
        {cx1 - cx0 > 60 && fondoCaja > 80 && (
          <>
            <Panel x0={cx0} x1={cx1} y0={cy0} y1={cy0 + g} z0={cz0} z1={cz1} mat={m.casco} sombra={false} />
            <Panel x0={cx0} x1={cx0 + g} y0={cy0} y1={cy1} z0={cz0} z1={cz1} mat={m.casco} sombra={false} />
            <Panel x0={cx1 - g} x1={cx1} y0={cy0} y1={cy1} z0={cz0} z1={cz1} mat={m.casco} sombra={false} />
            <Panel x0={cx0} x1={cx1} y0={cy0} y1={cy1} z0={cz0} z1={cz0 + g} mat={m.casco} sombra={false} />
          </>
        )}
        {ctx.tirador === 'unero' ? (
          <Tirador tipo="unero" x={(rect.x0 + rect.x1) / 2} y={rect.y1 - 9} z={zCara} vertical={false} espacio={ancho} />
        ) : dosBotones ? (
          <>
            <Tirador tipo="boton" x={rect.x0 + ancho / 4} y={yT} z={zCara} vertical={false} espacio={ancho} />
            <Tirador tipo="boton" x={rect.x1 - ancho / 4} y={yT} z={zCara} vertical={false} espacio={ancho} />
          </>
        ) : (
          <Tirador tipo={ctx.tirador} x={(rect.x0 + rect.x1) / 2} y={yT} z={zCara} vertical={false} espacio={Math.min(ancho, 700)} />
        )}
      </group>
      {ctx.etiquetas && <EtiquetaFrente rect={rect} z={zCara} unidad={ctx.unidad} />}
    </group>
  );
}

/** Material del frente: con imagen del cliente se usa un arreglo (cara frontal impresa). */
export function materialFrente(m: ReturnType<typeof useMats>): THREE.Material | THREE.Material[] {
  if (!m.imagenFrontal) return m.frente;
  return [m.frente, m.frente, m.frente, m.frente, m.imagenFrontal, m.frente];
}
