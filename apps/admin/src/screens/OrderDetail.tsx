import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, MessageCircle, Phone, Printer, Scale } from 'lucide-react';
import { formatPhone, formatPrice, formatQty, roundMillimes, type Order } from '@ferme/core';
import { source } from '@/lib/data';
import { useOrder, invalidateOrders, qk } from '@/lib/queries';
import { STATUS, fmtDateLong, fmtDateTime, imageUrl, mapsHref, orderAmount, telHref, waHref, whatsappMessage } from '@/lib/format';
import { useMutate } from '@/hooks/useMutate';
import { StatusBadge } from '@/components/StatusBadge';
import { OrderActions } from '@/components/OrderActions';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="card-flat p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function OrderDetail() {
  const { id = '' } = useParams();
  const order = useOrder(id);
  if (order.isPending) return <SkeletonRows rows={5} height={96} />;
  if (order.isError) return <ErrorState error={order.error} retry={() => void order.refetch()} />;
  if (!order.data)
    return (
      <EmptyState
        title="Commande introuvable"
        action={
          <Link to="/commandes" className="btn-ghost btn-sm">
            Retour aux commandes
          </Link>
        }
      />
    );
  return <Loaded order={order.data} />;
}

function Loaded({ order: o }: { order: Order }) {
  const qc = useQueryClient();
  const weighable = o.items.filter((it) => it.pricing.mode !== 'per_piece');
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState(o.notes ?? '');

  useEffect(() => {
    const init: Record<string, string> = {};
    for (const it of weighable) init[it.id] = it.weighed_kg != null ? String(it.weighed_kg) : '';
    setWeights(init);
    setNotes(o.notes ?? '');
    // Recharge les champs quand la commande change (nouvelle pesée enregistrée, autre commande).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.id, o.updated_at]);

  const refresh = (next: Order) => {
    qc.setQueryData(qk.order(o.id), next);
    invalidateOrders(qc);
  };
  const weigh = useMutate((lines: { item_id: string; weighed_kg: number | null }[]) => source.setWeighed(o.id, lines), { success: 'Pesée enregistrée', onSuccess: refresh });
  const saveNotes = useMutate((n: string) => source.updateOrderNotes(o.id, n), { success: 'Notes enregistrées', onSuccess: refresh });

  const parseKg = (s: string): number | null => {
    const v = Number(s.replace(',', '.'));
    return s.trim() === '' || !Number.isFinite(v) || v < 0 ? null : v;
  };
  const preview = roundMillimes(
    o.items.reduce((s, it) => {
      if (it.pricing.mode === 'per_piece') return s + it.line_total;
      const kg = parseKg(weights[it.id] ?? '');
      return s + (kg == null ? it.line_total : it.pricing.price_per_kg * kg);
    }, 0) + o.delivery_fee,
  );
  const weightsDirty = weighable.some((it) => (weights[it.id] ?? '') !== (it.weighed_kg != null ? String(it.weighed_kg) : ''));

  return (
    <div>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            <span className="tabular">{o.number}</span>
            <StatusBadge status={o.status} />
          </span>
        }
        subtitle={`Passée le ${fmtDateTime(o.created_at)} · ${o.lang === 'ar' ? 'client en arabe' : 'client en français'}`}
        back="/commandes"
        actions={
          <Link to={`/commandes/${o.id}/imprimer`} className="btn-ghost btn-sm">
            <Printer className="size-4" /> Imprimer le bon
          </Link>
        }
      />

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="caption text-xs font-semibold text-ink-3">À encaisser à la livraison</div>
            <div className="font-display text-2xl font-bold tabular">{formatPrice(orderAmount(o), 'fr')}</div>
            <div className="text-xs text-ink-3">{o.final_total != null ? 'Total après pesée' : 'Estimation, à ajuster à la pesée'}</div>
          </div>
          <OrderActions order={o} onDone={refresh} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Client">
          <div className="text-lg font-semibold">{o.customer.name}</div>
          {o.customer.email && <div className="text-sm text-ink-3">{o.customer.email}</div>}
          <div className="mt-3 flex flex-wrap gap-2">
            <a href={telHref(o.customer.phone)} className="btn-primary btn-sm">
              <Phone className="size-4" /> {formatPhone(o.customer.phone)}
            </a>
            <a href={waHref(o.customer.phone, whatsappMessage(o))} target="_blank" rel="noopener" className="btn-soft btn-sm">
              <MessageCircle className="size-4" /> WhatsApp
            </a>
          </div>
          <p className="help">WhatsApp s'ouvre avec le message de confirmation prérempli, vous appuyez sur envoyer.</p>
        </Section>

        <Section title="Livraison">
          <div className="font-semibold">{fmtDateLong(o.delivery_date)}</div>
          <div className="text-sm text-ink-2">
            {o.slot.label.fr}, {o.slot.from} à {o.slot.to}
          </div>
          <div className="mt-3 text-sm">
            <div className="font-semibold">{o.address.zone_name.fr}</div>
            <div>{o.address.street}</div>
            <div>{o.address.city}</div>
            {o.address.landmark && <div className="text-ink-3">Repère : {o.address.landmark}</div>}
          </div>
          <a href={mapsHref(o)} target="_blank" rel="noopener" className="btn-ghost btn-sm mt-3">
            <MapPin className="size-4" /> Ouvrir dans Google Maps
          </a>
        </Section>
      </div>

      <div className="mt-4">
        <Section
          title="Articles"
          aside={
            weighable.length > 0 ? (
              <span className="flex items-center gap-1 text-xs text-ink-3">
                <Scale className="size-3.5" /> {weighable.length} à peser
              </span>
            ) : undefined
          }
        >
          <ul className="divide-y divide-line">
            {o.items.map((it) => {
              const kg = parseKg(weights[it.id] ?? '');
              const lineFinal = it.pricing.mode !== 'per_piece' && kg != null ? roundMillimes(it.pricing.price_per_kg * kg) : null;
              return (
                <li key={it.id} className="flex flex-wrap items-center gap-3 py-3">
                  <img src={imageUrl(it.image)} alt="" className="size-14 shrink-0 rounded-md bg-cream object-cover" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{it.name.fr}</div>
                    <div className="text-sm text-ink-2">
                      {formatQty(it.pricing, it.qty, 'fr')}
                      {it.pricing.mode !== 'per_piece' && <span className="text-ink-3"> · {formatPrice(it.pricing.price_per_kg, 'fr')} / kg</span>}
                    </div>
                    <div className="text-sm">
                      Estimé : <span className="tabular">{formatPrice(it.line_total, 'fr')}</span>
                      {lineFinal != null && (
                        <span className="font-semibold">
                          {' '}
                          · Pesé : <span className="tabular">{formatPrice(lineFinal, 'fr')}</span>
                        </span>
                      )}
                    </div>
                  </div>
                  {it.pricing.mode !== 'per_piece' && (
                    <label className="w-full sm:w-40">
                      <span className="label">Poids pesé (kg)</span>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="field field-sm tabular"
                        placeholder={it.pricing.mode === 'per_kg' ? String(it.qty) : String(roundMillimes(it.pricing.est_weight_kg * it.qty))}
                        value={weights[it.id] ?? ''}
                        onChange={(e) => setWeights((w) => ({ ...w, [it.id]: e.target.value }))}
                      />
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
            <dt className="text-ink-3">Sous-total estimé</dt>
            <dd className="text-right tabular">{formatPrice(o.subtotal, 'fr')}</dd>
            <dt className="text-ink-3">Livraison</dt>
            <dd className="text-right tabular">{o.delivery_fee === 0 ? 'Offerte' : formatPrice(o.delivery_fee, 'fr')}</dd>
            <dt className="font-bold">Total estimé</dt>
            <dd className="text-right font-bold tabular">{formatPrice(o.total, 'fr')}</dd>
            {weighable.length > 0 && (
              <>
                <dt className="font-bold text-prairie-deep">Total après pesée</dt>
                <dd className="text-right font-bold tabular text-prairie-deep">{formatPrice(preview, 'fr')}</dd>
              </>
            )}
          </dl>
          {weighable.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={!weightsDirty || weigh.isPending}
                onClick={() => weigh.mutate(weighable.map((it) => ({ item_id: it.id, weighed_kg: parseKg(weights[it.id] ?? '') })))}
              >
                <Scale className="size-4" /> Enregistrer la pesée
              </button>
              {o.final_total != null && (
                <button type="button" className="btn-ghost btn-sm" disabled={weigh.isPending} onClick={() => weigh.mutate(weighable.map((it) => ({ item_id: it.id, weighed_kg: null })))}>
                  Effacer la pesée
                </button>
              )}
            </div>
          )}
        </Section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Section title="Notes">
          {o.notes && o.notes === (o.history.length ? o.notes : '') && null}
          <label className="block">
            <span className="label">Notes internes et remarques du client</span>
            <textarea className="field" rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
          </label>
          <button type="button" className="btn-ghost btn-sm mt-2" disabled={notes === (o.notes ?? '') || saveNotes.isPending} onClick={() => saveNotes.mutate(notes.trim())}>
            Enregistrer les notes
          </button>
        </Section>

        <Section title="Historique">
          <ol className="flex flex-col gap-2">
            {[...o.history].reverse().map((h, i) => (
              <li key={`${h.at}-${i}`} className="flex gap-3 text-sm">
                <span className={`mt-1.5 size-2.5 shrink-0 rounded-pill ${STATUS[h.status].dot}`} aria-hidden />
                <div>
                  <div className="font-semibold">{STATUS[h.status].label}</div>
                  <div className="text-xs text-ink-3">
                    {fmtDateTime(h.at)}
                    {h.by ? ` · ${h.by}` : ''}
                  </div>
                  {h.note && <div className="mt-0.5 text-ink-2">{h.note}</div>}
                </div>
              </li>
            ))}
          </ol>
        </Section>
      </div>
    </div>
  );
}
