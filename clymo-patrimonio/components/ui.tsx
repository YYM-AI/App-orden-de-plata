'use client';
import {
  useEffect,
  useRef,
  useId,
  cloneElement,
  type ReactNode,
  type ReactElement,
  type FormEvent,
} from 'react';
import { X } from 'lucide-react';
import { useDemo } from './demo-provider';
export function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    el?.showModal();
    return () => {
      el?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
          ),
        ).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-description' : undefined}
      className="modal"
    >
      <div className="modal-head">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Cerrar ventana">
          <X size={22} />
        </button>
      </div>
      {description && (
        <p className="muted" id="modal-description">
          {description}
        </p>
      )}
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactElement<{ id?: string; 'aria-describedby'?: string }>;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {cloneElement(children, { id, 'aria-describedby': hint ? `${id}-hint` : undefined })}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function Form({
  children,
  onSubmit,
}: {
  children: ReactNode;
  onSubmit: (data: FormData) => Promise<void>;
}) {
  const { busy, error } = useDemo();
  return (
    <form
      className="form"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!busy) void onSubmit(new FormData(event.currentTarget));
      }}
    >
      <fieldset disabled={busy}>{children}</fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
export const fieldText = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
export function AmountInput({
  name = 'amount',
  value,
  label = 'Monto ficticio',
  positive = true,
}: {
  name?: string;
  value?: string;
  label?: string;
  positive?: boolean;
}) {
  return (
    <Field
      label={label}
      hint={
        positive
          ? 'Mayor que cero. Sin separadores de miles; usa punto para decimales.'
          : 'Sin separadores de miles; usa punto para decimales.'
      }
    >
      <input
        name={name}
        inputMode="decimal"
        defaultValue={value}
        placeholder="Ej.: 500000"
        required
        pattern="(0|[1-9][0-9]*)(\.[0-9]{1,8})?"
        maxLength={39}
      />
    </Field>
  );
}
export function EffectiveDate() {
  const { state } = useDemo();
  return (
    <Field label="Fecha del valor ficticio">
      <input
        type="date"
        name="effectiveDate"
        defaultValue={state.cutoff}
        max={state.cutoff}
        min="1900-01-01"
        required
      />
    </Field>
  );
}
export function ReasonField() {
  return (
    <Field label="Motivo del cambio">
      <input
        name="reason"
        minLength={3}
        maxLength={150}
        defaultValue="Actualización de demostración"
        required
      />
    </Field>
  );
}
