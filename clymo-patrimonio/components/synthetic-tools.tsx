'use client';
import { useEffect, useRef } from 'react';
import type { NetWorthSnapshot } from '@/domain/model';
interface ModelContext {
  registerTool(
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute(input: unknown): unknown;
    },
    options: { signal: AbortSignal },
  ): void | Promise<void>;
}
// Optional progressive enhancement. No account, bank or document tools are exposed.
export function SyntheticTools({ snapshot }: { snapshot: NetWorthSnapshot }) {
  const current = useRef(snapshot);
  useEffect(() => {
    current.current = snapshot;
  }, [snapshot]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'get_synthetic_net_worth',
            title: 'Leer el cálculo ficticio',
            description:
              'Lee el mismo patrimonio ficticio y sus componentes que muestra Clymo Patrimonio. No cambia datos ni consulta instituciones.',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute(input) {
              if (
                !input ||
                typeof input !== 'object' ||
                Array.isArray(input) ||
                Object.keys(input).length
              )
                throw Error('Se requiere un objeto vacío.');
              return { synthetic: true, snapshot: current.current };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {
        /* Optional API unavailable: the UI remains fully operable. */
      });
    } catch {
      /* Unsupported experimental browser API; no financial state changes. */
    }
    return () => lifecycle.abort();
  }, []);
  return null;
}
