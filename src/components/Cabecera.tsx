import { useState } from 'react';
import { NOMBRE_PLANTILLA } from '../../shared/catalogo';
import { useApp } from '../store/useApp';
import { IcoCarpeta, IcoCatalogo, IcoDeshacer, IcoRehacer, IcoReiniciar } from './Iconos';

export function Cabecera() {
  const producto = useApp((s) => s.producto);
  const plantilla = useApp((s) => s.diseno.plantilla);
  const cotizacion = useApp((s) => s.cotizacionActual);
  const usuario = useApp((s) => s.usuario);
  const hayPasado = useApp((s) => s.pasado.length > 0);
  const hayFuturo = useApp((s) => s.futuro.length > 0);
  const { set, deshacer, rehacer, restablecer, cerrarSesion, avisar } = useApp.getState();
  const [menu, setMenu] = useState(false);
  const titulo = producto?.modelo || NOMBRE_PLANTILLA[plantilla];

  return (
    <header className="cabecera">
      <a className="marca" href="https://detoditooutlet.cl" target="_blank" rel="noopener" aria-label="De Todito Outlet (abre la tienda)">
        <span className="logo">DTO</span>
        <span className="marca-texto">
          <strong>Diseñador 3D</strong>
          <small>De Todito Outlet</small>
        </span>
      </a>

      <button type="button" className="selector-modelo" onClick={() => set({ modal: 'catalogo' })}>
        {producto?.imagen_url ? (
          <img src={producto.imagen_url} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="selector-modelo-icono">
            <IcoCatalogo />
          </span>
        )}
        <span className="selector-modelo-texto">
          <small>
            {cotizacion ? `${cotizacion.numero} · Cotización ${cotizacion.cliente.nombre}` : producto?.variante ? producto.variante : NOMBRE_PLANTILLA[plantilla]}
          </small>
          <strong>{titulo}</strong>
        </span>
        <span className="selector-modelo-accion">Cambiar mueble</span>
      </button>

      <div className="acciones-cabecera">
        <div className="grupo-historial">
          <button type="button" className="boton-icono" aria-label="Deshacer" title="Deshacer (Ctrl+Z)" disabled={!hayPasado} onClick={deshacer}>
            <IcoDeshacer />
          </button>
          <button type="button" className="boton-icono" aria-label="Rehacer" title="Rehacer (Ctrl+Y)" disabled={!hayFuturo} onClick={rehacer}>
            <IcoRehacer />
          </button>
          <button
            type="button"
            className="boton-icono"
            aria-label="Volver a las medidas originales"
            title="Volver a las medidas originales"
            onClick={() => {
              restablecer();
              avisar('Volviste al diseño original del producto', 'info');
            }}
          >
            <IcoReiniciar />
          </button>
        </div>
        <button type="button" className="boton secundario" aria-label="Cotizaciones y ventas" onClick={() => set({ modal: 'cotizaciones' })}>
          <IcoCarpeta /> <span className="ocultar-movil">Cotizaciones y ventas</span>
        </button>
        {usuario && (
          <div className="menu-usuario">
            <button type="button" className="vendedor" aria-label={`${usuario.esVendedor ? 'Vendedor' : 'Administración'} ${usuario.nombre}`} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)} title={usuario.email}>
              <span className="avatar">{usuario.nombre.trim().charAt(0).toUpperCase()}</span>
              <span className="vendedor-texto ocultar-movil">
                <small>{usuario.esVendedor ? 'Vendedor' : 'Administración'}</small>
                <strong>{usuario.nombre.split(' ').slice(0, 2).join(' ')}</strong>
              </span>
            </button>
            {menu && (
              <div className="menu-desplegable" role="menu" onMouseLeave={() => setMenu(false)}>
                <div className="menu-cabeza">
                  <strong>{usuario.nombre}</strong>
                  <small>{usuario.email}</small>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    set({ modal: 'cotizaciones' });
                  }}
                >
                  Mis cotizaciones y ventas
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenu(false);
                    cerrarSesion();
                  }}
                >
                  Cerrar sesión
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
