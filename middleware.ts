import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // Rafraîchit la session (obligatoire avec les Server Components).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Sous-domaines dédiés : status.<domaine> et trust.<domaine> servent la
  // page d'état et le Trust Center à la racine, sans passer par la vitrine.
  // Les autres chemins de ces hôtes (assets, /api) restent inchangés.
  const host = (request.headers.get('host') ?? '').toLowerCase();
  if (pathname === '/' && host.startsWith('status.')) {
    return NextResponse.rewrite(new URL('/status', request.url));
  }
  if (pathname === '/' && host.startsWith('trust.')) {
    return NextResponse.rewrite(new URL('/trust', request.url));
  }

  // Routes publiques : landing (/), connexion, FAQ, pages légales, état des
  // systèmes et Trust Center.
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/faq') ||
    pathname.startsWith('/legal') ||
    pathname.startsWith('/conditions') ||
    pathname.startsWith('/status') ||
    pathname.startsWith('/trust');

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }
  // Déjà connecté : on saute la landing et le login → direct au tableau de bord.
  if (user && (pathname === '/' || pathname.startsWith('/login'))) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  // Exclut les assets Next, l'API et tout fichier statique (images, icônes…)
  // pour que /logo.png, /air.png, etc. ne soient pas redirigés vers /login.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpe?g|gif|webp|ico|avif)$).*)'],
};
