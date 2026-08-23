import { redirect } from 'next/navigation';

import { getOptionalUser } from '@/server/auth';

/** The root is a router, not a page: signed in goes to today, otherwise login. */
export default async function RootPage() {
  const user = await getOptionalUser();
  redirect(user ? '/today' : '/login');
}
