import { useEffect } from 'react';
import { Acceso } from './components/Acceso';
import { BarraVisor } from './components/BarraVisor';
import { Cabecera } from './components/Cabecera';
import { ModalCotizaciones, ModalDocumento, ModalRegistrarCotizacion, ModalVenta } from './components/Cotizaciones';
import { ModalCatalogo } from './components/Modales';
import { PanelColores } from './components/PanelColores';
import { PanelInferior } from './components/PanelInferior';
import { Visor3D } from './components/Visor3D';
import { useApp } from './store/useApp';

function Avisos() {
  const avisos = useApp((s) => s.avisos);
  return (
    <div className="avisos" aria-live="polite">
      {avisos.map((a) => (
        <div key={a.id} className={`aviso ${a.tipo}`}>
          {a.texto}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const modal = useApp((s) => s.modal);
  const sesion = useApp((s) => s.sesion);
  const errorCarga = useApp((s) => s.errorCarga);
  const cargado = useApp((s) => s.catalogo !== null && s.materiales !== null);

  useEffect(() => {
    useApp.getState().cargarDatos();
  }, []);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select')) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useApp.getState().rehacer();
        else useApp.getState().deshacer();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        useApp.getState().rehacer();
      }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  // La herramienta es solo para vendedores: sin sesión se muestra el ingreso.
  if (sesion === 'verificando') return <div className="cargando-visor pantalla">Verificando sesión…</div>;
  if (sesion === 'invitado')
    return (
      <>
        <Acceso />
        <Avisos />
      </>
    );

  return (
    <div className="app">
      <Cabecera />
      <main className="area-trabajo">
        <section className="visor" aria-label="Vista 3D del mueble">
          {cargado ? (
            <Visor3D />
          ) : (
            <div className="cargando-visor">{errorCarga ? `No se pudo conectar con el servidor: ${errorCarga}` : 'Preparando el taller 3D…'}</div>
          )}
          {cargado && <BarraVisor />}
        </section>
        <PanelColores />
      </main>
      <PanelInferior />
      {modal === 'catalogo' && <ModalCatalogo />}
      {modal === 'registrarCotizacion' && <ModalRegistrarCotizacion />}
      {modal === 'cotizaciones' && <ModalCotizaciones />}
      {modal === 'documento' && <ModalDocumento />}
      {modal === 'venta' && <ModalVenta />}
      <Avisos />
    </div>
  );
}
