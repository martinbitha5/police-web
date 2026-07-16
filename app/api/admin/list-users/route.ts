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
    .select('role')
    .eq('id', auth.user.id)
    .single<Pick<Profile, 'role'>>();

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Associe l'email de chaque profil (l'email vit dans auth.users, pas dans profiles).
  const emailById = new Map<string, string | null>();
  try {
    const { data: authList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of authList?.users ?? []) emailById.set(u.id, u.email ?? null);
  } catch {
    // si l'inventaire auth échoue, on renvoie quand même les profils sans email
  }

  const users = ((data ?? []) as Profile[]).map((p) => ({
    ...p,
    email: emailById.get(p.id) ?? null,
  }));

  return NextResponse.json({ users });
}
