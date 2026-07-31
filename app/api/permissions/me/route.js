import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/serverAuth';
import { permissionsForRole } from '../../../../lib/permissions';

// Any logged-in user can read their own resolved permissions — used by the
// Topbar to decide which nav links to show.
export async function GET() {
  const user = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const perms = await permissionsForRole(user.role);
  return NextResponse.json({ role: user.role, perms });
}
