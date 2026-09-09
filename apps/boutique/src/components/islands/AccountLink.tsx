import { useEffect, useState } from 'react';
import type { Lang } from '@ferme/core';
import { auth } from '@/lib/data';

interface Props {
  lang: Lang;
  href: string;
  label: string;
}

/** Lien « Mon compte » du haut de page : affiche le prénom quand on est connecté. */
export default function AccountLink({ href, label }: Props) {
  const [name, setName] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    auth()
      .currentUser()
      .then((u) => alive && setName(u?.name ?? null))
      .catch(() => {});
    const off = auth().onAuthChange((u) => setName(u?.name ?? null));
    return () => {
      alive = false;
      off();
    };
  }, []);
  const first = name?.split(' ')[0];
  return (
    <a href={href} className="hidden items-center gap-2 rounded-pill px-3 py-2 text-sm font-semibold text-ink-2 hover:bg-cream hover:text-ink lg:inline-flex" aria-label={label}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </svg>
      {first ? <span className="max-w-24 truncate">{first}</span> : null}
    </a>
  );
}
