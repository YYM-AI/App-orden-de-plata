'use client';
import { useState } from 'react';
import { useDemo } from './demo-provider';
import { Modal, Field } from './ui';
export function SecuritySettings() {
  const { state, canEdit, userId, refresh, logout } = useDemo();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState<'household' | 'account' | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [agreed, setAgreed] = useState(false);
  async function post(endpoint: string, input: unknown) {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!r.ok) {
      const result = await r.json();
      throw new Error(result.error);
    }
    return r;
  }
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo completar la operación.');
    } finally {
      setBusy(false);
    }
  }
  async function download(format: 'json' | 'csv') {
    await perform(async () => {
      const r = await post(`/api/households/${state.household.id}/export`, { format });
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clymo-synthetic-${state.household.id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }
  const members = state.memberships.filter((m) => m.active);
  return (
    <div className="security-controls">
      <p className="muted build-info">
        Versión de prueba: {process.env.CLYMO_BUILD_COMMIT?.slice(0, 12)}
        {process.env.CLYMO_BUILD_DIRTY === 'yes' ? ' · cambios locales' : ''}
      </p>
      <section className="panel">
        <h2>Otro hogar ficticio</h2>
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            const name = new FormData(e.currentTarget).get('name');
            void perform(async () => {
              const r = await post('/api/households', { name });
              const result = await r.json();
              window.location.assign('/?hogar=' + result.id);
            });
          }}
        >
          <label>
            Nombre del nuevo hogar
            <input name="name" required minLength={2} maxLength={80} />
          </label>
          <button className="button secondary" disabled={busy}>
            Crear hogar vacío
          </button>
        </form>
      </section>
      {error && !deleting && (
        <p role="alert" className="inline-note">
          {error}
        </p>
      )}
      <section className="panel">
        <h2>Personas con acceso</h2>
        <p>El acceso a la aplicación no otorga propiedad sobre los bienes.</p>
        <ul className="members-list">
          {members.map((m) => (
            <li key={m.id}>
              <span>
                {state.users.find((u) => u.id === m.userId)?.displayName} ·{' '}
                {m.role === 'admin' ? 'Propietario' : 'Ayudante · solo lectura'}
                {m.userId === userId ? ' · Tú' : ''}
              </span>
              {canEdit && m.userId !== userId && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    void perform(async () => {
                      await post(`/api/households/${state.household.id}/members`, {
                        userId: m.userId,
                        role: m.role === 'admin' ? 'owner' : 'helper',
                        active: false,
                      });
                      await refresh();
                    })
                  }
                >
                  Revocar acceso
                </button>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void perform(async () => {
                await post(`/api/households/${state.household.id}/members`, {
                  userId: f.get('userId'),
                  role: 'helper',
                  active: true,
                });
                await refresh();
              });
            }}
          >
            <Field
              label="Código del ayudante autorizado"
              hint="La persona obtiene este código al ingresar con una cuenta de prueba previamente autorizada."
            >
              <input name="userId" required placeholder="Código UUID de acceso" />
            </Field>
            <button className="button secondary" disabled={busy}>
              Autorizar ayudante
            </button>
          </form>
        )}
        <p className="build-id">Tu código: {userId}</p>
      </section>
      {canEdit && (
        <section className="panel">
          <h2>Exportar este hogar</h2>
          <p>
            Descarga solo los registros ficticios de este hogar. JSON incluye el historial completo;
            CSV resume las fuentes y explica sus exclusiones.
          </p>
          <div className="actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void download('json')}
            >
              Descargar JSON
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => void download('csv')}
            >
              Descargar CSV
            </button>
          </div>
        </section>
      )}
      <section className="panel">
        <h2>Eliminar datos o cuenta</h2>
        <p>
          La eliminación es irreversible. Debes haber ingresado en los últimos 10 minutos.{' '}
          <a href="/login">Ingresar nuevamente</a>.
        </p>
        {canEdit && (
          <button
            className="button danger-button"
            onClick={() => {
              setConfirmation('');
              setAgreed(false);
              setDeleting('household');
            }}
          >
            Eliminar este hogar
          </button>
        )}
        <button
          className="button secondary"
          onClick={() => {
            setConfirmation('');
            setAgreed(false);
            setDeleting('account');
          }}
        >
          Eliminar mi cuenta de acceso
        </button>
      </section>
      {deleting && (
        <Modal
          title={
            deleting === 'household'
              ? 'Eliminar definitivamente el hogar'
              : 'Eliminar mi cuenta de acceso'
          }
          onClose={() => setDeleting(null)}
        >
          <p>
            {deleting === 'household'
              ? 'Se eliminarán las membresías y todos los datos, observaciones, revisiones y cálculos del hogar. Sus ayudantes perderán el acceso.'
              : 'Se eliminará tu cuenta de autenticación y tu acceso. Los hogares de otros propietarios se conservarán. Primero debes resolver los hogares donde eres el único propietario.'}
          </p>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              void perform(async () => {
                await post(
                  deleting === 'household'
                    ? `/api/households/${state.household.id}/delete`
                    : '/api/account/delete',
                  { confirmation, irreversible: agreed },
                );
                if (deleting === 'account') await logout();
                else window.location.replace('/');
              });
            }}
          >
            <Field
              label={
                deleting === 'household'
                  ? `Escribe ${state.household.name}`
                  : 'Escribe ELIMINAR MI CUENTA'
              }
            >
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                required
                autoComplete="off"
              />
            </Field>
            <label className="toggle-row">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                required
              />
              <span>Entiendo que esta acción no se puede deshacer.</span>
            </label>
            {error && (
              <p role="alert" className="inline-note">
                {error}
              </p>
            )}
            <button
              className="button danger-button"
              disabled={
                busy ||
                !agreed ||
                confirmation !==
                  (deleting === 'household' ? state.household.name : 'ELIMINAR MI CUENTA')
              }
            >
              Eliminar definitivamente
            </button>
          </form>
        </Modal>
      )}
    </div>
  );
}
