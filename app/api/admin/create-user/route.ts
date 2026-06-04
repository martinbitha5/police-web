import { NextResponse, type NextRequest } from 'next/server';
import type { Profile, UserRole } from '@police/shared';
import { createClient } from '@/supabase/server';
import { createAdminClient } from '@/supabase/admin';

interface Body {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  gate?: string;
}

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

  const body = (await request.json()) as Body;
  if (!body.email || !body.password || !body.full_name || !body.role) {
    return NextResponse.json({ error: 'email, password, full_name et role sont requis' }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: body.email,
    password: body.password,
    email_confirm: true,
    user_metadata: { full_name: body.full_name, role: body.role, gate: body.gate ?? null },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ id: data.user?.id });
}
