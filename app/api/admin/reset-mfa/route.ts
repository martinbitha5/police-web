import { NextResponse, type NextRequest } from 'next/server';
import type { Profile } from '@police/shared';
import { createClient } from '@/supabase/server';
import { createAdminClient } from '@/supabase/admin';

/**
 * Retire tous les facteurs de double authentification d'un compte de la même
 * compagnie. Sert quand la personne a perdu son téléphone ou réinstallé son
 * application : à sa prochaine connexion, le portail lui redemande un
 * enrôlement. Le mot de passe n'est pas touché.
 */
export async function POST(request: NextRequest) {
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

  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Cloisonnement par compagnie : même double barrière que la suppression.
  const myAirline = (profile.airline_code ?? '').trim().toUpperCase();
  const { data: target } = await admin
    .from('profiles')
    .select('airline_code')
    .eq('id', body.id)
    .maybeSingle<Pick<Profile, 'airline_code'>>();
  if (!target) {
    return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
  }
  if ((target.airline_code ?? '').trim().toUpperCase() !== myAirline) {
    return NextResponse.json({ error: 'Ce compte appartient à une autre compagnie.' }, { status: 403 });
  }

  const { data: list, error: listErr } = await admin.auth.admin.mfa.listFactors({ userId: body.id });
  if (listErr) {
    return NextResponse.json({ error: listErr.message }, { status: 400 });
  }

  let removed = 0;
  for (const factor of list?.factors ?? []) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ id: factor.id, userId: body.id });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    removed += 1;
  }

  return NextResponse.json({ ok: true, removed });
}
