import { useEffect, useState } from 'react';
import { Acceso } from './components/Acceso';
import { BarraVisor } from './components/BarraVisor';
import { Cabecera } from './components/Cabecera';
import { ModalCotizaciones, ModalDocumento, ModalRegistrarCotizacion, ModalVenta } from './components/Cotizaciones';
import { EdicionRapida } from './components/EdicionRapida';
import { MenuFlotante } from './components/MenuFlotante';
import { RecomendacionesFlotante } from './components/RecomendacionesFlotante';
import { ModalCatalogo } from './components/Modales';
import { NuevaClave } from './components/NuevaClave';
import { PanelInferior } from './components/PanelInferior';
import { Visor3D } from './components/Visor3D';
import { useApp } from './store/useApp';

// El enlace de recuperación del correo vuelve con ?nueva-clave=1 (o con #type=recovery si Supabase
// usa la URL del sitio). Se lee al cargar, antes de que Supabase limpie la dirección.
const VIENE_DE_RECUPERAR = new URLSearchParams(window.location.search).has('nueva-clave') || /type=recovery/.test(window.location.hash);

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
  const [nuevaClave, setNuevaClave] = useState(VIENE_DE_RECUPERAR);
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
  if (nuevaClave)
    return (
      <>
        <NuevaClave
          alTerminar={() => {
            window.history.replaceState(null, '', window.location.pathname);
            setNuevaClave(false);
          }}
        />
        <Avisos />
      </>
    );
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
      <main className="area-trabajo colores-plegados">
        <section className="visor" aria-label="Vista 3D del mueble">
          {cargado ? (
            <Visor3D />
          ) : (
            <div className="cargando-visor">{errorCarga ? `No se pudo conectar con el servidor: ${errorCarga}` : 'Preparando el taller 3D…'}</div>
          )}
          {cargado && <BarraVisor />}
          {cargado && <EdicionRapida />}
        </section>
      </main>
      <PanelInferior />
      {cargado && !modal && <MenuFlotante />}
      {cargado && !modal && <RecomendacionesFlotante />}
      {modal === 'catalogo' && <ModalCatalogo />}
      {modal === 'registrarCotizacion' && <ModalRegistrarCotizacion />}
      {modal === 'cotizaciones' && <ModalCotizaciones />}
      {modal === 'documento' && <ModalDocumento />}
      {modal === 'venta' && <ModalVenta />}
      <Avisos />
    </div>
  );
}
