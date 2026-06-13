'use client';

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Profile } from '@police/shared';
import { createClient } from '@/supabase/client';
import { useIsMobile } from '@/hooks/useIsMobile';
import { IconDashboard, IconUsers, IconLogout, IconReport, IconBag } from './icons';
import { Footer } from './Footer';

function formatToday(): string {
  const s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const SessionCtx = createContext<Profile | null>(null);
export function useSession(): Profile | null {
  return useContext(SessionCtx);
}

export function AppShell({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authed, setAuthed]   = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace('/login'); return; }
      setAuthed(true);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single();
      setProfile((prof as Profile | null) ?? null);
    })();
  }, [router]);

  async function logout() {
    await createClient().auth.signOut();
    router.replace('/login');
  }

  // La page Comptes est RÉSERVÉE aux admins. Les superviseurs ne la voient pas.
  const isAdmin = profile?.role === 'admin';
  const nav = [
    { href: '/dashboard', label: 'Tableau de bord', icon: IconDashboard, show: true },
    { href: '/bagages',   label: 'Bagages',          icon: IconBag,       show: true },
    { href: '/rapport',   label: 'Rapports',         icon: IconReport,    show: true },
    { href: '/admin',     label: 'Comptes',          icon: IconUsers,     show: isAdmin },
  ].filter((n) => n.show);

  // ── Layout mobile ────────────────────────────────────────────
  if (isMobile) {
    return (
      <SessionCtx.Provider value={profile}>
        <div style={m.root}>
          {/* Barre du haut */}
          <header style={m.topBar}>
            <div style={m.topBrand}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Police Bagage" style={m.topLogo} />
                <div>
                  <span style={m.topBrandName}>Police Bagage</span>
                  <span style={m.topBrandHub}>{profile?.airport_code ?? '—'} · {profile?.airline_code ?? 'ET'}</span>
                </div>
              </div>
            </div>
            <div style={m.topRight}>
              {profile ? (
                <div style={m.topAvatar}>{(profile.full_name ?? '?').charAt(0).toUpperCase()}</div>
              ) : null}
              <button style={m.menuBtn} onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
                <HamburgerIcon open={menuOpen} />
              </button>
            </div>
          </header>

          {/* Drawer menu */}
          {menuOpen ? (
            <div style={m.drawer}>
              <div style={m.drawerUser}>
                <div style={m.drawerAvatar}>{(profile?.full_name ?? '?').charAt(0).toUpperCase()}</div>
                <div>
                  <div style={m.drawerName}>{profile?.full_name ?? '—'}</div>
                  <div style={m.drawerRole}>{profile?.role ?? ''}</div>
                </div>
              </div>
              {nav.map((n) => {
                const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
                const Icon = n.icon;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    style={{ ...m.drawerItem, ...(active ? m.drawerItemActive : {}) }}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon size={18} />
                    <span>{n.label}</span>
                  </Link>
                );
              })}
              <button style={m.drawerLogout} onClick={logout}>
                <IconLogout size={16} /> Déconnexion
              </button>
            </div>
          ) : null}

          {/* Contenu principal */}
          <main style={m.main}>
            {authed ? children : <div style={m.loading}>Chargement…</div>}
            <Footer />
          </main>
        </div>
      </SessionCtx.Provider>
    );
  }

  // ── Layout desktop ───────────────────────────────────────────
  return (
    <SessionCtx.Provider value={profile}>
      <div style={d.layout}>
        <aside style={d.sidebar}>
          <div style={d.brandBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Police Bagage" style={d.brandLogo} />
            <div>
              <div style={d.brand}>Police Bagage</div>
              <div style={d.brandSub}>{profile?.airport_code ?? '—'} · {profile?.airline_code ?? 'ET'}</div>
            </div>
          </div>

          <div style={d.navLabel}>Navigation</div>
          <nav style={d.nav}>
            {nav.map((n) => {
              const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link key={n.href} href={n.href} style={{ ...d.navItem, ...(active ? d.navItemActive : {}) }}>
                  {active ? <span style={d.navAccent} /> : null}
                  <Icon size={17} />
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>

          <div style={d.dateBox}>{formatToday()}</div>

          {/* Partenaire */}
          <div style={d.partnerBox}>
            <span style={d.partnerLabel}>Partenaire</span>
            <div style={d.partnerRow}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/air.png" alt="Air Congo" style={d.partnerLogo} />
              <span style={d.partnerName}>Air Congo</span>
            </div>
          </div>

          <div style={d.user}>
            <div style={d.userRow}>
              <div style={d.avatar}>{(profile?.full_name ?? '?').charAt(0).toUpperCase()}</div>
              <div style={{ overflow: 'hidden' }}>
                <div style={d.userName}>{profile?.full_name ?? '—'}</div>
                <div style={d.userRole}>{profile?.role ?? ''}</div>
              </div>
            </div>
            <button onClick={logout} style={d.logout}>
              <IconLogout size={16} /> Déconnexion
            </button>
          </div>
        </aside>

        <main style={d.main}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <div style={{ flex: 1 }}>
              {authed ? children : <div style={d.centered}>Chargement…</div>}
            </div>
            <Footer />
          </div>
        </main>
      </div>
    </SessionCtx.Provider>
  );
}

/** Icône hamburger / croix animée. */
function HamburgerIcon({ open }: { open: boolean }) {
  const bar: CSSProperties = { width: 22, height: 2.5, borderRadius: 2, background: 'var(--text)', transition: 'all 0.2s' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 2 }}>
      <span style={{ ...bar, transform: open ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
      <span style={{ ...bar, opacity: open ? 0 : 1 }} />
      <span style={{ ...bar, transform: open ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
    </div>
  );
}

// ── Styles mobile ───────────────────────────────────────────────
const m: Record<string, CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' },

  topBar: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '13px 16px',
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
  },
  topBrand: { display: 'flex', alignItems: 'center', gap: 1 },
  topLogo: { width: 30, height: 30, borderRadius: 7, objectFit: 'cover' as const, display: 'block', flexShrink: 0 },
  topBrandName: { display: 'block', fontWeight: 800, fontSize: 15, letterSpacing: -0.3, color: 'var(--text)' },
  topBrandHub: { display: 'block', color: 'var(--muted)', fontSize: 11, fontWeight: 600 },
  topRight: { display: 'flex', alignItems: 'center', gap: 10 },
  topAvatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'var(--side-bg)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 14,
  },
  menuBtn: { background: 'transparent', border: 'none', padding: 6, display: 'grid', placeItems: 'center' },

  drawer: {
    position: 'fixed',
    top: 61,
    left: 0,
    right: 0,
    zIndex: 15,
    padding: '14px 14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    background: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    boxShadow: 'var(--shadow-lg)',
  },
  drawerUser: { display: 'flex', alignItems: 'center', gap: 12, padding: '6px 6px 14px', borderBottom: '1px solid var(--border)', marginBottom: 6 },
  drawerAvatar: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    background: 'var(--side-bg)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  },
  drawerName: { fontWeight: 700, fontSize: 15, color: 'var(--text)' },
  drawerRole: { color: 'var(--muted)', fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
  drawerItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, color: 'var(--muted)', fontSize: 15, fontWeight: 600, textDecoration: 'none' },
  drawerItemActive: { background: 'var(--primary-soft)', color: 'var(--primary)' },
  drawerLogout: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--danger)', borderRadius: 8, padding: '11px', fontWeight: 600, fontSize: 14, marginTop: 8 },

  main: { flex: 1, padding: '0 0 24px' },
  loading: { color: 'var(--muted)', display: 'grid', placeItems: 'center', height: '60vh' },
};

// ── Styles desktop ──────────────────────────────────────────────
const d: Record<string, CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: 'var(--bg)' },
  sidebar: {
    width: 252,
    background: 'var(--side-bg)',
    borderRight: '1px solid var(--side-border)',
    padding: '20px 12px 16px',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100vh',
    flexShrink: 0,
  },
  brandBox: { display: 'flex', alignItems: 'center', gap: 11, padding: '0 8px 22px' },
  brandLogo: {
    width: 34,
    height: 34,
    borderRadius: 8,
    objectFit: 'cover' as const,
    display: 'block',
    flexShrink: 0,
  },
  brand: { fontWeight: 700, fontSize: 15, letterSpacing: -0.2, color: 'var(--side-text)' },
  brandSub: { color: 'var(--side-muted)', fontSize: 11.5, marginTop: 1, fontWeight: 600 },

  navLabel: {
    color: 'var(--side-muted)',
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    padding: '0 12px 8px',
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    padding: '10px 12px',
    borderRadius: 7,
    color: 'var(--side-muted)',
    fontSize: 13.5,
    fontWeight: 600,
    textDecoration: 'none',
  },
  navItemActive: { background: 'var(--side-active)', color: 'var(--side-text)' },
  navAccent: {
    position: 'absolute',
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    borderRadius: 3,
    background: 'var(--primary)',
  },

  dateBox: { marginTop: 'auto', color: 'var(--side-muted)', fontSize: 12, padding: '0 12px 12px' },
  user: { display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--side-border)', paddingTop: 14 },
  userRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--side-active)',
    border: '1px solid var(--side-border)',
    color: 'var(--side-text)',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  userName: { fontWeight: 600, fontSize: 13.5, color: 'var(--side-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole: { color: 'var(--side-muted)', fontSize: 11.5, textTransform: 'capitalize' },
  logout: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'transparent',
    border: '1px solid var(--side-border)',
    color: 'var(--side-muted)',
    borderRadius: 7,
    padding: '8px 10px',
    fontWeight: 600,
    fontSize: 13,
  },

  main: { flex: 1, overflow: 'auto', minWidth: 0 },
  centered: { color: 'var(--muted)', display: 'grid', placeItems: 'center', height: '60vh' },

  partnerBox: {
    borderTop: '1px solid var(--side-border)',
    padding: '12px 12px 10px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 7,
  },
  partnerLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    color: 'var(--side-muted)',
  },
  partnerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  partnerLogo: {
    height: 24,
    objectFit: 'contain' as const,
    display: 'block',
    borderRadius: 4,
    flexShrink: 0,
  },
  partnerName: {
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--side-muted)',
  },
};
