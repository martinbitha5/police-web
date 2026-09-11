import { NextResponse } from 'next/server';
import type { Profile } from '@police/shared';
import { createClient } from '@/supabase/server';
import { createAdminClient } from '@/supabase/admin';

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, airline_code')
    .eq('id', auth.user.id)
    .single<Pick<Profile, 'role' | 'airline_code'>>();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 });
  }

  // Cloisonnement par compagnie : un admin ne gère que les comptes de la
  // sienne. La clé service contourne la RLS, le filtre doit donc vivre ici
  // aussi (même double barrière que le reste du schéma).
  const airline = (profile.airline_code ?? '').trim().toUpperCase();
  if (!airline) {
    return NextResponse.json({ error: 'Profil admin sans compagnie : compte à corriger.' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .eq('airline_code', airline)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Associe l'email et l'état de la double authentification de chaque profil
  // (l'un et l'autre vivent dans auth.users, pas dans profiles). `mfa` est vrai
  // dès qu'un facteur vérifié existe.
  const emailById = new Map<string, string | null>();
  const mfaById = new Map<string, boolean>();
  try {
    const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of authList?.users ?? []) {
      emailById.set(u.id, u.email ?? null);
      mfaById.set(u.id, (u.factors ?? []).some((f) => f.status === 'verified'));
    }
  } catch {
    // si l'inventaire auth échoue, on renvoie quand même les profils sans email
  }

  const users = ((data ?? []) as Profile[]).map((p) => ({
    ...p,
    email: emailById.get(p.id) ?? null,
    mfa: mfaById.get(p.id) ?? false,
  }));

  return NextResponse.json({ users });
}
