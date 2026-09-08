'use client';
import { useState } from 'react';
import { ArrowUpRight, Plus, Landmark, Wallet, FileText, Layers3 } from 'lucide-react';
import { useDemo } from './demo-provider';
import { Modal, Field, Form, AmountInput, EffectiveDate, ReasonField, fieldText } from './ui';
import { dateLabel, money } from '@/domain/format';
import { freshnessLabel } from '@/domain/freshness';
import { latest } from '@/domain/engine';
import type { Command } from '@/domain/commands';
import { D, type Currency } from '@/domain/model';
const categoryLabels: Record<string, string> = {
  bank: 'Bancos y ahorros',
  cash: 'Efectivo',
  investment: 'Inversiones',
  deposit: 'Depósitos a plazo',
  obligation: 'Obligaciones personales',
  property: 'Vivienda',
  loan: 'Créditos',
  card: 'Tarjetas',
  other: 'Otros bienes',
};
const eventLabels: Record<string, string> = {
  initial: 'Capital inicial',
  repayment: 'Pago recibido o realizado',
  adjustment: 'Ajuste',
  forgiveness: 'Condonación',
  write_off: 'Baja',
  settlement: 'Liquidación',
  dispute: 'Disputa',
};
export function Sources() {
  const { state, snapshot, reviews } = useDemo();
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState<'asset' | 'liability' | null>(null);
  const rows = state.accounts.filter((a) => {
    const c = snapshot.components.find((c) => c.accountId === a.id)!;
    const needsReview = reviews.some((r) => r.accountId === a.id && r.status === 'pending');
    if (!state.settings.obligationsVisible && a.category === 'obligation') return false;
    const matchesCategory =
      category === 'all' ||
      category === a.side ||
      (category === 'investment' && ['investment', 'deposit'].includes(a.category)) ||
      (category === 'cash-bank' && ['bank', 'cash'].includes(a.category)) ||
      category === a.category;
    const matchesStatus =
      status === 'all' ||
      (status === 'included' && c.included) ||
      (status === 'excluded' && !c.included) ||
      (status === 'stale' && c.freshness !== 'current') ||
      (status === 'review' && needsReview);
    return matchesCategory && matchesStatus;
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">EL ORIGEN DE CADA CIFRA</p>
          <h1>Tus fuentes</h1>
          <p className="muted">Cuentas, bienes y deudas del hogar ficticio.</p>
        </div>
        <div className="actions">
          <button className="button primary" onClick={() => setAdding('asset')}>
            <Plus size={19} />
            Agregar activo
          </button>
          <button className="button secondary" onClick={() => setAdding('liability')}>
            <Plus size={19} />
            Agregar pasivo
          </button>
        </div>
      </div>
      <div className="filters">
        <Field label="Tipo de fuente">
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">Todas las fuentes</option>
            <option value="asset">Activos</option>
            <option value="liability">Pasivos</option>
            <option value="investment">Inversiones</option>
            <option value="cash-bank">Efectivo y bancos</option>
            {state.settings.obligationsVisible && (
              <option value="obligation">Obligaciones personales</option>
            )}
          </select>
        </Field>
        <Field label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Todos los estados</option>
            <option value="included">Incluidas</option>
            <option value="stale">Antiguas o vencidas</option>
            <option value="excluded">Excluidas</option>
            <option value="review">Necesitan revisión</option>
          </select>
        </Field>
        <p>
          {rows.length} fuentes visibles · {state.sourceBindings.length} registros de origen
        </p>
      </div>
      {!state.settings.obligationsVisible && (
        <p className="inline-note">
          Las obligaciones personales están ocultas. El cambio de visibilidad no modifica el
          patrimonio ni elimina su historial.
        </p>
      )}
      <div className="source-list">
        {rows.length === 0 && (
          <section className="panel empty">
            <Layers3 size={32} />
            <h2>No hay fuentes con estos filtros</h2>
            <button
              onClick={() => {
                setCategory('all');
                setStatus('all');
              }}
            >
              Mostrar todas las fuentes
            </button>
          </section>
        )}
        {rows.map((a) => {
          const c = snapshot.components.find((c) => c.accountId === a.id)!;
          const institution = state.institutions.find((i) => i.id === a.institutionId)!;
          return (
            <article
              className={`source-row ${!c.included ? 'is-excluded' : ''}`}
              key={a.id}
              data-testid={`source-${a.id}`}
            >
              <div className="source-identity">
                <span className="source-icon">
                  {a.manual ? (
                    <Wallet size={23} aria-hidden="true" />
                  ) : (
                    <Landmark size={23} aria-hidden="true" />
                  )}
                </span>
                <div>
                  <span className="institution">{institution.name}</span>
                  <h2>{a.name}</h2>
                  <span className="muted">
                    {a.maskedIdentifier} · {categoryLabels[a.category]}
                  </span>
                </div>
              </div>
              <div className="source-amount">
                <strong>{money(c.originalAmount, a.currency)}</strong>
                {a.currency !== snapshot.reportingCurrency || c.ownershipPercentage !== '100' ? (
                  <span>Hogar: {money(c.reportingValue, snapshot.reportingCurrency)}</span>
                ) : (
                  <span>{a.side === 'asset' ? 'Activo' : 'Pasivo'} del hogar</span>
                )}
              </div>
              <div className="source-status">
                <span className={`pill ${c.included ? 'included' : 'excluded'}`}>
                  {c.included ? 'Incluida' : 'Excluida'}
                </span>
                <button
                  className="explain"
                  aria-label={`Ver detalle de ${a.name}`}
                  onClick={() => setSelected(a.id)}
                >
                  Ver detalle <ArrowUpRight size={17} />
                </button>
              </div>
              <div className="source-meta">
                <span>Propiedad: {c.ownershipPercentage ?? 'Sin confirmar'}%</span>
                <span>
                  {c.method === 'manual' || c.method === 'obligation'
                    ? 'Ingreso manual'
                    : c.method === 'component_sum'
                      ? 'Posiciones y cierre ficticio'
                      : 'Cartola ficticia'}
                </span>
                <span>
                  {dateLabel(c.effectiveDate)} · {freshnessLabel[c.freshness]}
                </span>
              </div>
              {!c.included && (
                <p className="source-reason">
                  {c.reasons[0]} <button onClick={() => setSelected(a.id)}>Revisar fuente</button>
                </p>
              )}
            </article>
          );
        })}
      </div>
      {selected && <SourceDetail accountId={selected} onClose={() => setSelected(null)} />}
      {adding && <ManualForm side={adding} onClose={() => setAdding(null)} />}
    </>
  );
}
function ManualForm({ side, onClose }: { side: 'asset' | 'liability'; onClose: () => void }) {
  const { state, execute } = useDemo();
  return (
    <Modal
      title={side === 'asset' ? 'Agregar activo ficticio' : 'Agregar pasivo ficticio'}
      description="Usa un nombre inventado. Todos los datos se guardan únicamente en este navegador."
      onClose={onClose}
    >
      <Form
        onSubmit={async (data) => {
          const command: Command = {
            type: 'add_manual',
            side,
            name: fieldText(data, 'name'),
            amount: fieldText(data, 'amount'),
            currency: fieldText(data, 'currency') as Currency,
            percentage: fieldText(data, 'percentage'),
            category: fieldText(data, 'category') as 'other',
            effectiveDate: fieldText(data, 'effectiveDate'),
          };
          if (
            await execute(command, 'Fuente manual ficticia agregada. El patrimonio se recalculó.')
          )
            onClose();
        }}
      >
        <Field label="Nombre ficticio">
          <input
            name="name"
            placeholder={side === 'asset' ? 'Ej.: Ahorro Demo' : 'Ej.: Préstamo Demo'}
            required
            minLength={2}
            maxLength={80}
          />
        </Field>
        <div className="form-grid">
          <Field label="Categoría">
            <select name="category" defaultValue={side === 'asset' ? 'other' : 'loan'}>
              {(side === 'asset'
                ? ['other', 'bank', 'cash', 'investment', 'deposit']
                : ['loan', 'card', 'other']
              ).map((c) => (
                <option key={c} value={c}>
                  {categoryLabels[c]}
                </option>
              ))}
              {state.settings.obligationsVisible && (
                <option value="obligation">
                  {side === 'asset' ? 'Dinero que me deben' : 'Dinero que debo a una persona'}
                </option>
              )}
            </select>
          </Field>
          <Field label="Moneda original">
            <select name="currency">
              <option>CLP</option>
              <option>USD</option>
              <option value="CLF">UF</option>
              <option>EUR</option>
            </select>
          </Field>
        </div>
        <AmountInput />
        <Field label="Propiedad del hogar (%)">
          <input
            name="percentage"
            inputMode="decimal"
            defaultValue="100"
            required
            pattern="(0|[1-9][0-9]*)(\.[0-9]+)?"
          />
        </Field>
        <EffectiveDate />
        <p className="inline-note">
          EUR quedará fuera del total porque no existe una tasa sintética aprobada. Una inversión
          manual usa el valor que ingreses, sin precios en vivo.
        </p>
        <button className="button primary" type="submit">
          Guardar fuente ficticia
        </button>
      </Form>
    </Modal>
  );
}

export function SourceDetail({ accountId, onClose }: { accountId: string; onClose: () => void }) {
  const { state, snapshot, execute, error } = useDemo();
  const [mode, setMode] = useState<'observation' | 'ownership' | 'payment' | null>(null);
  const a = state.accounts.find((a) => a.id === accountId)!;
  const c = snapshot.components.find((c) => c.accountId === accountId)!;
  const obligation = state.obligations.find((o) => o.accountId === accountId);
  const bindings = state.sourceBindings.filter(
    (b) =>
      b.accountId === accountId ||
      state.duplicates.some((d) => d.bindingId === b.id && d.candidateAccountId === accountId),
  );
  const history = state.balances.filter((b) => b.accountId === accountId);
  const events = state.obligationEvents.filter((e) => e.obligationId === obligation?.id);
  const creditLimit = history.find((b) => b.kind === 'credit_limit');
  const inclusion = latest(
    state.inclusionDecisions.filter((d) => d.accountId === accountId),
    state.cutoff,
  );
  const cashOptions = state.accounts.filter(
    (cash) =>
      ['bank', 'cash'].includes(cash.category) &&
      cash.currency === a.currency &&
      snapshot.components.some(
        (v) => v.accountId === cash.id && v.included && v.ownershipPercentage === '100',
      ),
  );
  return (
    <Modal
      title={a.name}
      description={`${state.institutions.find((i) => i.id === a.institutionId)!.name} · ${a.maskedIdentifier} · Solo datos ficticios`}
      onClose={onClose}
    >
      <div className="detail-value">
        <div>
          <span>{obligation ? 'Saldo pendiente' : 'Valor original'}</span>
          <strong data-testid="detail-original">{money(c.originalAmount, a.currency)}</strong>
        </div>
        <span className={`pill ${c.included ? 'included' : 'excluded'}`}>
          {c.included ? 'Incluida' : 'Excluida'}
        </span>
      </div>
      <div className="detail-grid">
        <div>
          <span>Valor del hogar en {snapshot.reportingCurrency}</span>
          <strong>{money(c.reportingValue, snapshot.reportingCurrency)}</strong>
        </div>
        <div>
          <span>Propiedad del hogar</span>
          <strong>{c.ownershipPercentage ?? 'Sin confirmar'}%</strong>
        </div>
        <div>
          <span>Fecha del saldo o cantidad</span>
          <strong>{dateLabel(c.effectiveDate)}</strong>
        </div>
        <div>
          <span>Antigüedad</span>
          <strong>{freshnessLabel[c.freshness]}</strong>
        </div>
        {c.quantityDate && (
          <div>
            <span>Cantidad conocida al</span>
            <strong>{dateLabel(c.quantityDate)}</strong>
          </div>
        )}
        {c.priceDate && (
          <div>
            <span>Precio ficticio al</span>
            <strong>{dateLabel(c.priceDate)}</strong>
          </div>
        )}
        {c.fxDate && (
          <div>
            <span>Tipo de cambio / UF al</span>
            <strong>{dateLabel(c.fxDate)}</strong>
          </div>
        )}
        <div>
          <span>Fecha de registro</span>
          <strong>{c.recordedAt ?? 'Sin registro'}</strong>
        </div>
      </div>
      <section className="explanation">
        <h3>Por qué {c.included ? 'se incluye' : 'queda fuera'}</h3>
        {c.reasons.map((r) => (
          <p key={r}>{r}</p>
        ))}
        {!c.included && c.reportingValue !== null && (
          <p>El equivalente se muestra solo como referencia. Aporte al total: excluido.</p>
        )}
        {a.propertyPairId && (
          <p>
            {state.accounts
              .filter((pair) => pair.propertyPairId === a.propertyPairId)
              .map((pair) => {
                const value = snapshot.components.find((v) => v.accountId === pair.id)!;
                return `${pair.name}: ${money(value.originalAmount, pair.currency)}`;
              })
              .join(' · ')}
            . La pareja permanece fuera del patrimonio principal.
          </p>
        )}
        {creditLimit && (
          <p>
            Cupo de crédito: {money(creditLimit.amount, creditLimit.currency)}. Es capacidad de
            endeudamiento; no es un activo.
          </p>
        )}
      </section>
      {error && !mode && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <h3>Ver cálculo y origen</h3>
      <ol className="steps">
        {c.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      <p className="muted">
        Corte de valoración: {snapshot.valuationTime} · Política {snapshot.policyVersion}.
      </p>
      {c.quantityDate && (
        <p className="inline-note">
          El precio actual de demostración no permite conocer compras ni ventas posteriores a la
          fecha de la cantidad.
        </p>
      )}
      <div className="detail-actions">
        {!obligation && (
          <button
            className="button secondary"
            onClick={() => setMode(mode === 'observation' ? null : 'observation')}
          >
            Agregar observación
          </button>
        )}
        <button
          className="button secondary"
          onClick={() => setMode(mode === 'ownership' ? null : 'ownership')}
        >
          Confirmar propiedad
        </button>
        {obligation && state.settings.obligationsVisible && (
          <button
            className="button primary"
            onClick={() => setMode(mode === 'payment' ? null : 'payment')}
          >
            Registrar pago o evento
          </button>
        )}
        {a.manual && (
          <button
            className="button secondary"
            onClick={() =>
              void execute({
                type: 'inclusion',
                accountId,
                include: inclusion?.include === false,
                effectiveDate: state.cutoff,
                reason:
                  inclusion?.include === false
                    ? 'Inclusión manual confirmada desde el detalle.'
                    : 'Exclusión manual confirmada desde el detalle.',
              })
            }
          >
            {inclusion?.include === false ? 'Incluir fuente elegible' : 'Excluir esta fuente'}
          </button>
        )}
      </div>
      {mode === 'observation' && (
        <section className="edit-panel">
          <h3>Nueva observación ficticia</h3>
          <p>
            El historial anterior se conserva.
            {a.valuationBasis === 'component_sum'
              ? ' En esta cuenta se actualiza solo el efectivo del broker; la cantidad mantiene su fecha original.'
              : ''}
          </p>
          <Form
            onSubmit={async (data) => {
              if (
                await execute({
                  type: 'observe',
                  accountId,
                  amount: fieldText(data, 'amount'),
                  effectiveDate: fieldText(data, 'effectiveDate'),
                  reason: fieldText(data, 'reason'),
                })
              )
                setMode(null);
            }}
          >
            <AmountInput positive={false} />
            <EffectiveDate />
            <ReasonField />
            <button type="submit" className="button primary">
              Guardar observación
            </button>
          </Form>
        </section>
      )}
      {mode === 'ownership' && (
        <section className="edit-panel">
          <h3>Propiedad económica del hogar</h3>
          <p>Tener acceso a la aplicación no significa ser dueño del dinero.</p>
          <Form
            onSubmit={async (data) => {
              if (
                await execute({
                  type: 'ownership',
                  accountId,
                  percentage: fieldText(data, 'percentage'),
                  status: fieldText(data, 'status') as 'confirmed',
                  effectiveDate: fieldText(data, 'effectiveDate'),
                  reason: fieldText(data, 'reason'),
                })
              )
                setMode(null);
            }}
          >
            <Field label="Porcentaje del hogar">
              <input
                name="percentage"
                inputMode="decimal"
                defaultValue={c.ownershipPercentage ?? '0'}
                required
              />
            </Field>
            <Field label="Confirmación de propiedad">
              <select name="status">
                <option value="confirmed">Confirmada</option>
                <option value="unknown">Sin confirmar</option>
                <option value="disputed">En disputa</option>
              </select>
            </Field>
            <EffectiveDate />
            <ReasonField />
            <button type="submit" className="button primary">
              Guardar decisión de propiedad
            </button>
          </Form>
        </section>
      )}
      {mode === 'payment' && obligation && (
        <section className="edit-panel">
          <h3>Registrar un evento de la obligación</h3>
          <Form
            onSubmit={async (data) => {
              const kind = fieldText(data, 'kind') as 'repayment';
              if (
                await execute(
                  {
                    type: 'obligation_event',
                    obligationId: obligation.id,
                    kind,
                    amount: fieldText(data, 'amount'),
                    effectiveDate: fieldText(data, 'effectiveDate'),
                    reason: fieldText(data, 'reason'),
                    cashAccountId: fieldText(data, 'cashAccountId') || undefined,
                    adjustmentDirection: fieldText(data, 'adjustmentDirection') as 'increase',
                  },
                  'Evento guardado. El saldo pendiente se calculó desde su historial.',
                )
              )
                setMode(null);
            }}
          >
            <Field label="Tipo de evento">
              <select name="kind">
                <option value="repayment">Pago parcial</option>
                <option value="settlement">Liquidación del saldo completo</option>
                <option value="adjustment">Ajuste de capital</option>
                <option value="forgiveness">Condonación</option>
                <option value="write_off">Dar de baja un monto</option>
                <option value="dispute">Marcar en disputa (monto 0)</option>
              </select>
            </Field>
            <AmountInput
              value={
                new D(c.originalAmount ?? '0').gte(500000) ? '500000' : (c.originalAmount ?? '0')
              }
              label="Monto del evento"
              positive={false}
            />
            <Field
              label="Cuenta de efectivo vinculada"
              hint="Solo para pagos. Aumenta el efectivo al cobrar o lo reduce al pagar. Para otros eventos, elige sin vínculo."
            >
              <select
                name="cashAccountId"
                defaultValue={cashOptions.find((c) => c.id === 'checking')?.id ?? ''}
              >
                <option value="">Sin vínculo de efectivo</option>
                {cashOptions.map((cash) => (
                  <option key={cash.id} value={cash.id}>
                    {cash.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Dirección si es un ajuste">
              <select name="adjustmentDirection">
                <option value="increase">Aumentar el capital</option>
                <option value="decrease">Reducir el capital</option>
              </select>
            </Field>
            <EffectiveDate />
            <ReasonField />
            <p className="inline-note">
              Un pago vinculado mueve valor entre efectivo y obligación. Sin vínculo, solo cambia la
              obligación; revisa el efectivo por separado.
            </p>
            <button type="submit" className="button primary">
              Guardar evento ficticio
            </button>
          </Form>
        </section>
      )}
      <details>
        <summary>
          <FileText size={18} /> Fuentes e historial de observaciones (
          {history.length + events.length})
        </summary>
        <h3>Vinculaciones de origen</h3>
        {bindings.map((b) => (
          <p key={b.id}>
            {b.name} · {b.method === 'manual' ? 'Manual' : 'Cartola ficticia'} · ID {b.id}
          </p>
        ))}
        {history.map((o) => (
          <article className="history-row" key={o.id}>
            <strong>
              {money(o.amount, o.currency)} ·{' '}
              {o.kind === 'credit_limit'
                ? 'Cupo informativo'
                : o.kind === 'account_total'
                  ? 'Total informativo de cuenta'
                  : 'Observación de saldo'}
            </strong>
            <span>
              {dateLabel(o.effectiveDate)} · {o.source}
              {o.entryReason ? ` · ${o.entryReason}` : ''}
            </span>
            <small>
              ID {o.id} · registrada {o.recordedAt} ·{' '}
              {c.observationIds.includes(o.id)
                ? 'Seleccionada para esta valoración'
                : 'Conservada como evidencia'}
            </small>
          </article>
        ))}
        {events.map((e) => (
          <article className="history-row" key={e.id}>
            <strong>
              {eventLabels[e.kind]} · {money(e.amount, e.currency)}
            </strong>
            <span>
              {dateLabel(e.effectiveDate)} · {e.reason}
            </span>
            <small>
              ID {e.id} · registrada {e.recordedAt}
              {e.linkedCashObservationId
                ? ` · Efectivo vinculado: ${e.linkedCashObservationId}`
                : ''}
            </small>
          </article>
        ))}
        {state.positions
          .filter((p) => p.accountId === accountId)
          .map((p) => (
            <p key={p.id}>
              {p.quantity} unidades · {dateLabel(p.effectiveDate)} · ID {p.id} · registrada{' '}
              {p.recordedAt}
            </p>
          ))}
      </details>
      <details>
        <summary>Historial de decisiones y tasas</summary>
        {[
          ...state.ownershipDecisions.filter((d) => d.accountId === accountId),
          ...state.inclusionDecisions.filter((d) => d.accountId === accountId),
        ].map((d) => (
          <article className="history-row" key={d.id}>
            <strong>
              {'householdPercentage' in d
                ? `${d.householdPercentage}% · ${d.status}`
                : d.include
                  ? 'Incluir'
                  : 'Excluir'}
            </strong>
            <span>{d.reason}</span>
            <small>
              {dateLabel(d.effectiveDate)} · {d.recordedAt} · {d.actorId} · {d.id}
            </small>
          </article>
        ))}
        {c.conversions.map((r) => (
          <p key={r.rateId}>
            {r.source}: {r.rate} · {r.from}/{r.to} · {dateLabel(r.effectiveDate)} · registrado{' '}
            {r.recordedAt} · ID {r.rateId}
          </p>
        ))}
      </details>
    </Modal>
  );
}
