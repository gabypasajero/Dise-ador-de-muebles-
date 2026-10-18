import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { OrbitControls as OrbitImpl } from 'three-stdlib';
import { Mueble3D } from '../furniture/Mueble3D';
import { Escenario3D } from '../scenes/Escenarios';
import { escenarioActual, useApp, type Vista } from '../store/useApp';
import { cuerposDe, nombreModulo } from '../../shared/reglas';
import { dimensionesTotales, extremosPrincipal } from '../../shared/layout';
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

function objetivoCamara(d: Diseno, vista: Vista, size: { width: number; height: number }) {
  const aspecto = size.width / Math.max(1, size.height);
  // En los dormitorios la cama queda a la izquierda: la cámara mira desde la derecha.
  // En la cocina en L mira desde el lado abierto, de frente a las puertas del retorno.
  const s = useApp.getState();
  const r = d.retorno;
  const lado = r ? (r.lado === 'izq' ? -1 : 1) : escenarioActual(s.escenario, s.producto, d) === 'cocina' ? 1 : -0.85;
  // Todo el conjunto: tramo principal, L y aéreos.
  const caja = dimensionesTotales(d);
  const W = (caja.x1 - caja.x0) / 1000;
  const H = caja.alto / 1000 + (d.plantilla === 'comoda' && d.mudador ? 0.1 : 0);
  const D = caja.fondo / 1000;
  const cx = (caja.x0 + caja.x1) / 2000;
  // En la L el objetivo va a la mitad del retorno, que puede ser mucho más profundo que el mueble.
  const objetivo = new THREE.Vector3(cx, H * 0.53, r ? D / 2 : Math.min(D, 0.7) * 0.55);
  const fov = THREE.MathUtils.degToRad(38);
  // Distancia justa para que entren ancho (con cotas) y alto: el mueble se ve grande.
  const anchoVisible = W + (aspecto < 1 ? 0.2 : 0.4);
  const altoVisible = H + 0.42;
  const distV = altoVisible / 2 / Math.tan(fov / 2);
  const distH = anchoVisible / 2 / Math.tan(fov / 2) / Math.max(0.5, aspecto);
  // En la L se parte más cerca y el ajuste de abajo aleja la cámara solo lo necesario: el retorno puede ser muy profundo.
  const inicio = r ? Math.max(distV, distH, 1.1) * 0.6 : Math.max(distV, distH, 1.1) * 1.04 + Math.min(D, 1.2) * 0.8;
  let dist = inicio;
  const { el } = ANGULOS[vista];
  const az = ANGULOS[vista].az * lado;
  const posicion = () =>
    new THREE.Vector3(
      objetivo.x + Math.sin(az) * Math.cos(el) * dist,
      objetivo.y + Math.sin(el) * dist,
      objetivo.z + Math.cos(az) * Math.cos(el) * dist,
    );
  // Puntos que deben quedar en el cuadro. Sin L es solo un resguardo y el encuadre de siempre no cambia: aleja
  // la cámara solo si la caja del mueble se sale del cuadro (cocinas lineales anchas en 3D), no si apenas lo toca;
  // en la L cuentan el tramo principal y el retorno por separado (no el rincón libre) y sus cotas (ver Mueble3D).
  const limite = r ? 0.9 : 1;
  // Las etiquetas de las cotas no deben quedar bajo los botones del visor (unos 60 px arriba).
  const reserva = Math.min(0.3, Math.max(0, limite - 1 + 60 / Math.max(1, size.height / 2)));
  const puntos: { p: THREE.Vector3; extra: number }[] = [];
  const pieza = (x0: number, x1: number, y1: number, z1: number) => {
    for (const x of [x0, x1]) for (const y of [0, y1]) for (const z of [0, z1]) puntos.push({ p: new THREE.Vector3(x, y, z), extra: 0 });
  };
  if (r) {
    const [e0, e1] = extremosPrincipal(d).map((x) => x / 1000);
    const hb = d.alto / 1000;
    const dm = d.profundidad / 1000;
    const xr = r.lado === 'der' ? e1 - r.profundidad / 1000 : e0;
    const xMuro = r.lado === 'der' ? e1 : e0;
    const xAlto = r.lado === 'der' ? e0 - 0.14 : e1 + 0.14;
    pieza(caja.x0 / 1000, caja.x1 / 1000, H, dm);
    pieza(xr, xr + r.profundidad / 1000, hb, D);
    for (const [x, y, z] of [[e0, hb + 0.14, dm], [e1, hb + 0.14, dm], [xAlto, 0, dm], [xAlto, hb + 0.14, 0], [xMuro, hb + 0.28, D / 2], [xMuro, hb + 0.32, D]])
      puntos.push({ p: new THREE.Vector3(x, y, z), extra: reserva });
  } else {
    pieza(caja.x0 / 1000, caja.x1 / 1000, H, D);
  }
  const camara = new THREE.PerspectiveCamera(38, aspecto, 0.03, 60);
  const v = new THREE.Vector3();
  // Aleja la cámara desde el inicio hasta que entren todos los puntos; devuelve el centro de lo que se ve.
  const ajustar = () => {
    dist = inicio;
    let [x0, x1, y0, y1] = [0, 0, 0, 0];
    for (let k = 0; k < 50; k++) {
      camara.position.copy(posicion());
      camara.lookAt(objetivo);
      camara.updateMatrixWorld();
      [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
      let detras = false;
      for (const { p, extra } of puntos) {
        v.copy(p).project(camara);
        // z > 1: el punto queda detrás de la cámara.
        if (v.z >= 1) detras = true;
        [x0, x1, y0, y1] = [Math.min(x0, v.x), Math.max(x1, v.x), Math.min(y0, v.y), Math.max(y1, v.y + extra)];
      }
      if (!detras && Math.max(-x0, x1, -y0, y1) <= limite) break;
      dist *= 1.04;
    }
    return { mx: (x0 + x1) / 2, my: (y0 + y1) / 2 };
  };
  let centro = ajustar();
  // La L no es simétrica: se centra en el cuadro moviendo el objetivo (y la cámara con él) y se vuelve a ajustar.
  for (let k = 0; r && k < 4 && Math.max(Math.abs(centro.mx), Math.abs(centro.my)) >= 0.02; k++) {
    const t = Math.tan(fov / 2) * dist;
    objetivo.add(new THREE.Vector3().setFromMatrixColumn(camara.matrixWorld, 0).multiplyScalar(centro.mx * t * aspecto));
    objetivo.add(new THREE.Vector3().setFromMatrixColumn(camara.matrixWorld, 1).multiplyScalar(centro.my * t));
    centro = ajustar();
  }
  return { objetivo, pos: posicion() };
}

function Camara() {
  const controles = useRef<OrbitImpl>(null);
  const { camera, size } = useThree();
  const encuadre = useApp((s) => s.encuadre);
  const vista = useApp((s) => s.vista);
  const escenario = useApp((s) => s.escenario);
  // Al cambiar la L de lado la cámara pasa al otro lado.
  const ladoL = useApp((s) => s.diseno.retorno?.lado ?? null);
  const animando = useRef(0);
  const destino = useRef<{ objetivo: THREE.Vector3; pos: THREE.Vector3 } | null>(null);
  // Una L grande en el teléfono puede necesitar más de 9 m: el control no debe acercar la cámara y cortarla.
  const [maxDistancia, setMaxDistancia] = useState(9);
  const encuadrar = (d: Diseno, v: Vista) => {
    const dst = objetivoCamara(d, v, size);
    destino.current = dst;
    animando.current = 1;
    setMaxDistancia(Math.max(9, dst.pos.distanceTo(dst.objetivo) * 1.2));
  };

  useEffect(() => {
    encuadrar(useApp.getState().diseno, vista);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encuadre, vista, escenario, ladoL]);

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
      encuadrar(useApp.getState().diseno, useApp.getState().vista);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      maxDistance={maxDistancia}
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
