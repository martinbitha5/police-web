'use client';

import { useEffect, useLayoutEffect, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import type { Profile } from '@police/shared';
import { createClient } from '@/supabase/client';
import { partnerBrand } from '@/lib/partner';
import { useIsMobile } from '@/hooks/useIsMobile';
import { btnSecondary } from '@/ui/theme';
import { IconDashboard, IconUsers, IconLogout, IconReport, IconBag, IconUser, IconPlane, IconAudit, IconMenu } from './icons';
import { Footer } from './Footer';
import { PartnerCtx, SessionCtx } from './session';

// RÃ©export : les pages importent ces hooks depuis '@/components/AppShell'.
export { useSession, usePartner } from './session';

function formatToday(): string {
  const s = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Compagnie du dernier profil chargÃ©, mÃ©morisÃ©e sur l'appareil : au
// rechargement, le bon logo s'affiche dÃ¨s le premier rendu, sans attendre le
// retour rÃ©seau du profil. Sans ce cache, un superviseur CAA voyait Air Congo
// pendant le chargement.
const AIRLINE_CACHE_KEY = 'pb.airline';

// Raccourcis de la barre compacte sur tÃ©lÃ©phone, entre le menu et les rapports.
// Trois entrÃ©es seulement : les Ã©crans consultÃ©s en cours d'exploitation. Le
// reste (profil, audit, comptes) vit dans le tiroir, ouvert par la premiÃ¨re
// cellule. Aucun raccourci rÃ©servÃ© aux admins : la rangÃ©e est la mÃªme pour
// tous, elle ne doit pas changer de dÃ©coupage selon le rÃ´le.
const QUICK_NAV = [
  { href: '/dashboard', label: 'Tableau de bord', icon: IconDashboard },
  { href: '/vols', label: 'Vols', icon: IconPlane },
  { href: '/bagages', label: 'Bagages', icon: IconBag },
];

export function AppShell({ children }: { children: ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authed, setAuthed]   = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // null = compagnie pas encore connue (ni cache, ni profil) : aucun logo.
  const [airline, setAirline] = useState<string | null>(null);

  // Avant la premiÃ¨re peinture (useLayoutEffect, pas useEffect) : reprend la
  // compagnie mÃ©morisÃ©e pour que le logo soit juste dÃ¨s le premier affichage.
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
      // Le profil fait foi : il met Ã  jour l'affichage et le cache. Une
      // compagnie absente vide les deux, plutÃ´t que d'afficher un logo hÃ©ritÃ©.
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
    // Oublie la compagnie mÃ©morisÃ©e : le prochain utilisateur de cet appareil
    // ne doit pas voir le logo du prÃ©cÃ©dent pendant son chargement de profil.
    try { localStorage.removeItem(AIRLINE_CACHE_KEY); } catch { /* sans consÃ©quence */ }
    await createClient().auth.signOut();
    router.replace('/login');
  }

  // Logo partenaire : cache local d'abord, profil ensuite. Null tant que la
  // compagnie est inconnue â€” on n'affiche alors AUCUN logo, jamais un dÃ©faut.
  const partner = partnerBrand(airline);
  // Sous-titre du logo : rien tant que le profil n'est pas chargÃ©, plutÃ´t
  // qu'un Â« ET Â» par dÃ©faut qui serait faux pour un profil d'une autre compagnie.
  const hubLine = profile ? `${profile.airport_code ?? 'N/A'} Â· ${profile.airline_code ?? 'N/A'}` : '';

  // Les pages Comptes et Journal d'audit sont RÃ‰SERVÃ‰ES aux admins. Les
  // superviseurs ne les voient pas. Masquer l'entrÃ©e ne suffit pas : la page
  // refuse l'accÃ¨s, et la vue `movement_log` ne renvoie rien Ã  un non-admin.
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

  // â”€â”€ Layout mobile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isMobile) {
    return (
      <SessionCtx.Provider value={profile}>
        <PartnerCtx.Provider value={partner}>
        <div style={m.root}>
          {/* Barre du haut â€” blanche, collante, deux Ã©tats : la marque en haut
              de page, une rangÃ©e de raccourcis dÃ¨s qu'on dÃ©file. L'Ã©change est
              fait en CSS (globals.css, .pb-full / .pb-icons) d'aprÃ¨s
              `data-scrolled`, sans Ã©tat React qui se rejouerait Ã  chaque pixel.
              Les deux Ã©tats font 60 px, la hauteur sur laquelle le tiroir
              s'ouvre : une barre qui rÃ©trÃ©cit dÃ©calerait la page en dÃ©filant. */}
          <header className="app-topbar" style={m.topBar}>
            <div className="pb-bar pb-full" style={m.topBarInner}>
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
            </div>

            <nav className="pb-icons" style={m.topBarIcons} aria-label="Raccourcis">
              <button
                className={`pb-icon${menuOpen ? ' pb-icon-on' : ''}`}
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menu"
              >
                <IconMenu size={22} />
              </button>
              {QUICK_NAV.map((q) => {
                const Icon = q.icon;
                const active = pathname.startsWith(q.href);
                return (
                  <Link
                    key={q.href}
                    href={q.href}
                    className={`pb-icon${active ? ' pb-icon-on' : ''}`}
                    aria-label={q.label}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon size={20} />
                  </Link>
                );
              })}
              <Link
                href="/rapport"
                className="pb-icon pb-icon-cta"
                aria-label="Rapports"
                onClick={() => setMenuOpen(false)}
              >
                <span className="pb-icon-pill">
                  <IconReport size={19} />
                </span>
              </Link>
            </nav>
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
                    className="nav-item"
                    aria-current={active ? 'page' : undefined}
                    style={{ ...m.drawerItem, ...(active ? m.drawerItemActive : {}) }}
                    onClick={() => setMenuOpen(false)}
                  >
                    {/* L'icÃ´ne seule porte l'accent : le libellÃ© reste noir. */}
                    <span style={{ display: 'inline-flex', color: active ? 'var(--accent)' : 'inherit' }}>
                      <Icon size={18} />
                    </span>
                    <span>{n.label}</span>
                  </Link>
                );
              })}
              <button style={m.drawerLogout} onClick={logout}>
                <IconLogout size={16} /> DÃ©connexion
              </button>
            </div>
          ) : null}

          {/* Contenu principal */}
          <main style={m.main}>
            {authed ? children : <div style={m.loading}>Chargementâ€¦</div>}
            <Footer variant="app" />
          </main>
        </div>
        </PartnerCtx.Provider>
      </SessionCtx.Provider>
    );
  }

  // â”€â”€ Layout desktop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

          <nav style={d.nav} aria-label="Navigation principale">
            {nav.map((n) => {
              const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className="nav-item"
                  aria-current={active ? 'page' : undefined}
                  style={{ ...d.navItem, ...(active ? d.navItemActive : {}) }}
                >
                  <span style={{ display: 'inline-flex', color: active ? 'var(--accent)' : 'inherit' }}>
                    <Icon size={18} />
                  </span>
                  <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>

          <div style={d.dateBox}>{formatToday()}</div>

          {/* Partenaire â€” logo de la compagnie du profil connectÃ©. Rien tant
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
              <IconLogout size={16} /> DÃ©connexion
            </button>
          </div>
        </aside>

        <main style={d.main}>
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
            <div style={{ flex: 1 }}>
              {authed ? children : <div style={d.centered}>Chargementâ€¦</div>}
            </div>
            <Footer variant="app" />
          </div>
        </main>
      </div>
      </PartnerCtx.Provider>
    </SessionCtx.Provider>
  );
}

/** IcÃ´ne hamburger / croix animÃ©e. */
function HamburgerIcon({ open }: { open: boolean }) {
  const bar: CSSProperties = { width: 22, height: 2, borderRadius: 2, background: 'var(--content-primary)', transition: 'all 0.2s' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: 2 }}>
      <span style={{ ...bar, transform: open ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
      <span style={{ ...bar, opacity: open ? 0 : 1 }} />
      <span style={{ ...bar, transform: open ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
    </div>
  );
}

// EntrÃ©e de navigation : pilule pleine largeur. Au repos texte gris poids
// 500 ; active fond gris soutenu, texte noir poids 600 (en monochrome, deux
// gris voisins ne suffisent pas Ã  distinguer Â« sÃ©lectionnÃ© Â» de Â« survolÃ© Â»,
// la graisse fait la diffÃ©rence). Le survol (fond --bg-neutral) est portÃ© par
// la classe .nav-item dans globals.css : un style inline ne sait pas survoler.
const NAV_ITEM: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '10px 14px',
  borderRadius: 9999,
  color: 'var(--content-secondary)',
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
};

const NAV_ITEM_ACTIVE: CSSProperties = {
  background: 'var(--bg-neutral-hover)',
  color: 'var(--content-primary)',
  fontWeight: 600,
};

// â”€â”€ Styles mobile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const m: Record<string, CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg-screen)' },

  // L'enveloppe ne porte plus la mise en page : elle accueille deux rangÃ©es
  // dont une seule est visible Ã  la fois. Le `display` reste aux classes
  // .pb-full / .pb-icons, qu'un style inline empÃªcherait de masquer.
  topBar: {
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'var(--bg-screen)',
    borderBottom: '1px solid var(--divider)',
  },
  topBarInner: {
    height: 60,
    justifyContent: 'space-between',
    padding: '0 16px',
  },
  // Pas de marge latÃ©rale : les cellules vont d'un bord Ã  l'autre, sÃ©parÃ©es
  // par des filets, comme une rangÃ©e d'onglets.
  topBarIcons: { height: 60 },
  topBrand: { display: 'flex', alignItems: 'center', gap: 1 },
  topLogo: { width: 30, height: 30, borderRadius: 8, objectFit: 'cover' as const, display: 'block', flexShrink: 0 },
  topBrandName: {
    display: 'block',
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: '-0.02em',
    color: 'var(--content-primary)',
  },
  topBrandHub: { display: 'block', color: 'var(--content-secondary)', fontSize: 12, fontWeight: 500 },
  topRight: { display: 'flex', alignItems: 'center', gap: 10 },
  topAvatar: {
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: 'var(--bg-neutral)',
    color: 'var(--content-primary)',
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
    borderBottom: '1px solid var(--divider)',
    boxShadow: 'var(--shadow-card)',
    // Petits Ã©crans (SE, Ã©crans courts) : le menu dÃ©file au lieu de dÃ©border.
    maxHeight: 'calc(100vh - 61px)',
    overflowY: 'auto',
  },
  drawerUser: { display: 'flex', alignItems: 'center', gap: 12, padding: '6px 6px 14px', borderBottom: '1px solid var(--divider)', marginBottom: 6 },
  drawerAvatar: {
    width: 42,
    height: 42,
    borderRadius: '50%',
    background: 'var(--bg-neutral)',
    color: 'var(--content-primary)',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  },
  drawerName: { fontWeight: 600, fontSize: 15, color: 'var(--content-primary)' },
  drawerRole: { color: 'var(--content-secondary)', fontSize: 12, textTransform: 'capitalize', marginTop: 2 },
  drawerItem: { ...NAV_ITEM, padding: '12px 16px', fontSize: 15 },
  drawerItemActive: NAV_ITEM_ACTIVE,
  drawerLogout: { ...btnSecondary, width: '100%', marginTop: 8, fontSize: 14 },

  main: { flex: 1, padding: '0 0 24px' },
  loading: { color: 'var(--content-secondary)', display: 'grid', placeItems: 'center', height: '60vh' },
};

// â”€â”€ Styles desktop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const d: Record<string, CSSProperties> = {
  layout: { display: 'flex', minHeight: '100vh', background: 'var(--bg-screen)' },
  sidebar: {
    width: 260,
    background: 'var(--bg-screen)',
    borderRight: '1px solid var(--divider)',
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
  brand: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: '-0.02em',
    color: 'var(--content-primary)',
  },
  brandSub: { color: 'var(--content-secondary)', fontSize: 12, marginTop: 1, fontWeight: 500 },

  nav: { display: 'flex', flexDirection: 'column', gap: 2 },
  navItem: NAV_ITEM,
  navItemActive: NAV_ITEM_ACTIVE,

  dateBox: { marginTop: 'auto', color: 'var(--content-tertiary)', fontSize: 12, padding: '0 14px 12px' },
  user: { display: 'flex', flexDirection: 'column', gap: 10, borderTop: '1px solid var(--divider)', paddingTop: 14 },
  userRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    background: 'var(--bg-neutral)',
    color: 'var(--content-primary)',
    display: 'grid',
    placeItems: 'center',
    fontWeight: 700,
    fontSize: 14,
    flexShrink: 0,
  },
  userName: { fontWeight: 600, fontSize: 14, color: 'var(--content-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  userRole: { color: 'var(--content-secondary)', fontSize: 12, textTransform: 'capitalize' },
  logout: { ...btnSecondary, width: '100%', height: 40, fontSize: 14 },

  main: { flex: 1, overflow: 'auto', minWidth: 0, background: 'var(--bg-screen)' },
  centered: { color: 'var(--content-secondary)', display: 'grid', placeItems: 'center', height: '60vh' },

  // LibellÃ© et logo sur la MÃŠME ligne : le libellÃ© Ã  gauche, le logo Ã  droite.
  partnerBox: {
    borderTop: '1px solid var(--divider)',
    padding: '12px 12px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  partnerLabel: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    color: 'var(--content-tertiary)',
  },
  partnerPill: {
    display: 'inline-flex',
    alignItems: 'center',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--divider)',
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
