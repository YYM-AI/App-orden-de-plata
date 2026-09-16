'use client';
import { useState } from 'react';
import { ClipboardCheck, Copy, CircleHelp, Clock3, House } from 'lucide-react';
import { useDemo } from './demo-provider';
import { SourceDetail } from './sources';
import { dateLabel } from '@/domain/format';
export function Reviews() {
  const { state, reviews, execute, busy, canEdit } = useDemo();
  const [source, setSource] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const pending = reviews.filter((r) => r.status === 'pending').length;
  const items = reviews.filter((r) => filter === 'all' || r.status === filter);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">UN PASO A LA VEZ</p>
          <h1>Revisemos lo pendiente.</h1>
          <p className="muted">
            {pending} revisiones pendientes. Cada decisión conserva los datos originales.
          </p>
        </div>
        <span className="large-icon">
          <ClipboardCheck size={30} />
        </span>
      </div>
      <div className="inline-note">
        Reconocer una exclusión registra que la revisaste. No agrega un valor que todavía incumple
        las reglas.
      </div>
      <label className="review-filter">
        Mostrar revisiones
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">Todas</option>
          <option value="pending">Pendientes</option>
          <option value="acknowledged">Revisadas, aún excluidas</option>
          <option value="resolved">Resueltas</option>
        </select>
      </label>
      <div className="review-list">
        {!items.length && (
          <section className="panel empty">
            <ClipboardCheck size={32} />
            <h2>No hay revisiones en este grupo</h2>
            <p>Las exclusiones siguen visibles en Fuentes y Resumen.</p>
          </section>
        )}
        {items.map((r) => {
          const Icon =
            r.kind === 'duplicate'
              ? Copy
              : r.kind === 'property'
                ? House
                : r.kind === 'stale'
                  ? Clock3
                  : CircleHelp;
          const candidate = state.duplicates.find((d) => d.id === r.candidateId);
          const decide = (action: 'bind' | 'undo_binding' | 'acknowledge' | 'reopen') =>
            execute(
              {
                type: 'review',
                reviewId: r.id,
                action,
                effectiveDate: state.cutoff,
                reason:
                  action === 'bind'
                    ? 'Confirmo que ambas cartolas ficticias describen la misma cuenta.'
                    : action === 'undo_binding'
                      ? 'Deshacer la vinculación; devolver la segunda cartola a revisión.'
                      : action === 'reopen'
                        ? 'Reabrir la revisión de la fuente ficticia.'
                        : 'Revisé el motivo; mantener la fuente excluida hasta que sea elegible.',
              },
              action === 'bind'
                ? 'Cartola vinculada a la cuenta existente. El patrimonio no se duplicó.'
                : 'Decisión de revisión guardada.',
            );
          return (
            <article className="panel review-card" key={r.id} data-testid={r.id}>
              <div className="review-icon">
                <Icon size={24} />
              </div>
              <div className="review-body">
                <div className="section-title">
                  <h2>{r.title}</h2>
                  <span className="pill">
                    {r.status === 'pending'
                      ? 'Pendiente'
                      : r.status === 'resolved'
                        ? 'Resuelta'
                        : 'Revisada · sigue excluida'}
                  </span>
                </div>
                <p>
                  {r.status === 'resolved'
                    ? r.kind === 'duplicate'
                      ? 'La segunda cartola está vinculada a la cuenta existente. La inversión se cuenta una sola vez.'
                      : 'La fuente ahora cumple las reglas de inclusión. Puedes inspeccionar el nuevo cálculo y su historial.'
                    : r.detail}
                </p>
                {candidate && (
                  <ul className="evidence-list">
                    {candidate.evidence.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
                <div className="actions">
                  {r.kind === 'duplicate' ? (
                    <button
                      className="button primary"
                      disabled={busy || !canEdit}
                      onClick={() => void decide(r.status === 'resolved' ? 'undo_binding' : 'bind')}
                    >
                      {r.status === 'resolved'
                        ? 'Deshacer vinculación'
                        : 'Vincular a la cuenta existente'}
                    </button>
                  ) : (
                    r.status !== 'resolved' && (
                      <button
                        className="button secondary"
                        disabled={busy || !canEdit}
                        onClick={() =>
                          void decide(r.status === 'acknowledged' ? 'reopen' : 'acknowledge')
                        }
                      >
                        {r.status === 'acknowledged'
                          ? 'Reabrir revisión'
                          : 'Entendido: mantener excluida'}
                      </button>
                    )
                  )}
                  <button className="explain" onClick={() => setSource(r.accountId)}>
                    {r.kind === 'stale' && r.status !== 'resolved'
                      ? 'Actualizar valor ficticio'
                      : 'Inspeccionar fuente'}
                  </button>
                </div>
                {r.decision && (
                  <p className="decision-note">
                    Decisión efectiva al {dateLabel(r.decision.effectiveDate)} · {r.decision.reason}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <details className="panel">
        <summary>Historial de decisiones de revisión ({state.resolutions.length})</summary>
        {state.resolutions.length ? (
          state.resolutions.map((r) => (
            <p key={r.id}>
              {dateLabel(r.effectiveDate)} · {r.reason}{' '}
              <small>
                ID {r.id} · {r.recordedAt}
              </small>
            </p>
          ))
        ) : (
          <p>Todavía no se han registrado decisiones de revisión.</p>
        )}
      </details>
      {source && <SourceDetail accountId={source} onClose={() => setSource(null)} />}
    </>
  );
}
