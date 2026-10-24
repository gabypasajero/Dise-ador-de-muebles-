// Muebles aéreos de cocina (colgados del muro) y mueble superior del
// compacto (apoyado sobre la cubierta con costados y respaldo). Se dibuja un
// tramo aéreo a la vez (principal o un lado de la L/U) en sus coordenadas locales.
import type { EquipoUbicado, LayoutAereoCuerpo, LayoutAereos } from '../../shared/layout';
import type { Diseno, Unidad } from '../../shared/tipos';
import { Panel, useMats } from './base3d';
import { CampanaAlojada, Cubierta } from './Cocina3D';
import { Puerta, type ContextoFrente } from './Frentes';

export function Aereos3D({
  d,
  la,
  campanas = [],
  abierto,
  etiquetas,
  unidad,
}: {
  d: Diseno;
  /** Layout del tramo (calcularLayoutAereos o calcularLayoutAereosLado). */
  la: LayoutAereos;
  /** Campanas alojadas en este tramo (ubicarEquipos, x local de este layout). */
  campanas?: EquipoUbicado[];
  abierto: boolean;
  etiquetas: boolean;
  unidad: Unidad;
}) {
  const m = useMats();
  const ctx: ContextoFrente = {
    zFrente: la.zFrente,
    espesor: la.espesor,
    tirador: d.tirador,
    manillaArriba: false,
    manillaAbajo: true,
    abiertoGlobal: abierto,
    totalFrentes: null,
    etiquetas,
    unidad,
  };
  // La imagen del cliente va solo en los frentes del tramo principal.
  const matFrente = m.frente;
  return (
    <group>
      {la.montaje === 'apoyado' && <Estructura d={d} la={la} />}
      {la.cuerpos.map((lc) => (
        <Modulo key={lc.cuerpo.id} d={d} la={la} lc={lc} campana={campanas.find((u) => u.indice === lc.indice) ?? null} />
      ))}
      {la.frentes.map((f) => (
        <Puerta key={`a-${f.cuerpo}-${f.indice}-${la.cuerpos[f.cuerpo]?.cuerpo.id}`} frente={f} ctx={ctx} material={matFrente} />
      ))}
    </group>
  );
}

/** Compacto: costados desde la cubierta hasta arriba, divisiones entre módulos, techo y respaldo. */
function Estructura({ d, la }: { d: Diseno; la: LayoutAereos }) {
  const m = useMats();
  const t = d.espesor;
  const Dz = la.profundidad;
  const y0 = la.yCubierta;
  const bordes = [la.x0, ...la.cuerpos.map((c) => c.x1)];
  return (
    <group>
      <Panel x0={la.x0} x1={la.x1} y0={y0} y1={la.y1 - t} z0={0} z1={6} mat={m.fondo} sombra={false} />
      <Panel x0={la.x0} x1={la.x1} y0={la.y1 - t} y1={la.y1} z0={0} z1={Dz} mat={m.casco} eje="x" />
      {bordes.map((x, i) => {
        const primero = i === 0;
        const ultimo = i === bordes.length - 1;
        const x0 = primero ? x : ultimo ? x - t : x - t / 2;
        return <Panel key={i} x0={x0} x1={x0 + t} y0={y0} y1={la.y1 - t} z0={0} z1={Dz} mat={m.casco} />;
      })}
    </group>
  );
}

function Modulo({ d, la, lc, campana }: { d: Diseno; la: LayoutAereos; lc: LayoutAereoCuerpo; campana: EquipoUbicado | null }) {
  const m = useMats();
  const t = d.espesor;
  const c = lc.cuerpo;
  const Dz = la.zFrente;
  const apoyado = la.montaje === 'apoyado';
  if (c.tipo === 'hueco') return null;
  // En el compacto los costados y el techo son comunes; en los aéreos murales cada módulo es una caja.
  const ix0 = apoyado ? lc.x0 + (lc.indice === 0 ? t : t / 2) : lc.x0 + t;
  const ix1 = apoyado ? lc.x1 - (lc.indice === la.cuerpos.length - 1 ? t : t / 2) : lc.x1 - t;
  const piezas: JSX.Element[] = [];
  // El módulo de la campana ocupa todo el alto del aéreo: puertas arriba y la campana bajo ellas.
  const esCampana = c.tipo === 'campana';
  const yCaja = esCampana ? la.y0 : lc.y0;
  if (!apoyado) {
    piezas.push(<Panel key="li" x0={lc.x0} x1={lc.x0 + t} y0={yCaja} y1={lc.y1} z0={0} z1={Dz} mat={m.casco} />);
    piezas.push(<Panel key="ld" x0={lc.x1 - t} x1={lc.x1} y0={yCaja} y1={lc.y1} z0={0} z1={Dz} mat={m.casco} />);
    piezas.push(<Panel key="techo" x0={ix0} x1={ix1} y0={lc.y1 - t} y1={lc.y1} z0={0} z1={Dz} mat={m.casco} />);
    piezas.push(<Panel key="fondo" x0={ix0} x1={ix1} y0={yCaja + (esCampana || c.tipo === 'espacio-campana' ? 0 : t)} y1={lc.y1 - t} z0={0} z1={4} mat={m.fondo} sombra={false} />);
  }

  if (c.tipo === 'espacio-campana') {
    // Hueco abierto para la campana: costados, techo y fondo, sin base, puertas ni repisas. En el
    // techo queda la salida del ducto. Si la encimera de abajo lleva campana, va alojada aquí.
    const espacio: JSX.Element[] = [];
    if (apoyado) espacio.push(<Panel key="fondo-a" x0={ix0} x1={ix1} y0={la.y0} y1={lc.y1 - t} z0={6} z1={8} mat={m.fondo} sombra={false} />);
    else espacio.push(...piezas);
    espacio.push(
      <mesh key="ducto" position={[(ix0 + ix1) / 2, lc.y1 - t - 0.5, Dz / 2]} rotation={[Math.PI / 2, 0, 0]} material={m.negroMate}>
        <circleGeometry args={[75, 32]} />
      </mesh>,
    );
    if (campana) {
      const w = Math.min(campana.ancho, ix1 - ix0 - 4);
      const cx = Math.max(ix0 + w / 2 + 2, Math.min(ix1 - w / 2 - 2, campana.x));
      const yTope = la.y0 + Math.min(lc.y1 - t - la.y0 - 20, Math.max(200, Math.round((lc.y1 - la.y0) * 0.35)));
      espacio.push(<CampanaAlojada key="campana" cx={cx} ancho={w} y0={la.y0} y1={yTope} zFrente={la.zFrente} espesorFrente={la.espesor} />);
      // Ducto de la campana hasta el techo.
      espacio.push(<Panel key="chimenea" x0={cx - 110} x1={cx + 110} y0={yTope} y1={lc.y1 - t} z0={40} z1={Math.min(Dz - 30, 260)} mat={m.aceroCepillado} />);
    }
    return <group>{espacio}</group>;
  }

  if (c.tipo === 'nicho' && lc.nicho) {
    const n = lc.nicho;
    // Separación bajo la puerta abatible.
    piezas.push(<Panel key="sep" x0={ix0} x1={ix1} y0={n.y1} y1={n.y1 + t} z0={0} z1={Dz} mat={m.casco} />);
    if (apoyado) {
      // Repisa postformada para el microondas, como la cubierta.
      piezas.push(
        <group key="repisa">
          <Cubierta x0={ix0} x1={ix1} yTop={lc.y0 + 28} espesor={28} profundidad={la.profundidad + 40} huecos={[]} copete={false} />
        </group>,
      );
    } else {
      piezas.push(<Panel key="base" x0={ix0} x1={ix1} y0={lc.y0} y1={lc.y0 + t} z0={0} z1={Dz} mat={m.casco} />);
    }
    // Perforación para el enchufe del microondas.
    const r = 32;
    piezas.push(
      <mesh key="cable" position={[ix1 - 90, n.y1 - 90, 7]} material={m.negroMate}>
        <circleGeometry args={[r, 28]} />
      </mesh>,
    );
    return <group>{piezas}</group>;
  }

  // Módulo con puertas (o la parte con puertas de la campana).
  piezas.push(<Panel key="base" x0={ix0} x1={ix1} y0={lc.y0} y1={lc.y0 + t} z0={0} z1={Dz} mat={m.casco} />);
  if (apoyado) piezas.push(<Panel key="fondo-a" x0={ix0} x1={ix1} y0={lc.y0 + t} y1={lc.y1 - t} z0={6} z1={8} mat={m.fondo} sombra={false} />);
  const alto = lc.y1 - t - (lc.y0 + t);
  for (let k = 1; k <= c.repisas; k++) {
    const y = lc.y0 + t + (alto * k) / (c.repisas + 1) - t / 2;
    piezas.push(<Panel key={`rep${k}`} x0={ix0} x1={ix1} y0={y} y1={y + t} z0={8} z1={Dz - 20} mat={m.casco} />);
  }
  if (esCampana) {
    // Centrada sobre su encimera (u.x lo da el motor); sin dato, al centro del módulo.
    const w = Math.min(campana?.ancho ?? 600, ix1 - ix0 - 4);
    const cx = Math.max(ix0 + w / 2 + 2, Math.min(ix1 - w / 2 - 2, campana?.x ?? (lc.x0 + lc.x1) / 2));
    piezas.push(<CampanaAlojada key="campana" cx={cx} ancho={w} y0={la.y0} y1={lc.y0} zFrente={la.zFrente} espesorFrente={la.espesor} />);
  }
  return <group>{piezas}</group>;
}
