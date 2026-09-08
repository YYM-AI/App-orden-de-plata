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
import { ZodError } from 'zod';
import { SyntheticTools } from './synthetic-tools';
import { createFixture } from '@/data/fixture';
import { applyCommand, type Command } from '@/domain/commands';
import { calculateSnapshot, reviewQueue } from '@/domain/engine';
import type { DemoState, NetWorthSnapshot } from '@/domain/model';
import { LocalPrototypeRepository, STORAGE_KEY } from '@/persistence/repository';
interface DemoContext {
  state: DemoState;
  error: string;
  snapshot: NetWorthSnapshot;
  reviews: ReturnType<typeof reviewQueue>;
  busy: boolean;
  execute(command: Command, message?: string): Promise<boolean>;
  reset(): Promise<boolean>;
}
const Context = createContext<DemoContext | null>(null);
export function useDemo() {
  const value = useContext(Context);
  if (!value) throw Error('DemoProvider requerido');
  return value;
}
export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const repository = useRef<LocalPrototypeRepository | null>(null);
  useEffect(() => {
    let cancelled = false;
    const repo = new LocalPrototypeRepository(window.localStorage);
    repository.current = repo;
    void repo
      .load()
      .then(async (saved) => {
        if (cancelled) return;
        const initial = saved ?? createFixture();
        if (!saved) await repo.save(initial, null);
        if (!cancelled) setState(initial);
      })
      .catch(() => {
        if (!cancelled)
          setError(
            'No pudimos abrir los datos locales. Puedes recargar o restablecer la demostración.',
          );
      });
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY)
        setError('La demostración cambió en otra pestaña. Recarga antes de registrar otro cambio.');
    };
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  const snapshot = useMemo(() => (state ? calculateSnapshot(state) : null), [state]);
  const reviews = useMemo(
    () => (state && snapshot ? reviewQueue(state, snapshot) : []),
    [state, snapshot],
  );
  async function execute(
    command: Command,
    message = 'Cambio ficticio guardado en este navegador.',
  ) {
    if (!state || !repository.current || lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = applyCommand(state, command, {
        id: 'cmd-' + crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        actorId: 'user-demo',
      });
      await repository.current.save(next, state.revision);
      setState(next);
      setNotice(message);
      return true;
    } catch (e) {
      setError(
        e instanceof ZodError
          ? e.issues.map((i) => i.message).join(' ')
          : e instanceof Error
            ? e.message
            : 'No pudimos guardar. Inténtalo nuevamente.',
      );
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function reset() {
    if (!repository.current || lock.current) return false;
    lock.current = true;
    setBusy(true);
    try {
      const fixture = createFixture();
      await repository.current.reset(fixture);
      setState(fixture);
      setError('');
      setNotice('Demostración restablecida. Se recuperaron los valores originales.');
      return true;
    } catch {
      setError('El navegador no permite guardar. Habilita el almacenamiento local y recarga.');
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <div className="feedback error" role="alert">
          {error} <button onClick={() => window.location.reload()}>Recargar</button>
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
      {state && snapshot ? (
        <Context.Provider value={{ state, error, snapshot, reviews, execute, reset, busy }}>
          <SyntheticTools snapshot={snapshot} />
          {children}
        </Context.Provider>
      ) : (
        <main className="loading" aria-busy={!error}>
          <h1>Clymo Patrimonio</h1>
          <p>
            {error
              ? 'Los datos guardados se conservan hasta que decidas restablecerlos.'
              : 'Preparando tu hogar ficticio…'}
          </p>
          {error && (
            <button
              onClick={() => {
                if (window.confirm('¿Restablecer todos los datos ficticios de este navegador?'))
                  void reset();
              }}
            >
              Restablecer datos ficticios
            </button>
          )}
        </main>
      )}
    </>
  );
}
