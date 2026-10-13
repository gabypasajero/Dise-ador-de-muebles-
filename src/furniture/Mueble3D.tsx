import { Html, Line } from '@react-three/drei';
import { formatear } from '../../shared/reglas';
import type { CatalogoMateriales, Diseno, Unidad } from '../../shared/tipos';
import { MaterialesProvider } from './base3d';
import { MuebleCuerpos } from './MuebleCuerpos';
import { Tocador3D } from './Tocador3D';

export interface OpcionesVista {
  abierto: boolean;
  cotas: boolean;
  etiquetasFrentes: boolean;
  unidad: Unidad;
}

/** Mueble completo en metros (internamente modelado en mm). */
export function Mueble3D({ diseno, materiales, vista }: { diseno: Diseno; materiales: CatalogoMateriales | null; vista: OpcionesVista }) {
  const props = { diseno, abierto: vista.abierto, etiquetas: vista.etiquetasFrentes, unidad: vista.unidad };
  return (
    <MaterialesProvider diseno={diseno} catalogo={materiales}>
      <group scale={0.001} position={[0, 0, 0.004]}>
        {diseno.plantilla === 'tocador' ? <Tocador3D {...props} /> : <MuebleCuerpos {...props} />}
        {vista.cotas && <Cotas diseno={diseno} unidad={vista.unidad} />}
      </group>
    </MaterialesProvider>
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
  const W = d.ancho;
  const H = d.alto;
  const D = d.profundidad;
  const sep = 140;
  return (
    // El nombre permite ocultarlas al capturar la miniatura de la cotización.
    <group name="cotas">
      <Cota desde={[-W / 2, H + sep, D]} hasta={[W / 2, H + sep, D]} normal={[0, 1, 0]} texto={`Ancho ${formatear(W, unidad)}`} />
      <Cota desde={[W / 2 + sep, 0, D]} hasta={[W / 2 + sep, H, D]} normal={[1, 0, 0]} texto={`Alto ${formatear(H, unidad)}`} />
      <Cota desde={[W / 2 + sep, H + sep, 0]} hasta={[W / 2 + sep, H + sep, D]} normal={[1, 0, 0]} texto={`Prof. ${formatear(D, unidad)}`} />
      {/* Líneas de referencia hacia el mueble */}
      <Line points={[[-W / 2, H, D], [-W / 2, H + sep + 40, D]]} color="#a8325e" lineWidth={1} dashed dashSize={20} gapSize={15} />
      <Line points={[[W / 2, H, D], [W / 2 + sep + 40, H + sep + 40, D]]} color="#a8325e" lineWidth={1} dashed dashSize={20} gapSize={15} />
      <Line points={[[W / 2, 0, D], [W / 2 + sep + 40, 0, D]]} color="#a8325e" lineWidth={1} dashed dashSize={20} gapSize={15} />
      <Line points={[[W / 2, H, 0], [W / 2 + sep + 40, H + sep + 40, 0]]} color="#a8325e" lineWidth={1} dashed dashSize={20} gapSize={15} />
    </group>
  );
}
