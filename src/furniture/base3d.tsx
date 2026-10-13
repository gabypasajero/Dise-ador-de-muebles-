// Piezas base del modelador 3D: geometrías con UV a escala real (mm),
// materiales PBR del mueble y el componente Panel.
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import * as THREE from 'three';
import type { CatalogoMateriales, Diseno, Material } from '../../shared/tipos';
import type { Rect } from '../../shared/layout';
import { texturaImagen, texturaMaterial } from './texturas';

export type Eje = 'x' | 'y' | 'z';

// ---------- Geometría ----------

/**
 * Caja con UV en milímetros reales. La veta sigue el eje indicado (por defecto
 * el lado más largo). `uvFrente` mapea la cara frontal a una imagen que cubre
 * todos los frentes del mueble.
 */
export function cajaUV(
  w: number,
  h: number,
  d: number,
  opciones: { eje?: Eje; semilla?: number; uvFrente?: { pieza: Rect; total: Rect } } = {},
): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const eje: Eje = opciones.eje ?? (w >= h && w >= d ? 'x' : h >= d ? 'y' : 'z');
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // Ejes (u, v) de cada cara: px, nx, py, ny, pz, nz.
  const caras: [Eje, Eje, number, number][] = [
    ['z', 'y', d, h],
    ['z', 'y', d, h],
    ['x', 'z', w, d],
    ['x', 'z', w, d],
    ['x', 'y', w, h],
    ['x', 'y', w, h],
  ];
  const s = opciones.semilla ?? 0;
  const dx = ((s * 7919) % 1000) * 1.3;
  const dy = ((s * 104729) % 1000) * 0.7;
  for (let cara = 0; cara < 6; cara++) {
    const [eu, ev, su, sv] = caras[cara];
    for (let k = 0; k < 4; k++) {
      const i = cara * 4 + k;
      if (cara === 4 && opciones.uvFrente) {
        const { pieza, total } = opciones.uvFrente;
        const u0 = uv.getX(i);
        const v0 = uv.getY(i);
        const x = pieza.x0 + u0 * (pieza.x1 - pieza.x0);
        const y = pieza.y0 + v0 * (pieza.y1 - pieza.y0);
        uv.setXY(i, (x - total.x0) / (total.x1 - total.x0), (y - total.y0) / (total.y1 - total.y0));
        continue;
      }
      let u = uv.getX(i) * su;
      let v = uv.getY(i) * sv;
      // La textura de madera tiene la veta a lo largo de v.
      if (eje === eu && eje !== ev) [u, v] = [v, u];
      uv.setXY(i, u + dx, v + dy);
    }
  }
  uv.needsUpdate = true;
  return g;
}

// ---------- Materiales ----------

export interface Mats3D {
  frente: THREE.Material;
  casco: THREE.Material;
  fondo: THREE.Material;
  cubierta: THREE.Material;
  tirador: THREE.Material;
  acero: THREE.Material;
  aceroCepillado: THREE.Material;
  vidrioNegro: THREE.Material;
  negroMate: THREE.Material;
  grisOscuro: THREE.Material;
  espejo: THREE.Material;
  luz: THREE.Material;
  llama: THREE.Material;
  imagenFrontal: THREE.Material | null;
  colorLuz: string;
}

const MaterialesCtx = createContext<Mats3D | null>(null);

export function useMats(): Mats3D {
  const m = useContext(MaterialesCtx);
  if (!m) throw new Error('useMats fuera de MaterialesProvider');
  return m;
}

const RESPALDO: Material = { id: 'blanco', nombre: 'Blanco', tipo: 'liso', color: '#f2f1ec', origen: 'generico' };

export function buscarMaterial(lista: Material[] | undefined, id: string): Material {
  return lista?.find((m) => m.id === id) ?? lista?.[0] ?? RESPALDO;
}

function materialSuperficie(m: Material, opciones: { brillo?: number } = {}): THREE.Material {
  const mapa = texturaMaterial(m);
  if (m.metal) {
    return new THREE.MeshStandardMaterial({ color: m.color, metalness: m.metal, roughness: m.rugosidad ?? 0.3 });
  }
  if (opciones.brillo) {
    return new THREE.MeshPhysicalMaterial({
      map: mapa,
      roughness: m.rugosidad ?? 0.4,
      clearcoat: opciones.brillo,
      clearcoatRoughness: 0.25,
    });
  }
  return new THREE.MeshStandardMaterial({ map: mapa, roughness: m.rugosidad ?? 0.55, metalness: 0 });
}

export const COLOR_LUZ: Record<Diseno['tocador']['luz'], string> = {
  calida: '#ffd59a',
  neutra: '#fff4e2',
  fria: '#e6f1ff',
};

export function MaterialesProvider({
  diseno,
  catalogo,
  children,
}: {
  diseno: Diseno;
  catalogo: CatalogoMateriales | null;
  children: ReactNode;
}) {
  const { frente, casco, cubierta, tirador } = diseno.materiales;
  const mFrente = buscarMaterial(catalogo?.melaminas, frente);
  const mCasco = buscarMaterial(catalogo?.melaminas, casco);
  const mCubierta = buscarMaterial(catalogo?.cubiertas, cubierta);
  const mTirador = buscarMaterial(catalogo?.tiradores, tirador);

  const fijos = useMemo(
    () => ({
      fondo: new THREE.MeshStandardMaterial({ color: '#ecebe6', roughness: 0.8 }),
      acero: new THREE.MeshStandardMaterial({ color: '#eef0f2', metalness: 0.85, roughness: 0.2 }),
      aceroCepillado: new THREE.MeshStandardMaterial({ color: '#d5d8dc', metalness: 0.8, roughness: 0.34 }),
      vidrioNegro: new THREE.MeshPhysicalMaterial({
        color: '#0c0c0e',
        roughness: 0.08,
        metalness: 0.1,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      }),
      negroMate: new THREE.MeshStandardMaterial({ color: '#18181a', roughness: 0.6, metalness: 0.2 }),
      grisOscuro: new THREE.MeshStandardMaterial({ color: '#2c2d30', roughness: 0.45, metalness: 0.4 }),
      espejo: new THREE.MeshStandardMaterial({ color: '#e8eef2', metalness: 1, roughness: 0.03 }),
      llama: new THREE.MeshStandardMaterial({
        color: '#3d7bff',
        emissive: '#3b78ff',
        emissiveIntensity: 2.2,
        toneMapped: false,
      }),
    }),
    [],
  );

  const colorLuz = COLOR_LUZ[diseno.tocador.luz];
  const luz = useMemo(
    () => new THREE.MeshStandardMaterial({ color: colorLuz, emissive: colorLuz, emissiveIntensity: 2.4, toneMapped: false }),
    [colorLuz],
  );

  const mats = useMemo(
    () => ({
      frente: materialSuperficie(mFrente),
      casco: materialSuperficie(mCasco),
      cubierta: materialSuperficie(mCubierta, { brillo: mCubierta.tipo === 'madera' ? 0.15 : 0.55 }),
      tirador: materialSuperficie(mTirador),
    }),
    [mFrente, mCasco, mCubierta, mTirador],
  );

  const imagenFrontal = useMemo(() => {
    if (!diseno.imagenFrontal) return null;
    return new THREE.MeshStandardMaterial({ map: texturaImagen(diseno.imagenFrontal), roughness: 0.45 });
  }, [diseno.imagenFrontal]);

  useEffect(
    () => () => {
      Object.values(mats).forEach((m) => m.dispose());
    },
    [mats],
  );

  const valor = useMemo<Mats3D>(
    () => ({ ...fijos, ...mats, luz, imagenFrontal, colorLuz }),
    [fijos, mats, luz, imagenFrontal, colorLuz],
  );
  return <MaterialesCtx.Provider value={valor}>{children}</MaterialesCtx.Provider>;
}

// ---------- Panel ----------

let semillaGlobal = 1;

export interface PanelProps {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
  mat: THREE.Material | THREE.Material[];
  eje?: Eje;
  uvFrente?: { pieza: Rect; total: Rect };
  sombra?: boolean;
}

/** Tablero definido por sus límites en mm. */
export function Panel({ x0, x1, y0, y1, z0, z1, mat, eje, uvFrente, sombra = true }: PanelProps) {
  const w = Math.max(0.5, x1 - x0);
  const h = Math.max(0.5, y1 - y0);
  const d = Math.max(0.5, z1 - z0);
  const semilla = useMemo(() => semillaGlobal++, []);
  const clave = uvFrente
    ? `${uvFrente.pieza.x0},${uvFrente.pieza.x1},${uvFrente.pieza.y0},${uvFrente.pieza.y1},${uvFrente.total.x0},${uvFrente.total.x1},${uvFrente.total.y0},${uvFrente.total.y1}`
    : '';
  const geo = useMemo(
    () => cajaUV(w, h, d, { eje, semilla, uvFrente }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [w, h, d, eje, semilla, clave],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return (
    <mesh
      geometry={geo}
      material={mat}
      position={[(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2]}
      castShadow={sombra}
      receiveShadow
    />
  );
}

/** Cilindro entre dos alturas o a lo largo de un eje. */
export function Cilindro({
  r,
  largo,
  pos,
  eje = 'y',
  mat,
  segmentos = 24,
  sombra = true,
}: {
  r: number;
  largo: number;
  pos: [number, number, number];
  eje?: Eje;
  mat: THREE.Material;
  segmentos?: number;
  sombra?: boolean;
}) {
  const rot: [number, number, number] = eje === 'x' ? [0, 0, Math.PI / 2] : eje === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
  return (
    <mesh position={pos} rotation={rot} material={mat} castShadow={sombra} receiveShadow>
      <cylinderGeometry args={[r, r, largo, segmentos]} />
    </mesh>
  );
}
