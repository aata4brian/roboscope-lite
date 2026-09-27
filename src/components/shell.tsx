'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, ArrowUpRight, Box, ChevronRight, CircleHelp, CircuitBoard, LayoutDashboard, ListFilter, Radio } from 'lucide-react';
import type { ReactNode } from 'react';
import { useSession } from './session-provider';

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { running, session, error } = useSession();
  const detail = pathname.startsWith('/incidents/');
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to main content</a>
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark"><CircuitBoard size={21}/></span><span>RoboScope<span className="lite">LITE</span></span></Link>
      <div className="workspace-label">WORKSPACE</div>
      <nav aria-label="Main navigation">
        <Link href="/" className={!detail ? 'nav-link selected' : 'nav-link'}><LayoutDashboard size={17}/> Overview</Link>
        <Link href="/#incidents" className={detail ? 'nav-link selected' : 'nav-link'}><ListFilter size={17}/> Incidents <span className="nav-count">{session?.incidents.length ?? 0}</span></Link>
      </nav>
      <div className="sidebar-device"><span className="tiny-label">CONNECTED ROBOT</span><div><Box size={19}/><strong>ROBOT-01</strong></div><p>Differential drive</p><span className="muted mono">r = 65 mm · b = 320 mm</span></div>
      <div className="sidebar-bottom"><span className="tiny-label">SIMULATION ENVIRONMENT</span><p><span className="status-dot"/> Local playground</p><span className="muted">Seed 42 · No hardware required</span><a href="https://github.com/aata4brian" target="_blank" rel="noreferrer">Built by Brian Baldan <ArrowUpRight size={13}/></a></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><strong>{detail ? 'Incident analysis' : 'Overview'}</strong></div><div className="topbar-status"><Radio size={14}/><span>ROBOT-01</span><span className={running ? 'online' : 'muted'}>{running ? 'STREAMING' : 'STANDBY'}</span></div></header>
      <main id="main">{error ? <div role="alert" className="error-banner"><CircleHelp size={17}/>{error}</div> : null}{children}</main>
      <footer className="footer"><span><Activity size={13}/> SIMULATED TELEMETRY</span><span>RoboScope Lite / v1.0 <span className="footer-divider">·</span> Times in UTC</span></footer>
    </div>
  </div>;
}
