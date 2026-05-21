import { redirect } from 'next/navigation';

/**
 * Root index redirects to /live. The ops shell lives under (ops) so it can
 * apply Header + TabStrip + Drawer consistently across /live and /archive
 * without duplicating layout code.
 */
export default function IndexPage() {
  redirect('/live');
}
