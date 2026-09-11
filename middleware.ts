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

  // Sous-domaine dédié : status.<domaine> sert la page d'état à la racine,
  // sans passer par la vitrine. Les autres chemins de cet hôte (assets, /api)
  // restent inchangés. Le Trust Center est une application à part (apps/trust).
  const host = (request.headers.get('host') ?? '').toLowerCase();
  if (pathname === '/' && host.startsWith('status.')) {
    return NextResponse.rewrite(new URL('/status', request.url));
  }

  // Routes publiques : landing (/), connexion, FAQ, pages légales et état des
  // systèmes.
  const isPublic =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/faq') ||
    pathname.startsWith('/legal') ||
    pathname.startsWith('/conditions') ||
    pathname.startsWith('/status');

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
