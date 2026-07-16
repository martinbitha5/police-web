import { NextResponse, type NextRequest } from 'next/server';
import type { Profile } from '@police/shared';
import { createClient } from '@/supabase/server';
import { createAdminClient } from '@/supabase/admin';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', auth.user.id)
    .single<Pick<Profile, 'role'>>();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 });
  }

  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: 'id requis' }, { status: 400 });
  }
  if (body.id === auth.user.id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' }, { status: 400 });
  }

  const admin = createAdminClient();

  // Supprime le compte d'authentification (supprime la ligne profiles si la
  // contrainte est en ON DELETE CASCADE).
  const { error } = await admin.auth.admin.deleteUser(body.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Filet de sécurité : retire la ligne profiles si aucune cascade n'existe.
  await admin.from('profiles').delete().eq('id', body.id);

  return NextResponse.json({ ok: true });
}
