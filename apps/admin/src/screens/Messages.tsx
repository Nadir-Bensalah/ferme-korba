import { Check, Phone } from 'lucide-react';
import { formatPhone } from '@ferme/core';
import { source } from '@/lib/data';
import { qk, useMessages } from '@/lib/queries';
import { fmtDateTime, telHref } from '@/lib/format';
import { useMutate } from '@/hooks/useMutate';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';

export function Messages() {
  const messages = useMessages();
  const markRead = useMutate((id: string) => source.markContactRead(id), { invalidate: [qk.messages] });
  const unread = messages.data?.filter((m) => !m.read).length ?? 0;

  return (
    <div>
      <PageHeader title="Messages" subtitle={messages.data ? (unread > 0 ? `${unread} non lu${unread > 1 ? 's' : ''}` : 'Tout est lu') : undefined} />
      {messages.isPending ? (
        <SkeletonRows rows={4} height={96} />
      ) : messages.isError ? (
        <ErrorState error={messages.error} retry={() => void messages.refetch()} />
      ) : messages.data.length === 0 ? (
        <EmptyState title="Aucun message" hint="Les messages du formulaire de contact arrivent ici." />
      ) : (
        <ul className="flex flex-col gap-2">
          {[...messages.data].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((m) => (
            <li key={m.id} className={`card-flat p-3 ${m.read ? 'opacity-75' : 'border-yolk bg-yolk-soft/30'}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">
                    {m.name}
                    {!m.read && <span className="chip ml-2 bg-yolk text-ink">Nouveau</span>}
                  </div>
                  <div className="text-xs text-ink-3">{fmtDateTime(m.created_at)}</div>
                </div>
                <div className="flex gap-2">
                  <a href={telHref(m.phone)} className="btn-soft btn-sm">
                    <Phone className="size-4" /> {formatPhone(m.phone)}
                  </a>
                  {!m.read && (
                    <button type="button" className="btn-ghost btn-sm" onClick={() => markRead.mutate(m.id)} disabled={markRead.isPending}>
                      <Check className="size-4" /> Lu
                    </button>
                  )}
                </div>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-ink-2">{m.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
