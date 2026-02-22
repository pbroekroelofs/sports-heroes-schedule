'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/lib/firebase';
import { useAuth } from '@/app/providers';

export default function NavBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
      <Link href="/" className="text-lg font-bold tracking-tight text-white">
        🏁 Schedule
      </Link>
      {user && (
        <nav className="flex items-center gap-4">
          <Link
            href="/settings"
            className={`text-sm ${pathname === '/settings' ? 'text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
          >
            Settings
          </Link>
          <button
            onClick={() => logout()}
            className="text-sm text-slate-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </nav>
      )}
    </header>
  );
}
