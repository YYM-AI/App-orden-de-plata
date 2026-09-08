'use client';
import { useState } from 'react';
import { ShieldCheck, RotateCcw, Users } from 'lucide-react';
import { useDemo } from './demo-provider';
import { Modal, Field } from './ui';
export function SettingsPage() {
  const { state, execute, reset, busy } = useDemo();
  const [resetting, setResetting] = useState(false);
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
              <p>Administrador Demo · administrador</p>
            </div>
          </div>
          <p>
            Ayudante Demo · rol de lectura previsto en el modelo. No posee bienes por tener acceso.
          </p>
          <p className="inline-note">
            No hay inicio de sesión ni invitaciones reales. El rol del ayudante es una referencia
            sintética; no es un control de acceso de producción.
          </p>
        </section>
        <section className="panel">
          <h2>Cómo quieres ver tus datos</h2>
          <Field label="Moneda de presentación en configuración">
            <select
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
          <p>
            USD 1 = CLP 950. UF 1 = CLP 40.000. Valores ficticios al 4 de septiembre de 2026; no se
            consultan servicios externos.
          </p>
          <label className="toggle-row" aria-label="Mostrar obligaciones personales">
            <input
              type="checkbox"
              checked={state.settings.obligationsVisible}
              onChange={(e) =>
                void execute(
                  { type: 'settings', obligationsVisible: e.target.checked },
                  e.target.checked
                    ? 'Obligaciones personales visibles.'
                    : 'Interfaz oculta. Los saldos y el historial se conservan en el patrimonio.',
                )
              }
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
            Los registros se guardan en el almacenamiento local de este navegador. No se envían a
            bancos, brokers ni servicios de análisis. Esto no es almacenamiento seguro de
            producción.
          </p>
        </div>
      </section>
      <section className="panel reset-panel">
        <div>
          <h2>Volver a empezar</h2>
          <p>Restablece el hogar original y elimina los cambios de demostración guardados aquí.</p>
        </div>
        <button className="button secondary" onClick={() => setResetting(true)}>
          <RotateCcw size={18} />
          Restablecer datos demo
        </button>
      </section>
      {resetting && (
        <Modal
          title="¿Restablecer la demostración?"
          description="Se perderán las fuentes, observaciones, pagos y decisiones que agregaste en este navegador. El hogar volverá a sus cifras originales."
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
