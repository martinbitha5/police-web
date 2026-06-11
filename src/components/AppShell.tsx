'use client';

import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Profile } from '@police/shared';
import { createClient } from '@/supabase/client';
import { glassStrong } from '@/ui/theme';
import { useIsMobile } from '@/hooks/useIsMobile';
import { IconDashboard, IconUsers, IconLogout, IconReport, IconBag } from './icons';

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
              <span style={m.topBrandName}>Police Bagage</span>
              <span style={m.topBrandHub}>{profile?.airport_code ?? '—'} · {profile?.airline_code ?? 'ET'}</span>
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
            <div>
              <div style={d.brand}>Police Bagage</div>
              <div style={d.brandSub}>{profile?.airport_code ?? '—'} · {profile?.airline_code ?? 'ET'}</div>
            </div>
          </div>

          <nav style={d.nav}>
            {nav.map((n) => {
              const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link key={n.href} href={n.href} style={{ ...d.navItem, ...(active ? d.navItemActive : {}) }}>
                  {active ? <span style={d.navAccent} /> : null}
                  <Icon size={18} />
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>

          <div style={d.dateBox}>{formatToday()}</div>

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
          {authed ? children : <div style={d.centered}>Chargement…</div>}
        </main>
      </div>
    </SessionCtx.Provider>
  );
}

/** Icône hamburger / croix animée. */
function HamburgerIcon({ open }: { open: boolean }) {
  const bar: CSSProperties = { width: 22, height: 2.5, borderRadius: 2, background: '#f1f5f9', transition: 'all 0.2s' };
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
  root: { display: 'flex', flexDirection: 'column', minHeight: '100vh' },

  topBar: {
    ...glassStrong,
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
  },
  topBrand: { display: 'flex', flexDirection: 'column', gap: 1 },
  topBrandName: { fontWeight: 800, fontSize: 17, letterSpacing: -0.3 },
  topBrandHub: { color: 'var(--muted)', fontSize: 11, fontWeight: 600 },
  topRight: { display: 'flex', alignItems: 'center', gap: 10 },
  topAvatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--primary), #1d4ed8)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 15,
  },
  menuBtn: { background: 'transparent', border: 'none', color: '#f1f5f9', padding: 6, display: 'grid', placeItems: 'center' },

  drawer: {
    ...glassStrong,
    position: 'fixed',
    top: 64,
    left: 0,
    right: 0,
    zIndex: 15,
    padding: '16px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    borderTop: '1px solid var(--glass-border)',
    borderLeft: 'none',
    borderRight: 'none',
  },
  drawerUser: { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 6px 14px', borderBottom: '1px solid var(--glass-border)', marginBottom: 6 },
  drawerAvatar: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--primary), #1d4ed8)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  },
  drawerName: { fontWeight: 700, fontSize: 15 },
  drawerRole: { color: 'var(--muted)', fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
  drawerItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px', borderRadius: 12, color: 'var(--muted)', fontSize: 15, fontWeight: 600, textDecoration: 'none' },
  drawerItemActive: { background: 'rgba(37,99,235,0.20)', color: '#f1f5f9' },
  drawerLogout: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', border: '1px solid var(--glass-border)', color: 'var(--danger)', borderRadius: 12, padding: '12px', fontWeight: 600, fontSize: 14, marginTop: 8 },

  main: { flex: 1, padding: '0 0 24px' },
  loading: { color: 'var(--muted)', display: 'grid', placeItems: 'center', height: '60vh' },
};

// ── Styles desktop ──────────────────────────────────────────────
const d: Record<string, CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    ...glassStrong,
    width: 264,
    borderTop: 'none',
    borderBottom: 'none',
    borderLeft: 'none',
    padding: '20px 14px',
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: 0,
    height: '100vh',
  },
  brandBox: { display: 'flex', alignItems: 'center', gap: 12, padding: '0 6px 20px' },
  brand: { fontWeight: 800, fontSize: 16, letterSpacing: -0.3 },
  brandSub: { color: 'var(--muted)', fontSize: 12, marginTop: 1 },

  nav: { display: 'flex', flexDirection: 'column', gap: 4 },
  navItem: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '11px 14px',
    borderRadius: 10,
    color: 'var(--muted)',
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
  },
  navItemActive: { background: 'rgba(37,99,235,0.18)', color: 'var(--text)' },
  navAccent: {
    position: 'absolute',
    left: 0,
    top: 9,
    bottom: 9,
    width: 3,
    borderRadius: 3,
    background: 'var(--primary)',
  },

  dateBox: { marginTop: 'auto', color: 'var(--muted)', fontSize: 12, padding: '0 8px 12px' },
  user: { display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--glass-border)', paddingTop: 14 },
  userRow: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--primary), #1d4ed8)',
    color: '#fff',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    flexShrink: 0,
  },
  userName: { fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole: { color: 'var(--muted)', fontSize: 12, textTransform: 'capitalize' },
  logout: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'transparent',
    border: '1px solid var(--glass-border)',
    color: 'var(--danger)',
    borderRadius: 10,
    padding: '9px 10px',
    fontWeight: 600,
    fontSize: 14,
  },

  main: { flex: 1, overflow: 'auto', minWidth: 0 },
  centered: { color: 'var(--muted)', display: 'grid', placeItems: 'center', height: '60vh' },
};
