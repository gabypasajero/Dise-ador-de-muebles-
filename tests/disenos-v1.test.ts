// Diseños y cotizaciones guardados con la versión anterior del motor (versión 1: con
// `retorno`, la encimera y el lavaplatos por índice y sin especiero ni U).
import { describe, expect, it } from 'vitest';
import { bisagraDe, retornoDe, ubicarEquipos } from '../shared/layout';
import { activarAereos, advertencias, ejecutar, fijarForma, normalizar } from '../shared/reglas';
import { precioCocina } from '../shared/tarifas';
import { validarDiseno } from '../shared/validar';
import type { Diseno, DisenoGuardado, Encimera, Lavaplatos } from '../shared/tipos';

// Diseños guardados con la versión anterior del motor (generados con shared/ de la versión 1:
// git show HEAD:shared/*.ts y el script gen-v1.ts). normalizar() debe abrirlos bien.
/* eslint-disable */
const GUARDADOS_V1: Record<string, unknown> = {
  fullEquipo: {"version":1,"plantilla":"cocina","productoId":16,"nombreModelo":"Cocina full equipo: horno, encimera y lavaplatos","ancho":1500,"alto":900,"profundidad":600,"cuerpos":[{"id":"cmve5vtql1","tipo":"horno","puertas":0,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":600},{"id":"cmve5vtql2","tipo":"frentes","puertas":0,"bisagra":"izq","cajones":3,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":450},{"id":"cmve5vtql3","tipo":"frentes","puertas":1,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":450}],"luzFrentes":3,"separacionCuerpos":0,"zocalo":100,"espesor":15,"estructura":"modular","tirador":"barra","materiales":{"frente":"pino-casina","casco":"blanco","cubierta":"clasic","tirador":"acero"},"cocina":{"encimera":"4","encimeraCuerpo":0,"lavaplatos":"simple","lavaplatosCuerpo":2,"grifo":"negro","copete":true,"espesorCubierta":30,"vueloCubierta":25},"tocador":{"espejo":"ovalado","luz":"neutra","altoCubierta":760,"cajonesIzq":0,"cajonesDer":4,"cajonesCentro":1,"repisasLaterales":true},"filaSuperior":0,"mudador":false,"imagenFrontal":null,"aereos":{"activo":false,"montaje":"mural","alto":600,"profundidad":330,"elevacion":1450,"alineacion":"centro","cuerpos":[]},"retorno":null},
  fullEquipoLDerAereos: {"version":1,"plantilla":"cocina","productoId":16,"nombreModelo":"Cocina full equipo: horno, encimera y lavaplatos","ancho":1500,"alto":900,"profundidad":600,"cuerpos":[{"id":"cmve5vtql4","tipo":"horno","puertas":0,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":600},{"id":"cmve5vtql5","tipo":"frentes","puertas":0,"bisagra":"izq","cajones":3,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":450},{"id":"cmve5vtql6","tipo":"frentes","puertas":1,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":450}],"luzFrentes":3,"separacionCuerpos":0,"zocalo":100,"espesor":15,"estructura":"modular","tirador":"barra","materiales":{"frente":"pino-casina","casco":"blanco","cubierta":"clasic","tirador":"acero"},"cocina":{"encimera":"4","encimeraCuerpo":0,"lavaplatos":"simple","lavaplatosCuerpo":2,"grifo":"negro","copete":true,"espesorCubierta":30,"vueloCubierta":25},"tocador":{"espejo":"ovalado","luz":"neutra","altoCubierta":760,"cajonesIzq":0,"cajonesDer":4,"cajonesCentro":1,"repisasLaterales":true},"filaSuperior":0,"mudador":false,"imagenFrontal":null,"aereos":{"activo":true,"montaje":"mural","alto":600,"profundidad":330,"elevacion":1450,"alineacion":"izq","cuerpos":[{"id":"cmve5vtqm8","tipo":"campana","puertas":2,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":0,"colgador":false,"alto":0,"ancho":700},{"id":"cmve5vtqm9","tipo":"frentes","puertas":2,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":700},{"id":"cmve5vtqma","tipo":"frentes","puertas":2,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":700}]},"retorno":{"lado":"der","largo":1650,"profundidad":600,"cuerpos":[{"id":"cmve5vtqob","tipo":"frentes","puertas":0,"bisagra":"izq","cajones":3,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":450},{"id":"cmve5vtql7","tipo":"frentes","puertas":2,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":600}]}},
  lavaplatos2m: {"version":1,"plantilla":"cocina","productoId":24,"nombreModelo":"Mueble de cocina con encimera y lavaplatos","ancho":2000,"alto":900,"profundidad":550,"cuerpos":[{"id":"cmve5vtqoc","tipo":"frentes","puertas":0,"bisagra":"izq","cajones":3,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":667},{"id":"cmve5vtqod","tipo":"frentes","puertas":2,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":1333}],"luzFrentes":3,"separacionCuerpos":0,"zocalo":100,"espesor":15,"estructura":"modular","tirador":"barra","materiales":{"frente":"gris-blanqueado","casco":"blanco","cubierta":"clasic","tirador":"acero"},"cocina":{"encimera":"2","encimeraCuerpo":0,"lavaplatos":"simple","lavaplatosCuerpo":1,"grifo":"negro","copete":true,"espesorCubierta":30,"vueloCubierta":25},"tocador":{"espejo":"ovalado","luz":"neutra","altoCubierta":760,"cajonesIzq":0,"cajonesDer":4,"cajonesCentro":1,"repisasLaterales":true},"filaSuperior":0,"mudador":false,"imagenFrontal":null,"aereos":{"activo":true,"montaje":"mural","alto":700,"profundidad":350,"elevacion":1450,"alineacion":"centro","cuerpos":[{"id":"cmve5vtqpe","tipo":"campana","puertas":2,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":0,"colgador":false,"alto":0,"ancho":500},{"id":"cmve5vtqpf","tipo":"frentes","puertas":2,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":500},{"id":"cmve5vtqpg","tipo":"frentes","puertas":2,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":500}]},"retorno":null},
  lIzqLavaplatosDoble: {"version":1,"plantilla":"cocina","productoId":16,"nombreModelo":"Cocina full equipo: horno, encimera y lavaplatos","ancho":2400,"alto":900,"profundidad":600,"cuerpos":[{"id":"cmve5vtqph","tipo":"horno","puertas":0,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":600},{"id":"cmve5vtqpi","tipo":"frentes","puertas":0,"bisagra":"izq","cajones":3,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":900},{"id":"cmve5vtqpj","tipo":"frentes","puertas":1,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":900}],"luzFrentes":3,"separacionCuerpos":0,"zocalo":100,"espesor":15,"estructura":"modular","tirador":"barra","materiales":{"frente":"pino-casina","casco":"blanco","cubierta":"clasic","tirador":"acero"},"cocina":{"encimera":"4","encimeraCuerpo":0,"lavaplatos":"doble","lavaplatosCuerpo":1,"grifo":"negro","copete":true,"espesorCubierta":30,"vueloCubierta":25},"tocador":{"espejo":"ovalado","luz":"neutra","altoCubierta":760,"cajonesIzq":0,"cajonesDer":4,"cajonesCentro":1,"repisasLaterales":true},"filaSuperior":0,"mudador":false,"imagenFrontal":null,"aereos":{"activo":true,"montaje":"mural","alto":600,"profundidad":330,"elevacion":1450,"alineacion":"izq","cuerpos":[{"id":"cmve5vtqql","tipo":"frentes","puertas":2,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":738},{"id":"cmve5vtqqn","tipo":"frentes","puertas":2,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":738},{"id":"cmve5vtqqm","tipo":"campana","puertas":2,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":0,"colgador":false,"alto":0,"ancho":738},{"id":"cmve5vtqqo","tipo":"frentes","puertas":2,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":736}]},"retorno":{"lado":"izq","largo":1600,"profundidad":550,"cuerpos":[{"id":"cmve5vtqqk","tipo":"frentes","puertas":2,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":1000}]}},
  compacto5c: {"version":1,"plantilla":"compacto","productoId":154,"nombreModelo":"Mueble de cocina compacto 5C","ancho":1800,"alto":1900,"profundidad":400,"cuerpos":[{"id":"cmve5vtqsp","tipo":"frentes","puertas":2,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":740},{"id":"cmve5vtqsq","tipo":"frentes","puertas":0,"bisagra":"izq","cajones":3,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":370},{"id":"cmve5vtqsr","tipo":"frentes","puertas":2,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":690}],"luzFrentes":3,"separacionCuerpos":0,"zocalo":60,"espesor":15,"estructura":"unica","tirador":"barra","materiales":{"frente":"pino-nebraska","casco":"blanco","cubierta":"clasic","tirador":"acero"},"cocina":{"encimera":"3","encimeraCuerpo":1,"lavaplatos":"ninguno","lavaplatosCuerpo":0,"grifo":"negro","copete":false,"espesorCubierta":30,"vueloCubierta":25},"tocador":{"espejo":"ovalado","luz":"neutra","altoCubierta":760,"cajonesIzq":0,"cajonesDer":4,"cajonesCentro":1,"repisasLaterales":true},"filaSuperior":0,"mudador":false,"imagenFrontal":null,"aereos":{"activo":true,"montaje":"apoyado","alto":560,"profundidad":300,"elevacion":880,"alineacion":"centro","cuerpos":[{"id":"cmve5vtqss","tipo":"frentes","puertas":2,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":830},{"id":"cmve5vtqst","tipo":"frentes","puertas":1,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":410},{"id":"cmve5vtqsu","tipo":"nicho","puertas":1,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":0,"colgador":false,"alto":0,"ancho":560,"abatible":true}]},"retorno":null},
  compacto3c: {"version":1,"plantilla":"compacto","productoId":153,"nombreModelo":"Mueble de cocina compacto 3C","ancho":1100,"alto":1920,"profundidad":400,"cuerpos":[{"id":"cmve5vtqsv","tipo":"frentes","puertas":2,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":600},{"id":"cmve5vtqsw","tipo":"frentes","puertas":1,"bisagra":"der","cajones":1,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":500,"cajonesArriba":true}],"luzFrentes":3,"separacionCuerpos":0,"zocalo":60,"espesor":15,"estructura":"unica","tirador":"barra","materiales":{"frente":"verde-salvia","casco":"blanco","cubierta":"calacatta","tirador":"acero"},"cocina":{"encimera":"ninguna","encimeraCuerpo":0,"lavaplatos":"ninguno","lavaplatosCuerpo":0,"grifo":"negro","copete":false,"espesorCubierta":30,"vueloCubierta":25},"tocador":{"espejo":"ovalado","luz":"neutra","altoCubierta":760,"cajonesIzq":0,"cajonesDer":4,"cajonesCentro":1,"repisasLaterales":true},"filaSuperior":0,"mudador":false,"imagenFrontal":null,"aereos":{"activo":true,"montaje":"apoyado","alto":580,"profundidad":300,"elevacion":880,"alineacion":"centro","cuerpos":[{"id":"cmve5vtqsx","tipo":"frentes","puertas":2,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":600},{"id":"cmve5vtqsy","tipo":"nicho","puertas":1,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":0,"colgador":false,"alto":0,"ancho":500,"abatible":true}]},"retorno":null},
  infantil: {"version":1,"plantilla":"cocina-infantil","productoId":null,"nombreModelo":"Cocina infantil","ancho":900,"alto":1000,"profundidad":300,"cuerpos":[{"id":"cmve5vtqtz","tipo":"frentes","puertas":1,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":3,"colgador":false,"alto":0,"ancho":245},{"id":"cmve5vtqt10","tipo":"frentes","puertas":1,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":327},{"id":"cmve5vtqt11","tipo":"horno","puertas":0,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":328}],"luzFrentes":3,"separacionCuerpos":0,"zocalo":40,"espesor":15,"estructura":"unica","tirador":"boton","materiales":{"frente":"blanco","casco":"blanco","cubierta":"blanco-liso","tirador":"blanco"},"cocina":{"encimera":"2","encimeraCuerpo":2,"lavaplatos":"simple","lavaplatosCuerpo":1,"grifo":"cromado","copete":false,"espesorCubierta":18,"vueloCubierta":10},"tocador":{"espejo":"ovalado","luz":"neutra","altoCubierta":760,"cajonesIzq":0,"cajonesDer":4,"cajonesCentro":1,"repisasLaterales":true},"filaSuperior":0,"mudador":false,"imagenFrontal":null,"aereos":{"activo":false,"montaje":"mural","alto":600,"profundidad":330,"elevacion":1450,"alineacion":"centro","cuerpos":[]},"retorno":null},
  closet: {"version":1,"plantilla":"closet","productoId":152,"nombreModelo":"Clóset 4 puertas 4 cajones","ancho":1500,"alto":1700,"profundidad":400,"cuerpos":[{"id":"cmve5vtqt12","tipo":"frentes","puertas":1,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":4,"colgador":false,"alto":0,"ancho":375},{"id":"cmve5vtqt13","tipo":"frentes","puertas":2,"bisagra":"izq","cajones":4,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":true,"alto":0,"ancho":750},{"id":"cmve5vtqt14","tipo":"frentes","puertas":1,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":4,"colgador":false,"alto":0,"ancho":375}],"luzFrentes":3,"separacionCuerpos":0,"zocalo":60,"espesor":15,"estructura":"unica","tirador":"boton","materiales":{"frente":"blanco","casco":"blanco","cubierta":"blanco-liso","tirador":"blanco"},"cocina":{"encimera":"ninguna","encimeraCuerpo":0,"lavaplatos":"ninguno","lavaplatosCuerpo":0,"grifo":"negro","copete":false,"espesorCubierta":30,"vueloCubierta":25},"tocador":{"espejo":"ovalado","luz":"neutra","altoCubierta":760,"cajonesIzq":0,"cajonesDer":4,"cajonesCentro":1,"repisasLaterales":true},"filaSuperior":0,"mudador":false,"imagenFrontal":null,"aereos":{"activo":false,"montaje":"mural","alto":600,"profundidad":330,"elevacion":1450,"alineacion":"centro","cuerpos":[]},"retorno":null},
  comoda: {"version":1,"plantilla":"comoda","productoId":null,"nombreModelo":"Cómoda 4 cajones","ancho":700,"alto":780,"profundidad":370,"cuerpos":[{"id":"cmve5vtqu15","tipo":"frentes","puertas":0,"bisagra":"izq","cajones":4,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":700}],"luzFrentes":3,"separacionCuerpos":0,"zocalo":60,"espesor":15,"estructura":"unica","tirador":"boton","materiales":{"frente":"blanco","casco":"blanco","cubierta":"blanco-liso","tirador":"blanco"},"cocina":{"encimera":"ninguna","encimeraCuerpo":0,"lavaplatos":"ninguno","lavaplatosCuerpo":0,"grifo":"negro","copete":false,"espesorCubierta":30,"vueloCubierta":25},"tocador":{"espejo":"ovalado","luz":"neutra","altoCubierta":760,"cajonesIzq":0,"cajonesDer":4,"cajonesCentro":1,"repisasLaterales":true},"filaSuperior":0,"mudador":false,"imagenFrontal":null,"aereos":{"activo":false,"montaje":"mural","alto":600,"profundidad":330,"elevacion":1450,"alineacion":"centro","cuerpos":[]},"retorno":null},
  cajoneraAncha: {"version":1,"plantilla":"cocina","productoId":33,"nombreModelo":"Mueble de cocina con encimera, 2 puertas y 3 cajones","ancho":2200,"alto":900,"profundidad":550,"cuerpos":[{"id":"cmve5vtqu16","tipo":"frentes","puertas":0,"bisagra":"izq","cajones":3,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":1000},{"id":"cmve5vtqu17","tipo":"frentes","puertas":2,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":600},{"id":"cmve5vtqu18","tipo":"hueco","puertas":0,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":600}],"luzFrentes":3,"separacionCuerpos":0,"zocalo":100,"espesor":15,"estructura":"modular","tirador":"barra","materiales":{"frente":"gris-blanqueado","casco":"blanco","cubierta":"clasic","tirador":"acero"},"cocina":{"encimera":"3","encimeraCuerpo":1,"lavaplatos":"ninguno","lavaplatosCuerpo":0,"grifo":"negro","copete":true,"espesorCubierta":30,"vueloCubierta":25},"tocador":{"espejo":"ovalado","luz":"neutra","altoCubierta":760,"cajonesIzq":0,"cajonesDer":4,"cajonesCentro":1,"repisasLaterales":true},"filaSuperior":0,"mudador":false,"imagenFrontal":null,"aereos":{"activo":false,"montaje":"mural","alto":600,"profundidad":330,"elevacion":1450,"alineacion":"centro","cuerpos":[]},"retorno":null},
  sinAereosNiRetorno: {"version":1,"plantilla":"cocina","productoId":42,"nombreModelo":"Mueble de cocina con encimera y 2 puertas","ancho":800,"alto":900,"profundidad":550,"cuerpos":[{"id":"cmve5vtqv19","tipo":"frentes","puertas":2,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":800}],"luzFrentes":3,"separacionCuerpos":0,"zocalo":100,"espesor":15,"estructura":"modular","tirador":"barra","materiales":{"frente":"gris-blanqueado","casco":"blanco","cubierta":"clasic","tirador":"acero"},"cocina":{"encimera":"3","encimeraCuerpo":0,"lavaplatos":"ninguno","lavaplatosCuerpo":0,"grifo":"negro","copete":true,"espesorCubierta":30,"vueloCubierta":25},"tocador":{"espejo":"ovalado","luz":"neutra","altoCubierta":760,"cajonesIzq":0,"cajonesDer":4,"cajonesCentro":1,"repisasLaterales":true},"filaSuperior":0,"mudador":false,"imagenFrontal":null},
  lDerTresPuertas: {"version":1,"plantilla":"cocina","productoId":16,"nombreModelo":"Cocina full equipo: horno, encimera y lavaplatos","ancho":1800,"alto":900,"profundidad":600,"cuerpos":[{"id":"cmve5vtqv1a","tipo":"horno","puertas":0,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":600},{"id":"cmve5vtqv1b","tipo":"frentes","puertas":3,"bisagra":"der","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":1200}],"luzFrentes":3,"separacionCuerpos":0,"zocalo":100,"espesor":15,"estructura":"modular","tirador":"barra","materiales":{"frente":"pino-casina","casco":"blanco","cubierta":"clasic","tirador":"acero"},"cocina":{"encimera":"4","encimeraCuerpo":0,"lavaplatos":"simple","lavaplatosCuerpo":1,"grifo":"negro","copete":true,"espesorCubierta":30,"vueloCubierta":25},"tocador":{"espejo":"ovalado","luz":"neutra","altoCubierta":760,"cajonesIzq":0,"cajonesDer":4,"cajonesCentro":1,"repisasLaterales":true},"filaSuperior":0,"mudador":false,"imagenFrontal":null,"aereos":{"activo":false,"montaje":"mural","alto":600,"profundidad":330,"elevacion":1450,"alineacion":"centro","cuerpos":[]},"retorno":{"lado":"der","largo":1200,"profundidad":600,"cuerpos":[{"id":"cmve5vtqv1d","tipo":"frentes","puertas":2,"bisagra":"izq","cajones":0,"columnasCajones":1,"altoCajon":0,"repisas":1,"colgador":false,"alto":0,"ancho":600}]}},
};

const abrir = (k: string) => normalizar(JSON.parse(JSON.stringify(GUARDADOS_V1[k])) as DisenoGuardado);
const encimera = (d: Diseno) => d.equipos.find((e): e is Encimera => e.tipo === 'encimera');
const lavaplatos = (d: Diseno) => d.equipos.find((e): e is Lavaplatos => e.tipo === 'lavaplatos');
const viejo = (k: string) => GUARDADOS_V1[k] as Record<string, any>;

describe('diseños guardados con la versión anterior', () => {
  it('todos abren válidos, en la versión 2 y sin cambiar al volver a abrirlos', () => {
    for (const k of Object.keys(GUARDADOS_V1)) {
      const d = abrir(k);
      expect(d.version, k).toBe(2);
      expect(validarDiseno(d), k).toEqual([]);
      expect(normalizar(JSON.parse(JSON.stringify(d))), k).toEqual(d);
      expect('retorno' in d, k).toBe(false);
      expect(Object.keys(d.cocina).sort(), k).toEqual(['copete', 'espesorCubierta', 'grifo', 'vueloCubierta']);
    }
  });

  it('la encimera y el lavaplatos pasan de índices a ids de módulo, con llave y centrado', () => {
    const v = viejo('fullEquipo');
    const d = abrir('fullEquipo');
    expect(d.cuerpos.map((c) => c.id)).toEqual(v.cuerpos.map((c: any) => c.id));
    expect(encimera(d)).toMatchObject({ tramo: 'base', modulo: v.cuerpos[v.cocina.encimeraCuerpo].id, platos: '4', campana: false });
    expect(lavaplatos(d)).toMatchObject({ tramo: 'base', modulo: v.cuerpos[v.cocina.lavaplatosCuerpo].id, modelo: 'simple', llave: true, posicion: 'centro', margen: 50 });
    expect(precioCocina(d).total).toBe(550000);
  });

  it('la L vieja pasa a un lado con sus módulos y la campana de los aéreos pasa a la encimera', () => {
    const v = viejo('fullEquipoLDerAereos');
    const d = abrir('fullEquipoLDerAereos');
    expect(d.lados.izq).toBeNull();
    expect(d.lados.der).toMatchObject({ largo: v.retorno.largo, profundidad: v.retorno.profundidad });
    expect(d.lados.der!.cuerpos.map((c) => c.id)).toEqual(v.retorno.cuerpos.map((c: any) => c.id));
    expect(retornoDe(d)!.lado).toBe('der');
    expect(encimera(d)!.campana).toBe(true);
    const campana = d.aereos.cuerpos.find((c) => c.tipo === 'campana')!;
    expect(campana.campanaDe).toBe(encimera(d)!.id);
    // Los aéreos viejos no tenían lado: no se inventa uno.
    expect(d.aereos.cuadrado).toBe(false);
    expect(d.aereos.lados).toEqual({ izq: null, der: null });
    expect(ubicarEquipos(d).find((u) => u.tipo === 'campana')!.montaje).toBe('aereo');
  });

  it('la campana que había quedado fuera de la encimera vuelve a quedar sobre ella', () => {
    const v = viejo('lIzqLavaplatosDoble');
    const iCampanaVieja = v.aereos.cuerpos.findIndex((c: any) => c.tipo === 'campana');
    const d = abrir('lIzqLavaplatosDoble');
    const u = ubicarEquipos(d);
    const enc = u.find((x) => x.tipo === 'encimera')!;
    const campana = u.find((x) => x.tipo === 'campana')!;
    expect(campana.indice).not.toBe(iCampanaVieja);
    expect(Math.abs(campana.mundo.x - enc.mundo.x)).toBeLessThan(1);
    expect(advertencias(d).some((a) => a.texto.includes('no queda sobre la encimera'))).toBe(false);
    // El largo de los aéreos se conserva y el lavaplatos doble sigue en su módulo.
    expect(d.aereos.cuerpos.reduce((s, c) => s + c.ancho, 0)).toBe(v.aereos.cuerpos.reduce((s: number, c: any) => s + c.ancho, 0));
    expect(lavaplatos(d)).toMatchObject({ modelo: 'doble', modulo: v.cuerpos[1].id });
    expect(d.lados.izq).toMatchObject({ largo: 1600, profundidad: 550 });
  });

  it('la encimera de 2 platos de la cocina adulta pasa a 3 y los aéreos más cortos siguen centrados', () => {
    const d = abrir('lavaplatos2m');
    expect(encimera(d)!.platos).toBe('3');
    expect(d.aereos).toMatchObject({ alineacion: 'centro', alto: 700, profundidad: 350, cuadrado: false });
    expect(d.aereos.cuerpos.reduce((s, c) => s + c.ancho, 0)).toBe(1500);
    expect(encimera(d)!.campana).toBe(true);
  });

  it('una cajonera de más de 90 cm se divide en cajoneras iguales sin mover lo demás', () => {
    const v = viejo('cajoneraAncha');
    const d = abrir('cajoneraAncha');
    expect(d.cuerpos.map((c) => [c.tipo, c.ancho, c.cajones])).toEqual([
      ['frentes', 500, 3],
      ['frentes', 500, 3],
      ['frentes', 600, 0],
      ['hueco', 600, 0],
    ]);
    expect(d.ancho).toBe(v.ancho);
    expect(encimera(d)!.modulo).toBe(v.cuerpos[1].id);
  });

  it('el compacto, la cocina infantil y los demás muebles conservan lo que tenían', () => {
    const c5 = abrir('compacto5c');
    expect(c5.aereos).toMatchObject({ activo: true, montaje: 'apoyado' });
    expect(encimera(c5)).toMatchObject({ platos: '3', modulo: viejo('compacto5c').cuerpos[1].id, campana: false });
    expect(abrir('compacto3c').equipos).toEqual([]);
    const inf = abrir('infantil');
    expect(inf.equipos.map((e) => e.tipo)).toEqual(['encimera', 'lavaplatos']);
    expect(encimera(inf)!.platos).toBe('2');
    expect(lavaplatos(inf)!.llave).toBe(false);
    for (const k of ['closet', 'comoda']) {
      const d = abrir(k);
      expect(d.equipos).toEqual([]);
      expect(d.cuerpos.map((c) => c.ancho)).toEqual(viejo(k).cuerpos.map((c: any) => c.ancho));
    }
  });

  it('un diseño sin aéreos ni retorno guardados abre como lineal', () => {
    const d = abrir('sinAereosNiRetorno');
    expect(d.lados).toEqual({ izq: null, der: null });
    expect(d.aereos).toMatchObject({ activo: false, cuadrado: true, cuerpos: [] });
    expect(encimera(d)!.platos).toBe('3');
  });

  it('el módulo de 3 puertas conserva la apertura de su puerta impar', () => {
    const d = abrir('lDerTresPuertas');
    const c = d.cuerpos[1];
    expect(c).toMatchObject({ puertas: 3, bisagra: 'der' });
    expect([0, 1, 2].map((k) => bisagraDe(c, k))).toEqual(['der', 'izq', 'der']);
    expect(lavaplatos(d)!.modulo).toBe(c.id);
  });

  it('se siguen editando con las operaciones nuevas', () => {
    let d = abrir('fullEquipoLDerAereos');
    d = fijarForma(d, 'U');
    d = activarAereos(d, true);
    expect(validarDiseno(d)).toEqual([]);
    const r = ejecutar(d, { op: 'agregarModulo', tramo: 'der', preset: 'especiero', posicion: 0 });
    expect(r.ok).toBe(true);
    expect(validarDiseno(r.diseno)).toEqual([]);
  });
});
