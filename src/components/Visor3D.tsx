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
import { dimensionesTotales, extremosPrincipal, formaDe, LADOS, ladoAereoActivo, ubicarEquipos } from '../../shared/layout';
import type { Diseno } from '../../shared/tipos';

function Entorno() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    // Junto con las luces de Escenarios da una irradiancia ≈ 1 en un frente: el color se ve como la muestra.
    scene.environmentIntensity = 0.35;
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
  const s = useApp.getState();
  const izq = d.lados?.izq ?? null;
  const der = d.lados?.der ?? null;
  const conLados = !!(izq || der);
  const enU = !!(izq && der);
  // En los dormitorios la cama queda a la izquierda: la cámara mira desde la derecha.
  // En la L mira desde el lado abierto, de frente a las puertas del lado; en la U casi de frente y desde
  // arriba, corrida hacia el lado más corto: así se ven las puertas de los dos lados (las del largo, mejor).
  const lado = enU ? (izq!.largo <= der!.largo ? 0.4 : -0.4) : izq ? -1 : der ? 1 : escenarioActual(s.escenario, s.producto, d) === 'cocina' ? 1 : -0.85;
  // Todo el conjunto: tramo principal, lados y aéreos.
  const caja = dimensionesTotales(d);
  // La campana mural (sin aéreo encima) sobresale del mueble: su cuerpo también debe verse.
  const mural = ubicarEquipos(d).some((u) => u.tipo === 'campana' && u.montaje === 'mural');
  if (mural) caja.alto = Math.max(caja.alto, d.aereos.elevacion + 260);
  const W = (caja.x1 - caja.x0) / 1000;
  const H = caja.alto / 1000 + (d.plantilla === 'comoda' && d.mudador ? 0.1 : 0);
  const D = caja.fondo / 1000;
  const cx = (caja.x0 + caja.x1) / 2000;
  // Con lados el objetivo va a la mitad de su largo, que puede ser mucho más que el fondo del mueble.
  const objetivo = new THREE.Vector3(cx, H * 0.53, conLados ? D / 2 : Math.min(D, 0.7) * 0.55);
  const fov = THREE.MathUtils.degToRad(38);
  // Distancia justa para que entren ancho (con cotas) y alto: el mueble se ve grande.
  const anchoVisible = W + (aspecto < 1 ? 0.2 : 0.4);
  const altoVisible = H + 0.42;
  const distV = altoVisible / 2 / Math.tan(fov / 2);
  const distH = anchoVisible / 2 / Math.tan(fov / 2) / Math.max(0.5, aspecto);
  // Con lados se parte más cerca y el ajuste de abajo aleja la cámara solo lo necesario: los lados pueden ser muy largos.
  const inicio = conLados ? Math.max(distV, distH, 1.1) * 0.6 : Math.max(distV, distH, 1.1) * 1.04 + Math.min(D, 1.2) * 0.8;
  let dist = inicio;
  // En la U se mira un poco más desde arriba para que el interior no quede tapado por las puntas.
  const el = enU && vista === 'perspectiva' ? 0.46 : ANGULOS[vista].el;
  const az = ANGULOS[vista].az * lado;
  const posicion = () =>
    new THREE.Vector3(
      objetivo.x + Math.sin(az) * Math.cos(el) * dist,
      objetivo.y + Math.sin(el) * dist,
      objetivo.z + Math.cos(az) * Math.cos(el) * dist,
    );
  // Puntos que deben quedar en el cuadro. Sin lados es solo un resguardo y el encuadre de siempre no cambia: aleja
  // la cámara solo si la caja del mueble se sale del cuadro (cocinas lineales anchas en 3D), no si apenas lo toca;
  // con lados cuentan el tramo principal y cada lado por separado (no el rincón libre) y sus cotas (ver Mueble3D).
  const limite = conLados ? 0.9 : 1;
  // Las etiquetas de las cotas no deben quedar bajo los botones del visor (unos 60 px arriba).
  const reserva = Math.min(0.3, Math.max(0, limite - 1 + 60 / Math.max(1, size.height / 2)));
  const puntos: { p: THREE.Vector3; extra: number }[] = [];
  const pieza = (x0: number, x1: number, y1: number, z1: number) => {
    for (const x of [x0, x1]) for (const y of [0, y1]) for (const z of [0, z1]) puntos.push({ p: new THREE.Vector3(x, y, z), extra: 0 });
  };
  const cota = (x: number, y: number, z: number) => puntos.push({ p: new THREE.Vector3(x, y, z), extra: reserva });
  if (conLados) {
    const [e0, e1] = extremosPrincipal(d).map((x) => x / 1000);
    const hb = d.alto / 1000;
    const dm = d.profundidad / 1000;
    pieza(caja.x0 / 1000, caja.x1 / 1000, H, dm);
    for (const ld of LADOS) {
      const r = d.lados[ld];
      const ra = ladoAereoActivo(d, ld);
      if (!r && !ra) continue;
      const prof = Math.max(r?.profundidad ?? 0, ra?.profundidad ?? 0) / 1000;
      const largo = Math.max(r?.largo ?? 0, ra?.largo ?? 0) / 1000;
      const xMuro = ld === 'der' ? e1 : e0;
      pieza(ld === 'der' ? e1 - prof : e0, ld === 'der' ? e1 : e0 + prof, ra || mural ? H : hb, largo);
      if (r) {
        cota(xMuro, hb + 0.28, r.largo / 2000);
        cota(xMuro, hb + 0.32, r.largo / 1000);
      }
    }
    cota(e0, hb + 0.14, dm);
    cota(e1, hb + 0.14, dm);
    if (enU) {
      const xP = e0 + izq!.profundidad / 2000;
      cota(xP, 0, izq!.largo / 1000 + 0.14);
      cota(xP, hb, izq!.largo / 1000 + 0.14);
    } else {
      const xAlto = der ? e0 - 0.14 : e1 + 0.14;
      cota(xAlto, 0, dm);
      cota(xAlto, hb + 0.14, 0);
    }
  } else {
    pieza(caja.x0 / 1000, caja.x1 / 1000, H, D);
  }
  const camara = new THREE.PerspectiveCamera(38, aspecto, 0.03, 60);
  const v = new THREE.Vector3();
  // Aleja la cámara desde el inicio hasta que entren todos los puntos; devuelve el centro de lo que se ve.
  const ajustar = () => {
    dist = inicio;
    let [x0, x1, y0, y1] = [0, 0, 0, 0];
    for (let k = 0; k < 60; k++) {
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
  // La L y la U no llenan el cuadro de forma pareja: se centran moviendo el objetivo (y la cámara con él) y se vuelve a ajustar.
  for (let k = 0; conLados && k < 4 && Math.max(Math.abs(centro.mx), Math.abs(centro.my)) >= 0.02; k++) {
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
  // Al cambiar la forma (lineal, L a un lado u otro, U) la cámara pasa al lado abierto.
  const forma = useApp((s) => formaDe(s.diseno.lados ?? { izq: null, der: null }));
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
  }, [encuadre, vista, escenario, forma]);

  // Reencuadra si el mueble cambia mucho de tamaño.
  // Tamaño de todo el conjunto (incluye los lados y los aéreos).
  const ancho = useApp((s) => {
    const c = dimensionesTotales(s.diseno);
    return c.x1 - c.x0;
  });
  const alto = useApp((s) => dimensionesTotales(s.diseno).alto);
  const fondo = useApp((s) => dimensionesTotales(s.diseno).fondo);
  const previo = useRef({ ancho, alto, fondo });
  // También al cambiar mucho la forma del visor (mostrar u ocultar el panel de medidas): el encuadre
  // calculado para el visor bajo y ancho cortaría el mueble en el alto.
  const aspecto = size.width / Math.max(1, size.height);
  const aspectoPrevio = useRef(aspecto);
  useEffect(() => {
    const p = previo.current;
    const cambioVisor = Math.abs(Math.log(aspecto / aspectoPrevio.current)) > 0.12;
    if (cambioVisor || Math.abs(ancho - p.ancho) / p.ancho > 0.18 || Math.abs(alto - p.alto) / p.alto > 0.18 || Math.abs(fondo - p.fondo) / p.fondo > 0.3) {
      previo.current = { ancho, alto, fondo };
      aspectoPrevio.current = aspecto;
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

/** Imagen del mueble para los documentos: 2400 × 1350 px (16:9, ≈ 340 ppp a todo el ancho de una hoja A4). */
const CAPTURA = { ancho: 2400, alto: 1350, fov: 30 };
/** La columna imagen admite 2.000.000 de caracteres: la data URL queda bajo 1,8 millones. */
const MAX_DATA_URL = 1_800_000;

/**
 * Encuadre de la imagen de los documentos, independiente de la cámara del vendedor: vista 3/4
 * frontal de todo el conjunto (tramo principal, lados de la L o la U, aéreos y campana mural),
 * centrado y con un margen parejo. La distancia se calcula exacta para que todo entre.
 */
function encuadreCaptura(d: Diseno, aspecto: number, altoReal: number | null) {
  const izq = d.lados?.izq ?? null;
  const der = d.lados?.der ?? null;
  const conLados = !!(izq || der);
  const caja = dimensionesTotales(d);
  const mural = ubicarEquipos(d).some((u) => u.tipo === 'campana' && u.montaje === 'mural');
  if (mural) caja.alto = Math.max(caja.alto, d.aereos.elevacion + 260);
  // Lo que sobresale del mueble (llave del lavaplatos, parrillas de la encimera, campana) también entra.
  const H = Math.max(caja.alto / 1000 + (d.plantilla === 'comoda' && d.mudador ? 0.1 : 0), Math.min(altoReal ?? 0, caja.alto / 1000 + 0.6));
  const puntos: THREE.Vector3[] = [];
  const pieza = (x0: number, x1: number, y1: number, z1: number) => {
    for (const x of [x0, x1]) for (const y of [0, y1]) for (const z of [0, z1]) puntos.push(new THREE.Vector3(x, y, z));
  };
  if (conLados) {
    const [e0, e1] = extremosPrincipal(d).map((x) => x / 1000);
    pieza(caja.x0 / 1000, caja.x1 / 1000, H, d.profundidad / 1000);
    for (const ld of LADOS) {
      const r = d.lados[ld];
      const ra = ladoAereoActivo(d, ld);
      if (!r && !ra) continue;
      const prof = Math.max(r?.profundidad ?? 0, ra?.profundidad ?? 0) / 1000;
      const largo = Math.max(r?.largo ?? 0, ra?.largo ?? 0) / 1000;
      pieza(ld === 'der' ? e1 - prof : e0, ld === 'der' ? e1 : e0 + prof, ra || mural ? H : d.alto / 1000, largo);
    }
  } else {
    pieza(caja.x0 / 1000, caja.x1 / 1000, H, caja.fondo / 1000);
  }
  // Siempre de frente y apenas desde arriba, como una foto de catálogo (la dueña lo pidió así).
  const el = 0.1;
  const az = 0;
  // Hacia la cámara, y los ejes derecha y arriba de la imagen.
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  const derecha = dir.clone().negate().cross(new THREE.Vector3(0, 1, 0)).normalize();
  const arriba = derecha.clone().cross(dir.clone().negate()).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(CAPTURA.fov) / 2);
  const tanH = tanV * aspecto;
  const llenado = 0.86;
  const objetivo = puntos.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / puntos.length);
  let dist = 1;
  const q = new THREE.Vector3();
  for (let k = 0; k < 6; k++) {
    // Distancia mínima para que cada punto quede dentro del cuadro: |x| / (dist − a) ≤ tan · llenado.
    dist = 0;
    for (const p of puntos) {
      q.copy(p).sub(objetivo);
      const a = q.dot(dir);
      dist = Math.max(dist, a + Math.abs(q.dot(derecha)) / (tanH * llenado), a + Math.abs(q.dot(arriba)) / (tanV * llenado));
    }
    // Centra lo que se ve moviendo el objetivo (y la cámara con él).
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const p of puntos) {
      q.copy(p).sub(objetivo);
      const z = dist - q.dot(dir);
      const x = q.dot(derecha) / (z * tanH);
      const y = q.dot(arriba) / (z * tanV);
      [x0, x1, y0, y1] = [Math.min(x0, x), Math.max(x1, x), Math.min(y0, y), Math.max(y1, y)];
    }
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    if (Math.abs(mx) < 0.005 && Math.abs(my) < 0.005) break;
    objetivo.addScaledVector(derecha, mx * tanH * dist).addScaledVector(arriba, my * tanV * dist);
  }
  return { objetivo, pos: objetivo.clone().addScaledVector(dir, dist) };
}

/** Alto real (m) de lo dibujado del mueble, sin cotas ni ayudas: el grupo del mueble es el de escala 0,001 (mm). */
function altoMueble(scene: THREE.Object3D): number | null {
  let raiz: THREE.Object3D | null = null;
  scene.traverse((o) => {
    if (!raiz && o.type === 'Group' && Math.abs(o.scale.x - 0.001) < 1e-9) raiz = o;
  });
  if (!raiz) return null;
  const caja = new THREE.Box3();
  const b = new THREE.Box3();
  const recorrer = (o: THREE.Object3D) => {
    if (o.name === 'cotas' || o.name === 'ayudas' || !o.visible) return;
    const m = o as THREE.Mesh;
    if (m.isMesh && m.geometry) {
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      if (m.geometry.boundingBox) caja.union(b.copy(m.geometry.boundingBox).applyMatrix4(m.matrixWorld));
    }
    o.children.forEach(recorrer);
  };
  (raiz as THREE.Object3D).updateMatrixWorld(true);
  recorrer(raiz);
  return caja.isEmpty() ? null : caja.max.y;
}

/**
 * Registra la función para capturar la imagen del mueble para la cotización, la hoja del
 * maestro y la descarga: un render dedicado de alta resolución (2400 px, con antialias), con
 * su propia cámara y encuadre automático de todo el conjunto, sin cotas ni ayudas. El tamaño
 * del renderer se cambia solo mientras se dibuja y luego se restaura. La miniatura de la lista
 * se saca de esta misma imagen.
 */
function Capturador() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    useApp.getState().set({
      capturar: () => {
        const s = useApp.getState();
        const ocultas: THREE.Object3D[] = [];
        scene.traverse((o) => {
          if ((o.name === 'cotas' || o.name === 'ayudas' || o.name === 'escenario') && o.visible) ocultas.push(o);
        });
        const proporcion = gl.getPixelRatio();
        const tam = gl.getSize(new THREE.Vector2());
        const ctx = gl.getContext();
        const limites = [gl.capabilities.maxTextureSize || 4096, ctx.getParameter(ctx.MAX_RENDERBUFFER_SIZE) || 4096, ...((ctx.getParameter(ctx.MAX_VIEWPORT_DIMS) as number[] | null) ?? [4096])];
        const ancho = Math.min(CAPTURA.ancho, ...limites);
        const alto = Math.round((ancho * CAPTURA.alto) / CAPTURA.ancho);
        const camara = new THREE.PerspectiveCamera(CAPTURA.fov, ancho / alto, 0.03, 80);
        const e = encuadreCaptura(s.diseno, ancho / alto, altoMueble(scene));
        camara.position.copy(e.pos);
        camara.lookAt(e.objetivo);
        camara.updateProjectionMatrix();
        camara.updateMatrixWorld();
        ocultas.forEach((o) => (o.visible = false));
        try {
          gl.setPixelRatio(1);
          gl.setSize(ancho, alto, false);
          gl.render(scene, camara);
          const lienzo = gl.domElement;
          // JPEG de buena calidad; si la imagen pesa demasiado para guardarla, baja un poco.
          for (const calidad of [0.92, 0.88, 0.84, 0.78, 0.7]) {
            const url = lienzo.toDataURL('image/jpeg', calidad);
            if (url.length <= MAX_DATA_URL) return url;
          }
          const c = document.createElement('canvas');
          c.width = Math.round(ancho * 0.75);
          c.height = Math.round(alto * 0.75);
          const g = c.getContext('2d')!;
          g.imageSmoothingQuality = 'high';
          g.drawImage(lienzo, 0, 0, c.width, c.height);
          return c.toDataURL('image/jpeg', 0.8);
        } catch {
          return null;
        } finally {
          ocultas.forEach((o) => (o.visible = true));
          gl.setPixelRatio(proporcion);
          gl.setSize(tam.x, tam.y, false);
          gl.render(scene, camera);
        }
      },
    });
    return () => useApp.getState().set({ capturar: null });
  }, [gl, scene, camera]);
  return null;
}

/** Solo en desarrollo: deja la escena y la cámara en window.__three para las pruebas de color y encuadre. */
function Depuracion() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const w = window as unknown as { __three?: unknown };
    w.__three = { gl, scene, camera };
    return () => {
      delete w.__three;
    };
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
  const distancias = useApp((s) => s.distancias);
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
        // Neutral (Khronos PBR Neutral) no altera el tono ni la saturación bajo ~0,76: los colores de las
        // melaminas quedan fieles a la muestra; ACES los aclaraba y desaturaba (Verde Salvia casi blanco).
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.02;
      }}
      onPointerMissed={() => (document.body.style.cursor = '')}
    >
      <color attach="background" args={['#f3f1ee']} />
      <Entorno />
      <Suspense fallback={null}>
        {/* Con nombre para ocultarlo en la imagen de la cotización (fondo liso, solo el mueble). */}
        <group name="escenario">
          <Escenario3D tipo={tipoEscena} diseno={diseno} />
        </group>
        <Mueble3D diseno={diseno} materiales={materiales} vista={{ abierto, cotas, distancias, etiquetasFrentes, unidad, modulos }} />
      </Suspense>
      <Camara />
      <Capturador />
      <Depuracion />
    </Canvas>
  );
}
