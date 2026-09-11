'use client';
import { useState, useEffect } from 'react';
import { ShieldCheck, RotateCcw, Users } from 'lucide-react';
import { useDemo } from './demo-provider';
import { Modal, Field } from './ui';
import { SecuritySettings } from './security-settings';
export function SettingsPage() {
  const { state, execute, reset, busy, canEdit, userId } = useDemo();
  const [resetting, setResetting] = useState(false);
  const [showObligations, setShowObligations] = useState(state.settings.obligationsVisible);
  useEffect(
    () => setShowObligations(state.settings.obligationsVisible),
    [state.settings.obligationsVisible],
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">A TU MANERA</p>
          <h1>Configuración</h1>
          <p className="muted">Preferencias y límites de esta demostración.</p>
        </div>
        <span className="large-icon">
          <ShieldCheck size={30} />
        </span>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <h2>Tu hogar ficticio</h2>
          <div className="household-setting">
            <span className="large-icon">
              <Users size={24} />
            </span>
            <div>
              <strong>{state.household.name}</strong>
              <p>
                {state.users.find((u) => u.id === userId)?.displayName} ·{' '}
                {canEdit ? 'Propietario' : 'Ayudante · solo lectura'}
              </p>
            </div>
          </div>
          <p>
            Las personas autorizadas pueden ver este hogar. Solo sus propietarios pueden
            modificarlo, exportarlo o gestionar accesos.
          </p>
        </section>
        <section className="panel">
          <h2>Cómo quieres ver tus datos</h2>
          <Field label="Moneda de presentación en configuración">
            <select
              disabled={!canEdit}
              value={state.settings.reportingCurrency}
              onChange={(e) =>
                void execute({
                  type: 'settings',
                  reportingCurrency: e.target.value as 'CLP' | 'USD',
                })
              }
            >
              <option value="CLP">CLP · Peso chileno</option>
              <option value="USD">USD · Dólar</option>
            </select>
          </Field>
          <p>Conversiones ficticias de este hogar; no se consultan servicios externos.</p>
          {state.rates.map((rate) => (
            <p key={rate.id}>
              {rate.base} 1 = {rate.quote} {rate.rate} · {rate.source} · {rate.effectiveDate}
            </p>
          ))}
          {state.ufValues.map((value) => (
            <p key={value.id}>
              UF 1 = CLP {value.clpValue} · {value.source} · {value.effectiveDate}
            </p>
          ))}
          {!state.rates.length && !state.ufValues.length && (
            <p>Sin tasas de conversión registradas.</p>
          )}
          <label className="toggle-row" aria-label="Mostrar obligaciones personales">
            <input
              type="checkbox"
              disabled={!canEdit || busy}
              checked={showObligations}
              onChange={async (e) => {
                const checked = e.target.checked;
                setShowObligations(checked);
                const saved = await execute(
                  { type: 'settings', obligationsVisible: checked },
                  checked
                    ? 'Obligaciones personales visibles.'
                    : 'Interfaz oculta. Los saldos y el historial se conservan en el patrimonio.',
                );
                if (!saved) setShowObligations(state.settings.obligationsVisible);
              }}
            />
            <span>
              <strong>Mostrar obligaciones personales</strong>
              <small>Dinero que me deben y dinero que debo a personas.</small>
            </span>
          </label>
          <p className="muted">
            Ocultar esta interfaz no elimina ni excluye sus valores. Para excluir una obligación,
            usa la decisión de inclusión en su detalle.
          </p>
        </section>
      </div>
      <section className="panel freshness-panel">
        <h2>Cuándo un valor necesita atención</h2>
        <p>
          Política propuesta {state.policy.version}. La antigüedad se mide desde la fecha del valor,
          no desde la fecha en que lo ingresaste.
        </p>
        <div className="table-scroll">
          <table>
            <caption>Reglas de antigüedad para datos ficticios</caption>
            <thead>
              <tr>
                <th>Tipo de dato</th>
                <th>Vigente</th>
                <th>Antiguo</th>
                <th>Muy antiguo</th>
                <th>Excluido</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Saldo de cartola', 'statement'],
                  ['Cantidad invertida', 'quantity'],
                  ['Precio ficticio', 'price'],
                  ['Tipo de cambio / UF', 'rate'],
                  ['Valor manual', 'manual'],
                ] as const
              ).map(([name, key]) => {
                const p = state.policy[key];
                return (
                  <tr key={key}>
                    <th scope="row">
                      {name}
                      {p.businessDays && <small>Días hábiles</small>}
                    </th>
                    <td>0–{p.currentDays}</td>
                    <td>
                      {p.currentDays + 1}–{p.warningDays}
                    </td>
                    <td>
                      {p.warningDays + 1}–{p.maxDays}
                    </td>
                    <td>Más de {p.maxDays}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted">
          La demo cuenta lunes a viernes como días hábiles. La política admite feriados
          configurables; el calendario de mercados real queda pendiente. Un precio reciente no
          rejuvenece una cantidad antigua.
        </p>
      </section>
      <section className="panel privacy-panel">
        <ShieldCheck size={27} />
        <div>
          <h2>Solo ficción, siempre visible</h2>
          <p>
            Este prototipo utiliza únicamente datos ficticios. No ingreses ni subas información
            financiera real.
          </p>
          <p>
            Los registros se guardan en PostgreSQL con permisos por hogar. No se guardan balances en
            localStorage ni se consultan bancos o brokers. Este staging sigue limitado a datos
            ficticios.
          </p>
        </div>
      </section>
      {canEdit && (
        <section className="panel reset-panel">
          <div>
            <h2>Volver a empezar</h2>
            <p>
              Restablece el hogar original y elimina los cambios de demostración guardados en la
              base de datos.
            </p>
          </div>
          <button className="button secondary" onClick={() => setResetting(true)}>
            <RotateCcw size={18} />
            Restablecer datos demo
          </button>
        </section>
      )}
      <SecuritySettings />
      {resetting && (
        <Modal
          title="¿Restablecer la demostración?"
          description="Se perderán las fuentes, observaciones, pagos y decisiones que agregaste en este hogar. El hogar volverá a sus cifras originales."
          onClose={() => setResetting(false)}
        >
          <div className="actions">
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (await reset()) setResetting(false);
              }}
            >
              Sí, restablecer datos ficticios
            </button>
            <button className="button secondary" onClick={() => setResetting(false)}>
              Conservar mis cambios demo
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
