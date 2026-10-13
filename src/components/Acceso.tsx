import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api/cliente';
import { useApp } from '../store/useApp';

/** Pantalla de ingreso: la herramienta es de uso exclusivo de los vendedores. */
export function Acceso() {
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [password, setPassword] = useState('');
  const [codigo, setCodigo] = useState('');
  const [requiereCodigo, setRequiereCodigo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { iniciarSesion, avisar } = useApp.getState();

  useEffect(() => {
    api
      .opcionesRegistro()
      .then((r) => setRequiereCodigo(r.requiereCodigo))
      .catch(() => undefined);
  }, []);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const r =
        modo === 'login'
          ? await api.login(email, password)
          : await api.registro({ nombre, email, telefono, password, codigo: codigo || undefined });
      iniciarSesion(r.token, r.usuario);
      avisar(modo === 'login' ? `Hola, ${r.usuario.nombre.split(' ')[0]}` : 'Cuenta de vendedor creada');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="acceso">
      <section className="acceso-marca">
        <div className="marca">
          <span className="logo">DTO</span>
          <span className="marca-texto">
            <strong>Diseñador 3D</strong>
            <small>De Todito Outlet · Vendedores</small>
          </span>
        </div>
        <h1>Diseña con el cliente, cotiza y registra la venta en un solo lugar</h1>
        <ul>
          <li>Parte de los muebles del catálogo de la tienda y ajústalos a medida en 3D.</li>
          <li>Registra la cotización a nombre del cliente con todo el detalle técnico.</li>
          <li>Lleva tu registro de cotizaciones y ventas, y envíaselas al cliente por WhatsApp.</li>
        </ul>
      </section>

      <section className="acceso-tarjeta" aria-label={modo === 'login' ? 'Ingreso de vendedores' : 'Registro de vendedor'}>
        <h2>{modo === 'login' ? 'Ingreso de vendedores' : 'Registro de vendedor'}</h2>
        <div className="segmentado ancho" role="tablist">
          <button type="button" role="tab" aria-selected={modo === 'login'} className={modo === 'login' ? 'activo' : ''} onClick={() => setModo('login')}>
            Ingresar
          </button>
          <button type="button" role="tab" aria-selected={modo === 'registro'} className={modo === 'registro' ? 'activo' : ''} onClick={() => setModo('registro')}>
            Registrarme como vendedor
          </button>
        </div>
        <form className="formulario" onSubmit={enviar}>
          {modo === 'registro' && (
            <>
              <label>
                Nombre y apellido
                <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required minLength={3} />
                <small className="tenue">Aparece como vendedor en tus cotizaciones.</small>
              </label>
              <label>
                Teléfono (opcional)
                <input value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" inputMode="tel" placeholder="+56 9 1234 5678" />
              </label>
            </>
          )}
          <label>
            Correo
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
          </label>
          <label>
            Contraseña
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={modo === 'registro' ? 8 : 1}
            />
            {modo === 'registro' && <small className="tenue">Mínimo 8 caracteres.</small>}
          </label>
          {modo === 'registro' && requiereCodigo && (
            <label>
              Código de vendedor
              <input value={codigo} onChange={(e) => setCodigo(e.target.value)} required autoComplete="off" />
              <small className="tenue">Lo entrega la administración de la tienda.</small>
            </label>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="boton primario ancho" disabled={enviando}>
            {enviando ? 'Enviando…' : modo === 'login' ? 'Ingresar' : 'Crear cuenta de vendedor'}
          </button>
        </form>
      </section>
    </div>
  );
}
