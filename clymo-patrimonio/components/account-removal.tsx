'use client';
import { useState } from 'react';
import { Modal, Field } from './ui';
export function AccountRemoval() {
  const [open, setOpen] = useState(false),
    [confirmation, setConfirmation] = useState(''),
    [agreed, setAgreed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <>
      <button className="button secondary" onClick={() => setOpen(true)}>
        Eliminar mi cuenta
      </button>
      {open && (
        <Modal title="Eliminar mi cuenta" onClose={() => setOpen(false)}>
          <p>
            Se eliminará tu acceso y tu cuenta de autenticación. Los hogares de otros propietarios
            se conservarán. No puedes abandonar un hogar donde eres el único propietario.
          </p>
          <p>
            Debes haber ingresado en los últimos 10 minutos.{' '}
            <a href="/login">Ingresar nuevamente</a>
          </p>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError('');
              try {
                const r = await fetch('/api/account/delete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ confirmation, irreversible: agreed }),
                });
                if (r.ok) window.location.replace('/login');
                else setError((await r.json()).error);
              } catch {
                setError('No pudimos completar la eliminación. Vuelve a intentar.');
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Escribe ELIMINAR MI CUENTA">
              <input
                required
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off"
              />
            </Field>
            <label className="toggle-row">
              <input
                type="checkbox"
                required
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>Entiendo que esta acción no se puede deshacer.</span>
            </label>
            {error && <p role="alert">{error}</p>}
            <button
              className="button danger-button"
              disabled={busy || !agreed || confirmation !== 'ELIMINAR MI CUENTA'}
            >
              Eliminar definitivamente
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
