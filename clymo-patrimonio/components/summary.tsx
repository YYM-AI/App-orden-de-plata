'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Wallet,
  Landmark,
  CircleHelp,
  ClipboardCheck,
  Clock3,
} from 'lucide-react';
import { useDemo } from './demo-provider';
import { Modal } from './ui';
import { SourceDetail } from './sources';
import { money, dateLabel } from '@/domain/format';
import { D } from '@/domain/model';
export function Summary() {
  const { state, snapshot: s, reviews } = useDemo();
  const [calculation, setCalculation] = useState<
    'netWorth' | 'assets' | 'liabilities' | 'liquidCash' | null
  >(null);
  const [source, setSource] = useState<string | null>(null);
  const titles = {
    netWorth: 'Patrimonio estimado',
    assets: 'Activos incluidos',
    liabilities: 'Pasivos incluidos',
    liquidCash: 'Efectivo disponible',
  };
  const pending = reviews.filter((r) => r.status === 'pending').length;
  const groups = [
    { name: 'Bancos y depósitos', categories: ['bank', 'deposit'], Icon: Landmark },
    { name: 'Inversiones', categories: ['investment'], Icon: ArrowUpRight },
    { name: 'Obligaciones a favor', categories: ['obligation'], Icon: ClipboardCheck },
    { name: 'Efectivo en casa', categories: ['cash'], Icon: Wallet },
    { name: 'Otros activos manuales', categories: ['other'], Icon: Wallet },
  ].map((g) => ({
    ...g,
    amount: s.components
      .filter(
        (c) =>
          c.included &&
          c.side === 'asset' &&
          g.categories.includes(state.accounts.find((a) => a.id === c.accountId)!.category),
      )
      .reduce((sum, c) => sum.plus(c.reportingValue!), new D(0))
      .toFixed(),
  }));
  const detailComponents = s.components.filter(
    (c) =>
      c.included &&
      (calculation === 'netWorth' ||
        (calculation === 'assets' && c.side === 'asset') ||
        (calculation === 'liabilities' && c.side === 'liability') ||
        (calculation === 'liquidCash' && new D(c.liquidReporting).gt(0))),
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">UNA MIRADA A TU HOGAR</p>
          <h1>Tu patrimonio, con claridad.</h1>
          <p className="muted">
            Valores ficticios al {dateLabel(s.cutoff)}. Cada cifra tiene una explicación.
          </p>
        </div>
        <span className="date-pill">
          <Clock3 size={16} aria-hidden="true" /> Corte de demostración
        </span>
      </div>
      <section className="overview-grid" aria-label="Situación patrimonial">
        <div className="wealth-card">
          <div className="card-top">
            <span>Patrimonio estimado</span>
            <span className="pill light-pill">Cobertura parcial</span>
          </div>
          <strong className="wealth-value" data-testid="net-worth">
            {money(s.netWorth, s.reportingCurrency)}
          </strong>
          <p>Lo que el hogar tiene, menos lo que debe.</p>
          <button className="explain light" onClick={() => setCalculation('netWorth')}>
            Ver cálculo <CircleHelp size={18} aria-hidden="true" />
          </button>
          <div className="wealth-foot">
            <span>
              {s.includedCount} de {state.accounts.length} fuentes económicas incluidas
            </span>
            <Link href="/revision">
              Ver exclusiones <ArrowUpRight size={17} />
            </Link>
          </div>
        </div>
        <div className="liquid-card">
          <div className="amount-icon">
            <Wallet size={25} aria-hidden="true" />
          </div>
          <h2>Efectivo disponible</h2>
          <strong data-testid="liquid-cash">{money(s.liquidCash, s.reportingCurrency)}</strong>
          <p>Banco, ahorro y efectivo del hogar, incluido el efectivo dentro del broker.</p>
          <button className="explain" onClick={() => setCalculation('liquidCash')}>
            Ver cálculo <CircleHelp size={18} aria-hidden="true" />
          </button>
          <small>
            No incluye depósitos a plazo, inversiones ni dinero por cobrar. Disponibilidad supuesta
            para esta demo.
          </small>
        </div>
      </section>
      <section className="totals-grid" aria-label="Activos y pasivos">
        {(['assets', 'liabilities'] as const).map((key) => (
          <div className="total-card" key={key}>
            <div>
              <span>{titles[key]}</span>
              <strong data-testid={key === 'assets' ? 'assets-total' : 'liabilities-total'}>
                {money(s[key], s.reportingCurrency)}
              </strong>
            </div>
            <button
              className="explain"
              aria-label={`Ver cálculo de ${titles[key].toLowerCase()}`}
              onClick={() => setCalculation(key)}
            >
              Ver cálculo <ArrowUpRight size={18} />
            </button>
          </div>
        ))}
      </section>
      <div className="lower-grid">
        <section className="panel">
          <div className="section-title">
            <h2>Dónde está tu patrimonio</h2>
            <Link href="/fuentes">
              Ver fuentes <ArrowUpRight size={17} />
            </Link>
          </div>
          <p className="muted">Distribución de los activos incluidos.</p>
          <div className="distribution">
            {groups
              .filter((g) => new D(g.amount).gt(0))
              .map(({ name, amount, Icon }) => (
                <div className="distribution-row" key={name}>
                  <span className="small-icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span>{name}</span>
                  <strong>{money(amount, s.reportingCurrency)}</strong>
                </div>
              ))}
          </div>
        </section>
        <section className="panel coverage-panel">
          <div className="section-title">
            <h2>Lo que falta por revisar</h2>
            <span className="pill">{pending} pendientes</span>
          </div>
          <p>Este total cubre las fuentes declaradas que cumplen las reglas de la demostración.</p>
          <ul className="coverage-list">
            <li>
              <strong>{s.excludedCount} fuentes fuera del total</strong>
              <span>
                {s.components
                  .filter((c) => !c.included)
                  .map((c) => state.accounts.find((a) => a.id === c.accountId)!.name)
                  .join(' · ') || 'Todas las fuentes declaradas son elegibles.'}
              </span>
            </li>
            <li>
              <strong>
                {reviews.find((r) => r.kind === 'duplicate')?.status === 'resolved'
                  ? 'Cartola adicional vinculada'
                  : 'Una cartola adicional en revisión'}
              </strong>
              <span>No agrega otra inversión al patrimonio.</span>
            </li>
            <li>
              <strong>Fecha incluida más antigua</strong>
              <span>
                {dateLabel(s.oldestIncludedDate)} · se consideran todas las fuentes incluidas.
              </span>
            </li>
          </ul>
          <Link className="button secondary" href="/revision">
            Ir a revisión <ArrowRight size={18} />
          </Link>
        </section>
      </div>
      {!state.settings.obligationsVisible && (
        <p className="inline-note">
          La interfaz de obligaciones personales está oculta. Sus valores e historial siguen
          incluidos hasta una decisión explícita.
        </p>
      )}
      {calculation && (
        <Modal
          title={`Cómo se calcula: ${titles[calculation].toLowerCase()}`}
          description={`Corte fijo al ${dateLabel(s.cutoff)}. Política ${s.policyVersion}.`}
          onClose={() => setCalculation(null)}
        >
          <div className="calculation-total">{money(s[calculation], s.reportingCurrency)}</div>
          <p>
            {calculation === 'netWorth'
              ? `${money(s.assets, s.reportingCurrency)} de activos − ${money(s.liabilities, s.reportingCurrency)} de pasivos.`
              : calculation === 'liquidCash'
                ? 'Se toma únicamente el efectivo de cada fuente, ajustado por la propiedad del hogar. Un cupo de crédito nunca es efectivo.'
                : 'Suma de los valores elegibles, ajustados por la propiedad del hogar y convertidos desde su moneda original.'}
          </p>
          <div className="calculation-list">
            {detailComponents.map((c) => (
              <div key={c.id}>
                <button
                  onClick={() => {
                    setCalculation(null);
                    setSource(c.accountId);
                  }}
                >
                  {state.accounts.find((a) => a.id === c.accountId)!.name}
                  <ArrowUpRight size={16} />
                </button>
                <strong>
                  {calculation === 'netWorth' && c.side === 'liability' ? '− ' : ''}
                  {money(
                    calculation === 'liquidCash' ? c.liquidReporting : c.reportingValue,
                    s.reportingCurrency,
                  )}
                </strong>
              </div>
            ))}
          </div>
          <p className="inline-note">
            {s.excludedCount} fuentes permanecen fuera. La conversión a USD usa la tasa sintética
            CLP 950 por USD. Las cifras se calculan desde sus valores originales.
          </p>
          <details>
            <summary>Precisión y fecha del cálculo</summary>
            <p>
              Valor almacenado: {s[calculation]} {s.reportingCurrency}. Componentes con hasta 8
              decimales; presentación CLP sin decimales y USD con dos. Corte de valoración:{' '}
              {s.valuationTime}. No es una cotización en vivo.
            </p>
          </details>
        </Modal>
      )}
      {source && <SourceDetail accountId={source} onClose={() => setSource(null)} />}
    </>
  );
}
