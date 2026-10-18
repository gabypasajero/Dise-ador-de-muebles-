// Ensambla los muebles basados en cuerpos: cocinas, clósets, cómodas,
// clóset escritorio y cocina infantil.
import { useEffect, useMemo } from 'react';
import { altoBaseInfantil, calcularLayout, centroCuerpo, esCocina, type Layout, type LayoutCuerpo, type Rect } from '../../shared/layout';
import { equipoLegado, formatear } from '../../shared/reglas';
import type { Diseno, Unidad } from '../../shared/tipos';
import { Cilindro, Panel, useMats } from './base3d';
import { Cubierta, Encimera, EspacioLibre, Horno, Lavaplatos, huecosLavaplatos, medidasEncimera, type Hueco } from './Cocina3D';
import { Cajon, Puerta, Tirador, materialFrente, type ContextoFrente } from './Frentes';
import { ajustarImagenFrentes } from './texturas';

interface Props {
  diseno: Diseno;
  abierto: boolean;
  etiquetas: boolean;
  unidad: Unidad;
  /** Cocina en L: la cubierta del tramo principal se alarga sobre la esquina (mm a la izquierda y a la derecha). */
  extensionCubierta?: [number, number];
}

export function MuebleCuerpos({ diseno: d, abierto, etiquetas, unidad, extensionCubierta = [0, 0] }: Props) {
  const l = useMemo(() => calcularLayout(d), [d]);
  const m = useMats();
  // El retorno de la L llega sin imagen: la imagen del cliente va solo en el tramo principal.
  const matFrente = d.imagenFrontal ? materialFrente(m) : m.frente;
  const totalFrentes = useMemo<Rect | null>(() => {
    if (!d.imagenFrontal || l.frentes.length === 0) return null;
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
    zFrente: l.zFrente,
    espesor: l.espesorFrente,
    tirador: d.tirador,
    manillaArriba: d.plantilla === 'cocina',
    abiertoGlobal: abierto,
    totalFrentes,
    etiquetas,
    unidad,
  };

  const anchoInterior = (indice: number) => {
    if (indice < 0) return { x0: -d.ancho / 2 + d.espesor, x1: d.ancho / 2 - d.espesor };
    return l.cuerpos[indice].interior;
  };

  return (
    <group>
      {l.cuerpos.map((lc) => (
        <Casco key={lc.cuerpo.id} d={d} l={l} lc={lc} unidad={unidad} />
      ))}
      {l.divisiones.map((dv, i) => (
        <Panel key={`div${i}`} x0={dv.x - d.espesor / 2} x1={dv.x + d.espesor / 2} y0={dv.y0} y1={dv.y1} z0={0} z1={l.profundidadCasco} mat={m.casco} />
      ))}
      {l.filaSuperior && <FilaSuperior d={d} l={l} />}
      {l.frentes.map((f) => {
        const clave = `${f.tipo}-${f.cuerpo}-${f.indice}-${d.cuerpos[f.cuerpo]?.id ?? 'sup'}`;
        if (f.tipo === 'puerta') return <Puerta key={clave} frente={f} ctx={ctx} material={matFrente} />;
        if (f.tipo === 'cajon')
          return (
            <Cajon
              key={clave}
              frente={f}
              ctx={ctx}
              material={matFrente}
              interior={anchoInterior(f.cuerpo)}
              fondoCaja={Math.max(120, l.profundidadCasco - 40)}
            />
          );
        return (
          <Panel
            key={clave}
            x0={f.rect.x0}
            x1={f.rect.x1}
            y0={f.rect.y0}
            y1={f.rect.y1}
            z0={l.zFrente}
            z1={l.zFrente + l.espesorFrente}
            mat={matFrente}
            eje="x"
            uvFrente={totalFrentes && Array.isArray(matFrente) ? { pieza: f.rect, total: totalFrentes } : undefined}
          />
        );
      })}
      {d.plantilla === 'cocina' && <EquipoCocina d={d} l={l} extension={extensionCubierta} />}
      {d.plantilla === 'cocina-infantil' && <CocinaInfantil d={d} l={l} />}
      {d.plantilla === 'comoda' && d.mudador && <Mudador d={d} />}
    </group>
  );
}

// ---------- Casco de un cuerpo ----------

function Casco({ d, l, lc, unidad }: { d: Diseno; l: Layout; lc: LayoutCuerpo; unidad: Unidad }) {
  const m = useMats();
  const t = d.espesor;
  const Dc = l.profundidadCasco;
  const c = lc.cuerpo;
  const cocina = esCocina(d);
  const { x0, x1, interior } = lc;

  if (c.tipo === 'hueco') {
    const tope = cocina ? (d.plantilla === 'cocina' ? d.alto - l.espesorCubierta : altoBaseInfantil(d)) : d.alto;
    return <EspacioLibre x0={x0} x1={x1} y1={tope} profundidad={Dc} texto={`Espacio libre ${formatear(c.ancho, unidad)}`} />;
  }
  if (c.tipo === 'escritorio') return <Escritorio d={d} l={l} lc={lc} />;

  const yTope = lc.yTope;
  // La despensa de la cocina infantil lleva techo propio, como un clóset.
  const conCubierta = cocina && !(d.plantilla === 'cocina-infantil' && lc.indice === 0);
  const techoInterior = conCubierta ? yTope - t : yTope;
  const piezas: JSX.Element[] = [];
  if (lc.ladoIzq) piezas.push(<Panel key="li" x0={x0} x1={x0 + t} y0={0} y1={yTope} z0={0} z1={Dc} mat={m.casco} />);
  if (lc.ladoDer) piezas.push(<Panel key="ld" x0={x1 - t} x1={x1} y0={0} y1={yTope} z0={0} z1={Dc} mat={m.casco} />);
  const yBase = d.zocalo;
  piezas.push(<Panel key="base" x0={interior.x0} x1={interior.x1} y0={yBase} y1={yBase + t} z0={0} z1={Dc} mat={m.casco} />);
  if (conCubierta) {
    piezas.push(<Panel key="techo" x0={interior.x0} x1={interior.x1} y0={yTope - t} y1={yTope} z0={0} z1={Dc} mat={m.casco} />);
  } else {
    piezas.push(<Panel key="techo" x0={x0} x1={x1} y0={yTope} y1={yTope + t} z0={0} z1={Dc + l.espesorFrente} mat={m.casco} />);
  }
  piezas.push(
    <Panel key="fondo" x0={interior.x0} x1={interior.x1} y0={yBase + t} y1={techoInterior} z0={0} z1={4} mat={m.fondo} sombra={false} />,
  );
  if (d.zocalo > 0) {
    const zx0 = lc.ladoIzq ? x0 + t : x0;
    const zx1 = lc.ladoDer ? x1 - t : x1;
    const retiro = cocina ? 50 : 18;
    piezas.push(
      <Panel key="zocalo" x0={zx0} x1={zx1} y0={0} y1={d.zocalo} z0={Dc - retiro - t} z1={Dc - retiro} mat={m.casco} />,
    );
  }

  if (c.tipo === 'frentes' && c.cajonesArriba && lc.zonaCajones && lc.zonaPuertas) {
    // Cajones arriba: separación bajo los cajones y repisas en la zona de puertas.
    const y = lc.zonaCajones.y0 - d.luzFrentes / 2 - t;
    piezas.push(<Panel key="sep" x0={interior.x0} x1={interior.x1} y0={y} y1={y + t} z0={4} z1={Dc} mat={m.casco} />);
    const z0 = yBase + t;
    for (let k = 1; k <= c.repisas; k++) {
      const yr = z0 + ((y - z0) * k) / (c.repisas + 1) - t / 2;
      piezas.push(<Panel key={`rep${k}`} x0={interior.x0} x1={interior.x1} y0={yr} y1={yr + t} z0={4} z1={Dc - 20} mat={m.casco} />);
    }
  } else if (c.tipo === 'frentes') {
    // Separación entre cajones y la zona superior.
    if (lc.zonaCajones && (lc.zonaPuertas || lc.zonaCajones.y1 < techoInterior - 120)) {
      const y = lc.zonaCajones.y1 + d.luzFrentes / 2;
      piezas.push(<Panel key="sep" x0={interior.x0} x1={interior.x1} y0={y} y1={y + t} z0={4} z1={Dc} mat={m.casco} />);
    }
    if (lc.zonaCajones && c.columnasCajones === 2 && c.cajones > 1) {
      const cx = (interior.x0 + interior.x1) / 2;
      piezas.push(
        <Panel key="divcaj" x0={cx - t / 2} x1={cx + t / 2} y0={yBase + t} y1={lc.zonaCajones.y1 + d.luzFrentes / 2} z0={4} z1={Dc} mat={m.casco} />,
      );
    }
    // Zona útil para repisas o colgador.
    let z0: number | null = null;
    if (lc.zonaPuertas) z0 = lc.zonaCajones ? lc.zonaCajones.y1 + d.luzFrentes / 2 + t : yBase + t;
    else if (lc.zonaCajones && lc.zonaCajones.y1 < techoInterior - 120) z0 = lc.zonaCajones.y1 + d.luzFrentes / 2 + t;
    else if (!lc.zonaCajones) z0 = yBase + t;
    if (z0 !== null) {
      const z1 = techoInterior;
      const alto = z1 - z0;
      if (c.colgador && alto > 650) {
        const yRepisa = z1 - Math.min(300, alto * 0.22);
        if (c.repisas > 0) piezas.push(<Panel key="rep0" x0={interior.x0} x1={interior.x1} y0={yRepisa} y1={yRepisa + t} z0={4} z1={Dc - 20} mat={m.casco} />);
        const yTubo = (c.repisas > 0 ? yRepisa : z1) - 55;
        const largo = interior.x1 - interior.x0;
        piezas.push(<Cilindro key="tubo" r={12} largo={largo} pos={[(interior.x0 + interior.x1) / 2, yTubo, Dc / 2]} eje="x" mat={m.acero} />);
        piezas.push(<Cilindro key="sop1" r={16} largo={6} pos={[interior.x0 + 3, yTubo, Dc / 2]} eje="x" mat={m.acero} />);
        piezas.push(<Cilindro key="sop2" r={16} largo={6} pos={[interior.x1 - 3, yTubo, Dc / 2]} eje="x" mat={m.acero} />);
      } else {
        const n = c.repisas;
        for (let k = 1; k <= n; k++) {
          const y = z0 + (alto * k) / (n + 1) - t / 2;
          piezas.push(<Panel key={`rep${k}`} x0={interior.x0} x1={interior.x1} y0={y} y1={y + t} z0={4} z1={Dc - 20} mat={m.casco} />);
        }
      }
    }
  }
  return <group>{piezas}</group>;
}

// ---------- Escritorio ----------

function Escritorio({ d, l, lc }: { d: Diseno; l: Layout; lc: LayoutCuerpo }) {
  const m = useMats();
  const t = d.espesor;
  const alto = lc.cuerpo.alto > 0 ? Math.min(lc.cuerpo.alto, d.alto) : Math.min(750, d.alto);
  const espTablero = 25;
  const n = d.cuerpos.length;
  const primero = lc.indice === 0;
  const ultimo = lc.indice === n - 1;
  const fondo = l.profundidadCasco + l.espesorFrente;
  const yT = alto - espTablero;
  return (
    <group>
      <Panel x0={lc.x0} x1={lc.x1} y0={yT} y1={alto} z0={0} z1={fondo} mat={m.frente} eje="x" />
      {primero && <Panel x0={lc.x0} x1={lc.x0 + t} y0={0} y1={yT} z0={0} z1={fondo - 20} mat={m.casco} />}
      {ultimo && <Panel x0={lc.x1 - t} x1={lc.x1} y0={0} y1={yT} z0={0} z1={fondo - 20} mat={m.casco} />}
      {!primero && !ultimo && null}
      <Panel
        x0={primero ? lc.x0 + t : lc.x0}
        x1={ultimo ? lc.x1 - t : lc.x1}
        y0={Math.max(0, yT - 320)}
        y1={yT}
        z0={30}
        z1={30 + t}
        mat={m.casco}
      />
    </group>
  );
}

// ---------- Fila superior (cómodas) ----------

function FilaSuperior({ d, l }: { d: Diseno; l: Layout }) {
  const m = useMats();
  const t = d.espesor;
  const fs = l.filaSuperior!;
  const y = fs.y0 - d.luzFrentes / 2 - t;
  return (
    <group>
      <Panel x0={-d.ancho / 2 + t} x1={d.ancho / 2 - t} y0={y} y1={y + t} z0={4} z1={l.profundidadCasco} mat={m.casco} />
    </group>
  );
}

// ---------- Equipamiento de cocina ----------

function EquipoCocina({ d, l, extension }: { d: Diseno; l: Layout; extension: [number, number] }) {
  const m = useMats();
  const eq = equipoLegado(d);
  const ct = d.cocina.espesorCubierta;
  const D = d.profundidad;
  const r = ct / 2;
  const huecos: Hueco[] = [];
  const W = d.ancho;

  let lavaplatos: JSX.Element | null = null;
  if (eq.lavaplatos !== 'ninguno' && d.cuerpos.length) {
    const tipo = eq.lavaplatos;
    const ancho = tipo === 'doble' ? 770 : 400;
    const fondo = tipo === 'doble' ? 380 : 360;
    const escala = Math.min(1, (D - r - 120) / (fondo + 76), (W - 60) / (ancho + 76));
    let cx = centroCuerpo(l, eq.lavaplatosCuerpo);
    const media = (ancho * escala) / 2 + 45;
    cx = Math.max(-W / 2 + media, Math.min(W / 2 - media, cx));
    const cz = Math.max((D - r) * 0.55, 14 + 70 + (fondo * escala) / 2);
    const h = huecosLavaplatos(tipo, cx, Math.min(cz, D - r - 45 - (fondo * escala) / 2), escala);
    huecos.push(...h);
    lavaplatos = <Lavaplatos huecos={h} yTop={d.alto} profundidadCuba={170} grifo={d.cocina.grifo} escala={escala} />;
  }

  let encimera: JSX.Element | null = null;
  if (eq.encimera !== 'ninguna' && d.cuerpos.length) {
    const tipo = eq.encimera;
    const def = medidasEncimera(tipo);
    const escala = Math.min(1, (D - r - 30) / def.fondo, (W - 40) / def.ancho);
    let cx = centroCuerpo(l, eq.encimeraCuerpo);
    const media = (def.ancho * escala) / 2 + 20;
    cx = Math.max(-W / 2 + media, Math.min(W / 2 - media, cx));
    const cz = (14 + D - r) / 2;
    encimera = <Encimera cx={cx} cz={cz} yTop={d.alto} tipo={tipo} escala={escala} />;
  }

  return (
    <group>
      <Cubierta x0={-W / 2 - extension[0]} x1={W / 2 + extension[1]} yTop={d.alto} espesor={ct} profundidad={D} huecos={huecos} copete={d.cocina.copete} />
      {/* Cocina en L: copete sobre el muro lateral en la esquina (el del retorno parte en z = D). */}
      {d.cocina.copete &&
        [-1, 1].map((s) => {
          const e = s < 0 ? extension[0] : extension[1];
          if (e <= 0) return null;
          const xm = s * (W / 2 + e);
          return (
            <group key={s}>
              <Panel x0={Math.min(xm, xm - s * 14)} x1={Math.max(xm, xm - s * 14)} y0={d.alto} y1={d.alto + 42} z0={14} z1={D} mat={m.cubierta} />
              <Cilindro r={7} largo={D - 14} pos={[xm - s * 7, d.alto + 42, (14 + D) / 2]} eje="z" mat={m.cubierta} />
            </group>
          );
        })}
      {lavaplatos}
      {encimera}
      {l.cuerpos
        .filter((c) => c.horno)
        .map((c) => (
          <Horno key={c.cuerpo.id} {...c.horno!} zFrente={l.zFrente} espesor={l.espesorFrente} />
        ))}
    </group>
  );
}

// ---------- Cocina infantil ----------

function CocinaInfantil({ d, l }: { d: Diseno; l: Layout }) {
  const m = useMats();
  const eq = equipoLegado(d);
  const t = d.espesor;
  const D = d.profundidad;
  const hb = altoBaseInfantil(d);
  const base = l.cuerpos.filter((c) => c.indice > 0);
  if (!base.length) return null;
  const xb0 = base[0].x0;
  const xb1 = base[base.length - 1].x1;
  const ct = d.cocina.espesorCubierta;
  const fondoSup = Math.round(D * 0.6);
  const ySup = d.alto - t;
  const yRepisa = hb + (d.alto - hb) * 0.55;
  const huecos: Hueco[] = [];
  let lav: JSX.Element | null = null;
  if (eq.lavaplatos !== 'ninguno') {
    const cx = centroCuerpo(l, Math.max(1, eq.lavaplatosCuerpo));
    const escala = Math.min(0.5, (D - 60) / 460);
    const h = huecosLavaplatos('simple', cx, D * 0.55, escala);
    huecos.push(...h);
    lav = <Lavaplatos huecos={h} yTop={hb} profundidadCuba={70} grifo={d.cocina.grifo} escala={escala} />;
  }
  let enc: JSX.Element | null = null;
  if (eq.encimera !== 'ninguna') {
    const cx = centroCuerpo(l, Math.max(1, eq.encimeraCuerpo));
    const tipo = eq.encimera;
    const escala = Math.min(0.45, (D - 40) / medidasEncimera(tipo).fondo);
    enc = <Encimera cx={cx} cz={D * 0.52} yTop={hb} tipo={tipo} escala={escala} />;
  }
  const anchoMicro = Math.min(320, (xb1 - xb0) * 0.45);
  return (
    <group>
      <Cubierta x0={xb0} x1={xb1} yTop={hb} espesor={ct} profundidad={D} huecos={huecos} copete={false} />
      {lav}
      {enc}
      {/* Respaldo, mueble superior con repisa y microondas de juguete */}
      <Panel x0={xb0} x1={xb1} y0={hb} y1={ySup} z0={0} z1={t} mat={m.frente} />
      <Panel x0={xb0} x1={xb1} y0={ySup} y1={d.alto} z0={0} z1={fondoSup} mat={m.casco} eje="x" />
      <Panel x0={xb1 - t} x1={xb1} y0={hb} y1={ySup} z0={0} z1={fondoSup} mat={m.casco} />
      <Panel x0={xb0} x1={xb1 - t} y0={yRepisa} y1={yRepisa + t} z0={t} z1={fondoSup} mat={m.casco} eje="x" />
      <group>
        <Panel x0={xb1 - t - 20 - anchoMicro} x1={xb1 - t - 20} y0={yRepisa + t} y1={yRepisa + t + 160} z0={t + 10} z1={fondoSup - 10} mat={m.aceroCepillado} />
        <Panel
          x0={xb1 - t - 20 - anchoMicro + 20}
          x1={xb1 - t - 20 - 90}
          y0={yRepisa + t + 25}
          y1={yRepisa + t + 135}
          z0={fondoSup - 10}
          z1={fondoSup - 8}
          mat={m.vidrioNegro}
        />
        {[0, 1, 2].map((k) => (
          <Cilindro key={k} r={9} largo={8} pos={[xb1 - t - 20 - 45, yRepisa + t + 120 - k * 35, fondoSup - 6]} eje="z" mat={m.negroMate} />
        ))}
      </group>
      {/* Hornos de juguete */}
      {l.cuerpos
        .filter((c) => c.horno)
        .map((c) => {
          const h = c.horno!;
          const zC = l.zFrente + l.espesorFrente;
          const r = Math.min(h.x1 - h.x0, h.y1 - h.y0) * 0.27;
          const faja = l.frentes.find((f) => f.tipo === 'faja' && f.cuerpo === c.indice);
          return (
            <group key={c.cuerpo.id}>
              <Panel x0={h.x0} x1={h.x1} y0={h.y0} y1={h.y1} z0={l.zFrente} z1={zC} mat={m.frente} />
              <mesh position={[(h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2 - 15, zC + 1]} material={m.vidrioNegro}>
                <circleGeometry args={[r, 40]} />
              </mesh>
              <Tirador tipo="barra" x={(h.x0 + h.x1) / 2} y={h.y1 - 40} z={zC} vertical={false} espacio={h.x1 - h.x0} />
              {faja &&
                [0.25, 0.5, 0.75].map((p) => (
                  <Cilindro
                    key={p}
                    r={16}
                    largo={14}
                    pos={[faja.rect.x0 + (faja.rect.x1 - faja.rect.x0) * p, (faja.rect.y0 + faja.rect.y1) / 2, zC + 7]}
                    eje="z"
                    mat={m.negroMate}
                  />
                ))}
            </group>
          );
        })}
    </group>
  );
}

// ---------- Mudador ----------

function Mudador({ d }: { d: Diseno }) {
  const m = useMats();
  const t = d.espesor;
  const W = d.ancho;
  const D = d.profundidad;
  const H = d.alto;
  return (
    <group>
      <Panel x0={-W / 2} x1={W / 2} y0={H} y1={H + 110} z0={0} z1={t} mat={m.frente} eje="x" />
      <Panel x0={-W / 2} x1={-W / 2 + t} y0={H} y1={H + 110} z0={t} z1={D * 0.92} mat={m.frente} />
      <Panel x0={W / 2 - t} x1={W / 2} y0={H} y1={H + 110} z0={t} z1={D * 0.92} mat={m.frente} />
      <mesh position={[0, H + 30, (D * 0.92 + t) / 2]} castShadow receiveShadow>
        <boxGeometry args={[W - 2 * t - 10, 50, D * 0.92 - t - 10]} />
        <meshStandardMaterial color="#cfe3ea" roughness={0.9} />
      </mesh>
    </group>
  );
}
