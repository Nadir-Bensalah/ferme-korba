import { useState, type FormEvent } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { formatPrice, type DeliverySlot, type DeliveryZone } from '@ferme/core';
import { source } from '@/lib/data';
import { qk, useSlots, useZones } from '@/lib/queries';
import { DAY_LABELS, newId } from '@/lib/format';
import { useMutate } from '@/hooks/useMutate';
import { useConfirm } from '@/hooks/useConfirm';
import { Checkbox, Input, LocalizedField, Toggle } from '@/components/Field';
import { Modal } from '@/components/Modal';
import { EmptyState, ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';

const blankZone = (): DeliveryZone => ({ id: newId(), name: { fr: '', ar: '' }, areas: { fr: '', ar: '' }, fee: 5, free_from: 0, lead_days: 1, active: true, sort: 10 });
const blankSlot = (): DeliverySlot => ({ id: newId(), label: { fr: '', ar: '' }, from: '09:00', to: '12:00', days: [1, 2, 3, 4, 5, 6], active: true, sort: 10 });

const n = (v: string, d = 0) => {
  const x = Number(v.replace(',', '.'));
  return Number.isFinite(x) ? x : d;
};

export function Delivery() {
  const zones = useZones();
  const slots = useSlots();
  const confirm = useConfirm();
  const [zone, setZone] = useState<DeliveryZone | null>(null);
  const [slot, setSlot] = useState<DeliverySlot | null>(null);

  const saveZone = useMutate((z: DeliveryZone) => source.upsertZone(z), { invalidate: [qk.zones], success: 'Zone enregistrée', onSuccess: () => setZone(null) });
  const delZone = useMutate((id: string) => source.deleteZone(id), { invalidate: [qk.zones], success: 'Zone supprimée' });
  const saveSlot = useMutate((s: DeliverySlot) => source.upsertSlot(s), { invalidate: [qk.slots], success: 'Créneau enregistré', onSuccess: () => setSlot(null) });
  const delSlot = useMutate((id: string) => source.deleteSlot(id), { invalidate: [qk.slots], success: 'Créneau supprimé' });

  const removeZone = async (z: DeliveryZone) => {
    const r = await confirm({ title: `Supprimer la zone « ${z.name.fr} » ?`, message: 'Désactivez-la plutôt si des clients y habitent.', confirmLabel: 'Supprimer', danger: true });
    if (r.ok) delZone.mutate(z.id);
  };
  const removeSlot = async (s: DeliverySlot) => {
    const r = await confirm({ title: `Supprimer le créneau « ${s.label.fr} » ?`, confirmLabel: 'Supprimer', danger: true });
    if (r.ok) delSlot.mutate(s.id);
  };

  return (
    <div>
      <PageHeader title="Livraison" subtitle="Zones desservies et créneaux proposés à la commande" />

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold">Zones</h2>
          <button type="button" className="btn-primary btn-sm" onClick={() => setZone(blankZone())}>
            <Plus className="size-4" /> Zone
          </button>
        </div>
        {zones.isPending ? (
          <SkeletonRows rows={3} />
        ) : zones.isError ? (
          <ErrorState error={zones.error} retry={() => void zones.refetch()} />
        ) : zones.data.length === 0 ? (
          <EmptyState title="Aucune zone" hint="Sans zone, personne ne peut commander." />
        ) : (
          <ul className="flex flex-col gap-2">
            {zones.data.map((z) => (
              <li key={z.id} className={`card-flat flex items-center gap-3 p-3 ${z.active ? '' : 'opacity-60'}`}>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setZone(z)}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{z.name.fr}</span>
                    {!z.active && <span className="chip bg-line text-ink-3">Inactive</span>}
                  </div>
                  <div className="truncate text-sm text-ink-3">{z.areas.fr}</div>
                  <div className="text-xs text-ink-2">
                    {formatPrice(z.fee, 'fr')}
                    {z.free_from > 0 ? `, offerte dès ${formatPrice(z.free_from, 'fr')}` : ''} · {z.lead_days === 0 ? 'le jour même' : `${z.lead_days} jour${z.lead_days > 1 ? 's' : ''} de délai`} · ordre {z.sort}
                  </div>
                </button>
                <button type="button" className="btn-ghost btn-icon size-10" aria-label="Modifier" onClick={() => setZone(z)}>
                  <Pencil className="size-4" />
                </button>
                <button type="button" className="btn-ghost btn-icon size-10 text-paprika" aria-label="Supprimer" onClick={() => void removeZone(z)}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold">Créneaux</h2>
          <button type="button" className="btn-primary btn-sm" onClick={() => setSlot(blankSlot())}>
            <Plus className="size-4" /> Créneau
          </button>
        </div>
        {slots.isPending ? (
          <SkeletonRows rows={3} />
        ) : slots.isError ? (
          <ErrorState error={slots.error} retry={() => void slots.refetch()} />
        ) : slots.data.length === 0 ? (
          <EmptyState title="Aucun créneau" hint="Sans créneau, personne ne peut commander." />
        ) : (
          <ul className="flex flex-col gap-2">
            {slots.data.map((s) => (
              <li key={s.id} className={`card-flat flex items-center gap-3 p-3 ${s.active ? '' : 'opacity-60'}`}>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setSlot(s)}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{s.label.fr}</span>
                    <span className="text-sm text-ink-2 tabular">
                      {s.from} à {s.to}
                    </span>
                    {!s.active && <span className="chip bg-line text-ink-3">Inactif</span>}
                  </div>
                  <div className="text-xs text-ink-3">
                    {[1, 2, 3, 4, 5, 6, 0].filter((d) => s.days.includes(d)).map((d) => DAY_LABELS[d]).join(', ') || 'Aucun jour'} · ordre {s.sort}
                  </div>
                </button>
                <button type="button" className="btn-ghost btn-icon size-10" aria-label="Modifier" onClick={() => setSlot(s)}>
                  <Pencil className="size-4" />
                </button>
                <button type="button" className="btn-ghost btn-icon size-10 text-paprika" aria-label="Supprimer" onClick={() => void removeSlot(s)}>
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {zone && <ZoneModal initial={zone} onClose={() => setZone(null)} onSave={(z) => saveZone.mutate(z)} busy={saveZone.isPending} />}
      {slot && <SlotModal initial={slot} onClose={() => setSlot(null)} onSave={(s) => saveSlot.mutate(s)} busy={saveSlot.isPending} />}
    </div>
  );
}

function ZoneModal({ initial, onClose, onSave, busy }: { initial: DeliveryZone; onClose: () => void; onSave: (z: DeliveryZone) => void; busy: boolean }) {
  const [z, setZ] = useState(initial);
  const [fee, setFee] = useState(String(initial.fee));
  const [free, setFree] = useState(String(initial.free_from));
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!z.name.fr.trim() || !z.name.ar.trim()) return setErr('Le nom est obligatoire en français et en arabe.');
    onSave({ ...z, fee: n(fee), free_from: n(free), lead_days: Math.max(0, Math.round(z.lead_days)) });
  };
  return (
    <Modal
      title={initial.name.fr ? 'Modifier la zone' : 'Nouvelle zone'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" form="zone-form" className="btn-primary" disabled={busy}>
            Enregistrer
          </button>
        </>
      }
    >
      <form id="zone-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <LocalizedField label="Nom" value={z.name} onChange={(v) => setZ({ ...z, name: v })} required />
        <LocalizedField label="Villes et quartiers" value={z.areas} onChange={(v) => setZ({ ...z, areas: v })} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Frais (DT)" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
          <Input label="Offerte dès (DT)" inputMode="decimal" value={free} onChange={(e) => setFree(e.target.value)} help="0 : jamais" />
          <Input label="Délai (jours)" inputMode="numeric" value={String(z.lead_days)} onChange={(e) => setZ({ ...z, lead_days: Number(e.target.value) || 0 })} help="0 : le jour même" />
          <Input label="Ordre" inputMode="numeric" value={String(z.sort)} onChange={(e) => setZ({ ...z, sort: Number(e.target.value) || 0 })} />
        </div>
        <Toggle label="Zone active" help="Inactive : elle n'est plus proposée à la commande" checked={z.active} onChange={(v) => setZ({ ...z, active: v })} />
        {err && <p className="error">{err}</p>}
      </form>
    </Modal>
  );
}

function SlotModal({ initial, onClose, onSave, busy }: { initial: DeliverySlot; onClose: () => void; onSave: (s: DeliverySlot) => void; busy: boolean }) {
  const [s, setS] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!s.label.fr.trim() || !s.label.ar.trim()) return setErr('Le libellé est obligatoire en français et en arabe.');
    if (!s.from || !s.to || s.from >= s.to) return setErr('L’heure de fin doit suivre l’heure de début.');
    if (s.days.length === 0) return setErr('Cochez au moins un jour.');
    onSave(s);
  };
  const toggleDay = (d: number, on: boolean) => setS({ ...s, days: on ? [...new Set([...s.days, d])].sort() : s.days.filter((x) => x !== d) });
  return (
    <Modal
      title={initial.label.fr ? 'Modifier le créneau' : 'Nouveau créneau'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button type="submit" form="slot-form" className="btn-primary" disabled={busy}>
            Enregistrer
          </button>
        </>
      }
    >
      <form id="slot-form" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <LocalizedField label="Libellé" value={s.label} onChange={(v) => setS({ ...s, label: v })} required />
        <div className="grid grid-cols-3 gap-3">
          <Input label="Début" type="time" value={s.from} onChange={(e) => setS({ ...s, from: e.target.value })} />
          <Input label="Fin" type="time" value={s.to} onChange={(e) => setS({ ...s, to: e.target.value })} />
          <Input label="Ordre" inputMode="numeric" value={String(s.sort)} onChange={(e) => setS({ ...s, sort: Number(e.target.value) || 0 })} />
        </div>
        <fieldset>
          <legend className="label">Jours</legend>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <Checkbox key={d} label={DAY_LABELS[d]} checked={s.days.includes(d)} onChange={(v) => toggleDay(d, v)} />
            ))}
          </div>
        </fieldset>
        <Toggle label="Créneau actif" checked={s.active} onChange={(v) => setS({ ...s, active: v })} />
        {err && <p className="error">{err}</p>}
      </form>
    </Modal>
  );
}
