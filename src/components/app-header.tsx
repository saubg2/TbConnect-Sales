'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const links = [
  { href: '/', label: 'Overview' },
  { href: '/contacts', label: 'CRM' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/actions', label: 'Actions' },
  { href: '/agents', label: 'Agents' },
  { href: '/settings', label: 'Settings' },
];

export function AppHeader({ actions }: { actions?: ReactNode }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b-2 border-black bg-white px-5">
      <div className="flex h-full items-center">
        <Link href="/" className="mr-8 text-sm font-black tracking-[-0.02em] text-black">
          TBCONNECT
        </Link>
        <nav className="flex h-full items-center">
          {links.map((link) => {
            const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex h-full items-center border-x border-transparent px-4 text-xs font-bold transition ${
                  active ? 'border-black bg-black text-white' : 'text-black hover:bg-neutral-100'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
