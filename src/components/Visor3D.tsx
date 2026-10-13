import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import { Mueble3D } from '../furniture/Mueble3D';
import { Escenario3D } from '../scenes/Escenarios';
import { escenarioActual, useApp, type Vista } from '../store/useApp';
import { cuerposDe, nombreModulo } from '../../shared/reglas';
import { dimensionesTotales } from '../../shared/layout';
import type { Diseno } from '../../shared/tipos';

function Entorno() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.42;
    return () => {
      scene.environment = null;
      env.dispose();
      pmrem.dispose();
    };
  }, [gl, scene]);
  return null;
}

const ANGULOS: Record<Vista, { az: number; el: number }> = {
  perspectiva: { az: -0.5, el: 0.3 },
  frontal: { az: 0, el: 0.1 },
  superior: { az: -0.18, el: 1.0 },
};

function objetivoCamara(d: Diseno, vista: Vista, aspecto: number) {
  // En los dormitorios la cama queda a la izquierda: la cámara mira desde la derecha.
  const s = useApp.getState();
  const lado = escenarioActual(s.escenario, s.producto, d) === 'cocina' ? 1 : -0.85;
  // Todo el conjunto: tramo principal, L y aéreos.
  const caja = dimensionesTotales(d);
  const W = (caja.x1 - caja.x0) / 1000;
  const H = caja.alto / 1000 + (d.plantilla === 'comoda' && d.mudador ? 0.1 : 0);
  const D = caja.fondo / 1000;
  const cx = (caja.x0 + caja.x1) / 2000;
  const objetivo = new THREE.Vector3(cx, H * 0.53, Math.min(D, 0.7) * 0.55);
  const fov = THREE.MathUtils.degToRad(38);
  // Distancia justa para que entren ancho (con cotas) y alto: el mueble se ve grande.
  const anchoVisible = W + (aspecto < 1 ? 0.2 : 0.4);
  const altoVisible = H + 0.42;
  const distV = altoVisible / 2 / Math.tan(fov / 2);
  const distH = anchoVisible / 2 / Math.tan(fov / 2) / Math.max(0.5, aspecto);
  const dist = Math.max(distV, distH, 1.1) * 1.04 + Math.min(D, 1.2) * 0.8;
  const { el } = ANGULOS[vista];
  const az = ANGULOS[vista].az * lado;
  const pos = new THREE.Vector3(
    cx + Math.sin(az) * Math.cos(el) * dist,
    objetivo.y + Math.sin(el) * dist,
    objetivo.z + Math.cos(az) * Math.cos(el) * dist,
  );
  return { objetivo, pos };
}

function Camara() {
  const controles = useRef<OrbitImpl>(null);
  const { camera, size } = useThree();
  const encuadre = useApp((s) => s.encuadre);
  const vista = useApp((s) => s.vista);
  const escenario = useApp((s) => s.escenario);
  const animando = useRef(0);
  const destino = useRef<{ objetivo: THREE.Vector3; pos: THREE.Vector3 } | null>(null);

  useEffect(() => {
    const d = useApp.getState().diseno;
    destino.current = objetivoCamara(d, vista, size.width / Math.max(1, size.height));
    animando.current = 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encuadre, vista, escenario]);

  // Reencuadra si el mueble cambia mucho de tamaño.
  // Tamaño de todo el conjunto (incluye la L y los aéreos).
  const ancho = useApp((s) => {
    const c = dimensionesTotales(s.diseno);
    return c.x1 - c.x0;
  });
  const alto = useApp((s) => dimensionesTotales(s.diseno).alto);
  const fondo = useApp((s) => dimensionesTotales(s.diseno).fondo);
  const previo = useRef({ ancho, alto, fondo });
  useEffect(() => {
    const p = previo.current;
    if (Math.abs(ancho - p.ancho) / p.ancho > 0.18 || Math.abs(alto - p.alto) / p.alto > 0.18 || Math.abs(fondo - p.fondo) / p.fondo > 0.3) {
      previo.current = { ancho, alto, fondo };
      destino.current = objetivoCamara(useApp.getState().diseno, useApp.getState().vista, size.width / Math.max(1, size.height));
      animando.current = 1;
    }
  }, [ancho, alto, fondo, size]);

  useFrame((_, dt) => {
    const c = controles.current;
    if (!c || !destino.current || animando.current <= 0) return;
    const k = 1 - Math.exp(-dt * 5);
    camera.position.lerp(destino.current.pos, k);
    c.target.lerp(destino.current.objetivo, k);
    c.update();
    animando.current -= dt / 1.4;
  });

  return (
    <OrbitControls
      ref={controles}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={0.5}
      maxDistance={9}
      minPolarAngle={0.12}
      maxPolarAngle={Math.PI / 2 - 0.03}
      minAzimuthAngle={-1.3}
      maxAzimuthAngle={1.3}
      onStart={() => (animando.current = 0)}
    />
  );
}

/** Registra la función para capturar una miniatura del visor. */
function Capturador() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    useApp.getState().set({
      capturar: () => {
        const ocultas: THREE.Object3D[] = [];
        scene.traverse((o) => {
          if ((o.name === 'cotas' || o.name === 'ayudas') && o.visible) ocultas.push(o);
        });
        ocultas.forEach((o) => (o.visible = false));
        gl.render(scene, camera);
        ocultas.forEach((o) => (o.visible = true));
        const origen = gl.domElement;
        const escala = 480 / origen.width;
        const c = document.createElement('canvas');
        c.width = 480;
        c.height = Math.round(origen.height * escala);
        c.getContext('2d')!.drawImage(origen, 0, 0, c.width, c.height);
        return c.toDataURL('image/jpeg', 0.82);
      },
    });
    return () => useApp.getState().set({ capturar: null });
  }, [gl, scene, camera]);
  return null;
}

export function Visor3D() {
  const diseno = useApp((s) => s.diseno);
  const materiales = useApp((s) => s.materiales);
  const producto = useApp((s) => s.producto);
  const escenario = useApp((s) => s.escenario);
  const abierto = useApp((s) => s.abierto);
  const cotas = useApp((s) => s.cotas);
  const unidad = useApp((s) => s.unidad);
  const pestana = useApp((s) => s.pestana);
  const moduloActivo = useApp((s) => s.moduloActivo);
  const tramoActivo = useApp((s) => s.tramoActivo);
  const modulos = useMemo(() => {
    if (pestana !== 'modulos') return null;
    const cs = cuerposDe(diseno, tramoActivo);
    return {
      tramo: tramoActivo,
      activo: moduloActivo,
      nombre: (i: number) => (cs[i] ? nombreModulo(cs[i]) : ''),
      onElegir: (i: number) => useApp.getState().set({ moduloActivo: i }),
    };
  }, [pestana, moduloActivo, tramoActivo, diseno]);
  const tipoEscena = escenarioActual(escenario, producto, diseno);
  const etiquetasFrentes = pestana === 'puertas' || pestana === 'cajones';

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      camera={{ fov: 38, near: 0.03, far: 60, position: [-1.6, 1.6, 3.2] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
      }}
      onPointerMissed={() => (document.body.style.cursor = '')}
    >
      <color attach="background" args={['#f3f1ee']} />
      <Entorno />
      <Suspense fallback={null}>
        <Escenario3D tipo={tipoEscena} diseno={diseno} />
        <Mueble3D diseno={diseno} materiales={materiales} vista={{ abierto, cotas, etiquetasFrentes, unidad, modulos }} />
      </Suspense>
      <Camara />
      <Capturador />
    </Canvas>
  );
}
