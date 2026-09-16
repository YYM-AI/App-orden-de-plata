'use client';
import { useEffect, useState } from 'react';
const LEGACY_KEY = 'clymo-patrimonio:synthetic:v1';
export function Login() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [legacy, setLegacy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      setLegacy(localStorage.getItem(LEGACY_KEY) !== null);
    } catch {
      /* No storage is required. */
    }
    if (new URLSearchParams(location.search).has('error'))
      setError('No se pudo validar el acceso. Ingresa nuevamente o consulta al administrador.');
    setReady(true);
  }, []);
  return (
    <main className="login-page">
      <section className="panel login-card">
        <div className="brand">
          <span className="brand-symbol">c</span>
          <span>
            clymo<small>PATRIMONIO</small>
          </span>
        </div>
        <p className="eyebrow">STAGING — DATOS FICTICIOS</p>
        <h1>Ingresa a tu hogar.</h1>
        <p>Solo personas autorizadas. No hay registro público.</p>
        {legacy && (
          <div className="inline-note">
            <p>
              Encontramos la antigua demo local. Sus datos no se subirán a la base de datos.
              Descártalos para continuar con el hogar autorizado.
            </p>
            <button
              className="button secondary"
              onClick={() => {
                localStorage.removeItem(LEGACY_KEY);
                setLegacy(false);
              }}
            >
              Descartar demo local anterior
            </button>
          </div>
        )}
        <form
          className="form"
          method="post"
          action="/api/auth/login"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError('');
            const f = new FormData(e.currentTarget);
            try {
              const r = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: f.get('email'), password: f.get('password') }),
              });
              const result = await r.json();
              if (!r.ok) {
                setError(result.error);
                return;
              }
              window.location.replace('/');
            } catch {
              setError('No pudimos conectar. Inténtalo nuevamente.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Correo de acceso
            <input name="email" type="email" autoComplete="username" required maxLength={254} />
          </label>
          <label>
            Contraseña de acceso
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={256}
            />
          </label>
          {error && (
            <p role="alert" className="inline-note">
              {error}
            </p>
          )}
          <button className="button primary" disabled={!ready || busy || legacy}>
            {busy ? 'Validando acceso…' : 'Ingresar'}
          </button>
        </form>
        <noscript>Activa JavaScript para ingresar de forma segura.</noscript>
        <p className="muted">
          Usa únicamente tu cuenta de prueba autorizada. Nunca ingreses claves bancarias ni
          información financiera real.
        </p>
      </section>
    </main>
  );
}
