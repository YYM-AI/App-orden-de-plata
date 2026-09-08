'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Landmark,
  ClipboardCheck,
  Settings,
  ShieldCheck,
  ArrowUpRight,
} from 'lucide-react';
import { useDemo } from './demo-provider';
import type { ReactNode } from 'react';
const links = [
  { href: '/', label: 'Resumen', Icon: LayoutDashboard },
  { href: '/fuentes', label: 'Fuentes', Icon: Landmark },
  { href: '/revision', label: 'Revisión', Icon: ClipboardCheck },
  { href: '/configuracion', label: 'Configuración', Icon: Settings },
];
export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { state, reviews, execute } = useDemo();
  const pending = reviews.filter((r) => r.status === 'pending').length;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="Clymo Patrimonio, inicio">
          <span className="brand-symbol">c</span>
          <span>
            clymo<small>PATRIMONIO</small>
          </span>
        </Link>
        <div className="sidebar-caption">TU ESPACIO</div>
        <nav aria-label="Navegación principal">
          {links.map(({ href, label, Icon }) => (
            <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>
              <Icon aria-hidden="true" size={21} />
              <span>{label}</span>
              {href === '/revision' && pending > 0 && (
                <span className="nav-count" aria-label={`${pending} pendientes`}>
                  {pending}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <ShieldCheck size={24} aria-hidden="true" />
          <strong>Un espacio de demostración</strong>
          <p>Datos ficticios, guardados únicamente en este navegador.</p>
          <Link href="/configuracion">
            Acerca de tus datos <ArrowUpRight size={16} />
          </Link>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="household-avatar" aria-hidden="true">
            FD
          </div>
          <div>
            <strong>{state.household.name}</strong>
            <span>Hogar ficticio</span>
          </div>
          <label className="currency-picker">
            Mostrar en
            <select
              aria-label="Moneda de presentación"
              value={state.settings.reportingCurrency}
              onChange={(e) =>
                void execute(
                  { type: 'settings', reportingCurrency: e.target.value as 'CLP' | 'USD' },
                  'Moneda recalculada desde los valores originales.',
                )
              }
            >
              <option value="CLP">CLP · Peso chileno</option>
              <option value="USD">USD · Dólar</option>
            </select>
          </label>
        </header>
        <div className="privacy-banner">
          <ShieldCheck size={18} aria-hidden="true" />
          <p>
            Este prototipo utiliza únicamente datos ficticios. No ingreses ni subas información
            financiera real.
          </p>
        </div>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="app-footer">
          Clymo Patrimonio · Demostración local · Corte fijo: 4 de septiembre de 2026
        </footer>
      </div>
    </div>
  );
}
