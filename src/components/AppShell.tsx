'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Profile } from '@police/shared';
import { createClient } from '@/supabase/client';
import { partnerBrand, type PartnerBrand } from '@/lib/partner';
import { useIsMobile } from '@/hooks/useIsMobile';
import { IconDashboard, IconUsers, IconLogout, IconReport, IconBag, IconUser, IconPlane, IconAudit } from './icons';
import { Footer } from './Footer';

function formatToday(): string {
  const s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const SessionCtx = createContext<Profile | null>(null);
export function useSession(): Profile | null {
  return useContext(SessionCtx);
}

// Marque partenaire de la compagnie du profil, null tant qu'elle est inconnue.
// Contexte séparé de la session : le Footer en a besoin sans porter tout le profil.
const PartnerCtx = createContext<PartnerBrand | null>(null);
export function usePartner(): PartnerBrand | null {
  return useContext(PartnerCtx);
}

// Compagnie du dernier profil chargé, mémorisée sur l'appareil : au
// rechargement, le bon logo s'affiche dès le premier rendu, sans attendre le
// retour réseau du profil. Sans ce cache, un superviseur CAA voyait Air Congo
// pendant le chargement.
const AIRLINE_CACHE_KEY = 'pb.airline';

export function AppShell({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authed, setAuthed]   = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // null = compagnie pas encore connue (ni cache, ni profil) : aucun logo.
  const [airline, setAirline] = useState<string | null>(null);

  // Avant la première peinture (useLayoutEffect, pas useEffect) : reprend la
  // compagnie mémorisée pour que le logo soit juste dès le premier affichage.
  useLayoutEffect(() => {
    try {
      const cached = localStorage.getItem(AIRLINE_CACHE_KEY);
      if (cached) setAirline(cached);
    } catch {
      // stockage local indisponible : le logo attendra le profil
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace('/login'); return; }
      setAuthed(true);
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single();
      const p = (prof as Profile | null) ?? null;
      setProfile(p);
      // Le profil fait foi : il met à jour l'affichage et le cache. Une
      // compagnie absente vide les deux, plutôt que d'afficher un logo hérité.
      const code = (p?.airline_code ?? '').trim().toUpperCase();
      setAirline(code);
      try {
        if (code) localStorage.setItem(AIRLINE_CACHE_KEY, code);
        else localStorage.removeItem(AIRLINE_CACHE_KEY);
      } catch {
        // stockage local indisponible : tant pis pour le prochain rechargement
      }
    })();
  }, [router]);

  async function logout() {
    // Oublie la compagnie mémorisée : le prochain utilisateur de cet appareil
    // ne doit pas voir le logo du précédent pendant son chargement de profil.
    try { localStorage.removeItem(AIRLINE_CACHE_KEY); } catch { /* sans conséquence */ }
    await createClient().auth.signOut();
    router.replace('/login');
  }

  // Logo partenaire : cache local d'abord, profil ensuite. Null tant que la
  // compagnie est inconnue — on n'affiche alors AUCUN logo, jamais un défaut.
  const partner = partnerBrand(airline);
  // Sous-titre du logo : rien tant que le profil n'est pas chargé, plutôt
  // qu'un « ET » par défaut qui serait faux pour un profil d'une autre compagnie.
  const hubLine = profile ? `${profile.airport_code ?? 'N/A'} · ${profile.airline_code ?? 'N/A'}` : '';

  // Les pages Comptes et Journal d'audit sont RÉSERVÉES aux admins. Les
  // superviseurs ne les voient pas. Masquer l'entrée ne suffit pas : la page
  // refuse l'accès, et la vue `movement_log` ne renvoie rien à un non-admin.
  const isAdmin = profile?.role === 'admin';
  const nav = [
    { href: '/dashboard', label: 'Tableau de bord', icon: IconDashboard, show: true },
    { href: '/vols',      label: 'Vols',             icon: IconPlane,     show: true },
    { href: '/bagages',   label: 'Bagages',          icon: IconBag,       show: true },
    { href: '/rapport',   label: 'Rapports',         icon: IconReport,    show: true },
    { href: '/profil',    label: 'Profil',           icon: IconUser,      show: true },
    { href: '/audit',     label: "Journal d'audit",  icon: IconAudit,     show: isAdmin },
    { href: '/admin',     label: 'Comptes',          icon: IconUsers,     show: isAdmin },
  ].filter((n) => n.show);

  // ── Layout mobile ────────────────────────────────────────────
  if (isMobile) {
    return (
      <SessionCtx.Provider value={profile}>
        <PartnerCtx.Provider value={partner}>
        <div style={m.root}>
          {/* Barre du haut — blanche, sticky */}
          <header style={m.topBar}>
            <div style={m.topBrand}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Police Bagage" style={m.topLogo} />
                <div>
                  <span style={m.topBrandName}>Police Bagage</span>
                  <span style={m.topBrandHub}>{hubLine}</span>
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
                  <div style={m.drawerName}>{profile?.full_name ?? 'N/A'}</div>
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
        </PartnerCtx.Provider>
      </SessionCtx.Provider>
    );
  }

  // ── Layout desktop ───────────────────────────────────────────
  return (
    <SessionCtx.Provider value={profile}>
      <PartnerCtx.Provider value={partner}>
      <div style={d.layout}>
        <aside style={d.sidebar}>
          <div style={d.brandBox}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Police Bagage" style={d.brandLogo} />
            <div>
              <div style={d.brand}>Police Bagage</div>
              <div style={d.brandSub}>{hubLine}</div>
            </div>
          </div>

          <div style={d.navLabel}>Navigation</div>
          <nav style={d.nav}>
            {nav.map((n) => {
              const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link key={n.href} href={n.href} style={{ ...d.navItem, ...(active ? d.navItemActive : {}) }}>
                  <Icon size={17} />
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>

          <div style={d.dateBox}>{formatToday()}</div>

          {/* Partenaire — logo de la compagnie du profil connecté. Rien tant
              qu'elle est inconnue : jamais le logo d'une autre compagnie. */}
          {partner ? (
            <div style={d.partnerBox}>
              <span style={d.partnerLabel}>Partenaire</span>
              <span style={d.partnerPill}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={partner.src} alt={partner.alt} style={d.partnerLogo} />
              </span>
            </div>
          ) : null}

          <div style={d.user}>
            <div style={d.userRow}>
              <div style={d.avatar}>{(profile?.full_name ?? '?').charAt(0).toUpperCase()}</div>
              <div style={{ overflow: 'hidden' }}>
                <div style={d.userName}>{profile?.full_name ?? 'N/A'}</div>
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
      </PartnerCtx.Provider>
    </SessionCtx.Provider>
  );
}

/** Icône hamburger / croix animée. */
function HamburgerIcon({ open }: { open: boolean }) {
  const bar: CSSProperties = { width: 22, height: 2.5, borderRadius: 2, background: 'var(--content-primary)', transition: 'all 0.2s' };
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
  root: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-screen)' },

  topBar: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '13px 16px',
    background: 'var(--bg-screen)',
    borderBottom: '1px solid var(--border-neutral)',
  },
  topBrand: { display: 'flex', alignItems: 'center', gap: 1 },
  topLogo: { width: 30, height: 30, borderRadius: 7, objectFit: 'cover' as const, display: 'block', flexShrink: 0 },
  topBrandName: { display: 'block', fontWeight: 700, fontSize: 15, letterSpacing: '-0.03em', color: 'var(--content-primary)' },
  topBrandHub: { display: 'block', color: 'var(--content-secondary)', fontSize: 11, fontWeight: 600 },
  topRight: { display: 'flex', alignItems: 'center', gap: 10 },
  topAvatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'var(--bg-neutral)',
    color: 'var(--brand-forest)',
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
    background: 'var(--bg-screen)',
    borderBottom: '1px solid var(--border-neutral)',
    boxShadow: 'var(--shadow-card)',
    // Petits écrans (SE, écrans courts) : le menu défile au lieu de déborder.
    maxHeight: 'calc(100vh - 61px)',
    overflowY: 'auto',
  },
  drawerUser: { display: 'flex', alignItems: 'center', gap: 12, padding: '6px 6px 14px', borderBottom: '1px solid var(--border-neutral)', marginBottom: 6 },
  drawerAvatar: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    background: 'var(--bg-neutral)',
    color: 'var(--brand-forest)',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  },
  drawerName: { fontWeight: 700, fontSize: 15, color: 'var(--content-primary)' },
  drawerRole: { color: 'var(--content-secondary)', fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
  drawerItem: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 9999, color: 'var(--content-secondary)', fontSize: 15, fontWeight: 600, textDecoration: 'none' },
  drawerItemActive: { background: 'var(--bg-neutral-hover)', color: 'var(--brand-forest)' },
  drawerLogout: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: 'transparent', border: '1px solid var(--border-neutral)', color: 'var(--negative)', borderRadius: 9999, padding: '11px', fontWeight: 600, fontSize: 14, marginTop: 8 },

  main: { flex: 1, padding: '0 0 24px' },
  loading: { color: 'var(--content-secondary)', display: 'grid', placeItems: 'center', height: '60vh' },
};

// ── Styles desktop ──────────────────────────────────────────────
const d: Record<string, CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: 'var(--bg-screen)' },
  sidebar: {
    width: 260,
    background: 'var(--bg-screen)',
    borderRight: '1px solid var(--border-neutral)',
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
  brand: { fontWeight: 700, fontSize: 15, letterSpacing: '-0.03em', color: 'var(--content-primary)' },
  brandSub: { color: 'var(--content-secondary)', fontSize: 11.5, marginTop: 1, fontWeight: 600 },

  navLabel: {
    color: 'var(--content-tertiary)',
    fontSize: 10.5,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    padding: '0 16px 8px',
  },
  nav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 11,
    padding: '10px 16px',
    borderRadius: 9999,
    color: 'var(--content-secondary)',
    fontSize: 14,
    fontWeight: 500,
    textDecoration: 'none',
  },
  navItemActive: { background: 'var(--bg-neutral-hover)', color: 'var(--brand-forest)', fontWeight: 600 },

  dateBox: { marginTop: 'auto', color: 'var(--content-tertiary)', fontSize: 12, padding: '0 16px 12px' },
  user: { display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--border-neutral)', paddingTop: 14 },
  userRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--bg-neutral)',
    boxShadow: 'inset 0 0 0 1px var(--border-neutral)',
    color: 'var(--brand-forest)',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  userName: { fontWeight: 600, fontSize: 13.5, color: 'var(--content-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole: { color: 'var(--content-secondary)', fontSize: 11.5, textTransform: 'capitalize' },
  logout: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: 'transparent',
    border: '1px solid var(--border-neutral)',
    color: 'var(--content-secondary)',
    borderRadius: 9999,
    padding: '8px 10px',
    fontWeight: 600,
    fontSize: 13,
  },

  main: { flex: 1, overflow: 'auto', minWidth: 0, background: 'var(--bg-screen)' },
  centered: { color: 'var(--content-secondary)', display: 'grid', placeItems: 'center', height: '60vh' },

  // Libellé et logo sur la MÊME ligne : le libellé à gauche, le logo à droite.
  partnerBox: {
    borderTop: '1px solid var(--border-neutral)',
    padding: '12px 12px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  partnerLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: 1.2,
    color: 'var(--content-tertiary)',
  },
  partnerPill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'var(--bg-neutral)',
    borderRadius: 9999,
    padding: '7px 13px',
    flexShrink: 0,
  },
  partnerLogo: {
    height: 22,
    objectFit: 'contain' as const,
    display: 'block',
  },
};
