'use client';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccountRemoval } from './account-removal';
import { usePathname } from 'next/navigation';
import type { Command } from '@/domain/commands';
import { calculateSnapshot, reviewQueue } from '@/domain/engine';
import { validateState } from '@/domain/validation';
import type { DemoState, NetWorthSnapshot } from '@/domain/model';
interface MemberHousehold {
  household_id: string;
  role: 'owner' | 'helper';
  households: { id: string; name: string; fixture_kind: string };
}
interface DemoContext {
  state: DemoState;
  error: string;
  snapshot: NetWorthSnapshot;
  reviews: ReturnType<typeof reviewQueue>;
  busy: boolean;
  canEdit: boolean;
  userId: string;
  memberships: MemberHousehold[];
  execute(command: Command, message?: string): Promise<boolean>;
  reset(): Promise<boolean>;
  refresh(): Promise<void>;
  logout(): Promise<void>;
}
const Context = createContext<DemoContext | null>(null);
export function useDemo() {
  const context = useContext(Context);
  if (!context) throw Error('DemoProvider requerido');
  return context;
}
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [role, setRole] = useState<'owner' | 'helper'>('helper');
  const [userId, setUserId] = useState('');
  const [memberships, setMemberships] = useState<MemberHousehold[]>([]);
  const [ready, setReady] = useState(false);
  const lock = useRef(false);
  const selected = useRef('');
  const active = useRef(true);
  const latestRevision = useRef(-1);
  const path = usePathname();
  async function logout() {
    setState(null);
    setReady(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      window.location.replace('/login');
    }
  }
  async function refresh() {
    if (lock.current) return;
    try {
      const r = await fetch('/api/households', { cache: 'no-store' });
      if (!r.ok) {
        setState(null);
        window.location.replace('/login?error=session');
        return;
      }
      const account = await r.json();
      if (!active.current) return;
      setUserId(account.user.id);
      setMemberships(account.memberships);
      const requested = new URLSearchParams(location.search).get('hogar');
      const id = requested ?? selected.current ?? '';
      const target = id || account.memberships[0]?.household_id;
      if (!target) {
        setReady(true);
        setState(null);
        return;
      }
      if (!account.memberships.some((m: MemberHousehold) => m.household_id === target)) {
        setReady(true);
        setState(null);
        setError(
          'No tienes acceso al hogar solicitado. Selecciona uno de tus hogares autorizados.',
        );
        return;
      }
      selected.current = target;
      const response = await fetch(`/api/households/${target}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok) {
        setReady(true);
        setState(null);
        setError(payload.error);
        return;
      }
      if (active.current && !lock.current && payload.state.revision >= latestRevision.current) {
        latestRevision.current = payload.state.revision;
        setRole(payload.role);
        setState(validateState(payload.state));
        setReady(true);
        setError('');
      }
    } catch {
      if (active.current) {
        setState(null);
        setError('No pudimos cargar el hogar. Revisa la conexión y vuelve a intentar.');
      }
    }
  }
  useEffect(() => {
    active.current = true;
    setState(null);
    setReady(false);
    void refresh();
    const interval = setInterval(() => void refresh(), 15000);
    const visibility = () => {
      if (document.visibilityState === 'hidden') {
        active.current = false;
        setState(null);
      } else {
        active.current = true;
        void refresh();
      }
    };
    const pageShow = () => {
      active.current = true;
      setState(null);
      void refresh();
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pageshow', pageShow);
    return () => {
      active.current = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pageshow', pageShow);
    };
  }, [path]);
  const snapshot = useMemo(() => (state ? calculateSnapshot(state) : null), [state]);
  const reviews = useMemo(
    () => (state && snapshot ? reviewQueue(state, snapshot) : []),
    [state, snapshot],
  );
  async function mutate(endpoint: string, input: unknown, message: string) {
    if (!state || role !== 'owner' || lock.current) {
      setError('Tu acceso es de solo lectura.');
      return false;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(`/api/households/${state.household.id}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setState(null);
        setError(result.error);
        return false;
      }
      latestRevision.current = result.state.revision;
      if (active.current) setState(validateState(result.state));
      setNotice(message);
      return true;
    } catch {
      setError('No pudimos guardar. Recarga antes de intentar nuevamente.');
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const execute = (command: Command, message = 'Cambio ficticio guardado en la base de datos.') =>
    mutate(
      'command',
      { command, revision: state?.revision, commandId: crypto.randomUUID() },
      message,
    );
  const reset = () =>
    mutate('reset', { confirm: true }, 'Demostración restablecida en la base de datos.');
  if (!state || !snapshot)
    return (
      <main className="login-page">
        <section className="panel login-card">
          <h1>Clymo Patrimonio</h1>
          <p>STAGING — DATOS FICTICIOS</p>
          {ready && <AccountRemoval />}
          {error ? (
            <p role="alert">{error}</p>
          ) : (
            <p>
              {ready ? 'Todavía no tienes un hogar autorizado.' : 'Validando tu sesión y tu hogar…'}
            </p>
          )}
          {ready && (
            <>
              <p>
                Tu código de acceso: <code>{userId}</code>. Un propietario puede autorizarte como
                ayudante con este código.
              </p>
              {memberships.map((m) => (
                <p key={m.household_id}>
                  <a href={'/?hogar=' + m.household_id}>{m.households.name}</a>
                </p>
              ))}
              <form
                className="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const name = new FormData(e.currentTarget).get('name');
                  try {
                    const r = await fetch('/api/households', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name }),
                    });
                    const result = await r.json();
                    if (r.ok) window.location.assign('/?hogar=' + result.id);
                    else setError(result.error);
                  } catch {
                    setError('No se pudo crear el hogar.');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <label>
                  Nombre del hogar ficticio
                  <input name="name" required minLength={2} maxLength={80} />
                </label>
                <button className="button primary" disabled={busy}>
                  Crear hogar vacío
                </button>
              </form>
            </>
          )}
          <button className="button secondary" onClick={() => void refresh()}>
            Volver a cargar
          </button>
          <button className="button secondary" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </section>
      </main>
    );
  return (
    <>
      {error && (
        <div className="feedback error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <output className="feedback success">
          {notice}
          <button aria-label="Cerrar aviso" onClick={() => setNotice('')}>
            ×
          </button>
        </output>
      )}
      <Context.Provider
        value={{
          state,
          error,
          snapshot,
          reviews,
          busy,
          canEdit: role === 'owner',
          userId,
          memberships,
          execute,
          reset,
          refresh,
          logout,
        }}
      >
        {children}
      </Context.Provider>
    </>
  );
}
