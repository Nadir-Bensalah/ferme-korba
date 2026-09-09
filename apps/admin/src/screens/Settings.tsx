import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, RefreshCw, Volume2 } from 'lucide-react';
import { resetDemo, type Settings as ShopSettings } from '@ferme/core';
import { isDemo, source } from '@/lib/data';
import { qk, useSettings } from '@/lib/queries';
import { DAY_LABELS } from '@/lib/format';
import { getPrefs, setPrefs, type Prefs } from '@/lib/prefs';
import { playChime, audioReady } from '@/lib/sound';
import { notificationState, requestNotificationPermission, showLocalNotification, type NotifState } from '@/lib/notify';
import { useMutate } from '@/hooks/useMutate';
import { useConfirm } from '@/hooks/useConfirm';
import { useToast } from '@/hooks/useToast';
import { useAuth } from '@/hooks/useAuth';
import { Checkbox, Input, LocalizedField, Toggle } from '@/components/Field';
import { ErrorState, SkeletonRows } from '@/components/States';
import { PageHeader } from '@/components/PageHeader';

export function SettingsScreen() {
  const settings = useSettings();
  if (settings.isPending) return <SkeletonRows rows={6} />;
  if (settings.isError) return <ErrorState error={settings.error} retry={() => void settings.refetch()} />;
  return <Form key={settings.data.updated_at ?? 'init'} initial={settings.data} />;
}

function Form({ initial }: { initial: ShopSettings }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { logout } = useAuth();
  const [s, setS] = useState<ShopSettings>(structuredClone(initial));
  const [minOrder, setMinOrder] = useState(String(initial.min_order));
  const [prefs, setPrefsState] = useState<Prefs>(getPrefs());
  const [notif, setNotif] = useState<NotifState>(notificationState());
  useEffect(() => setNotif(notificationState()), []);

  const save = useMutate((x: ShopSettings) => source.saveSettings(x), { invalidate: [qk.settings], success: 'Réglages enregistrés' });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const min = Number(minOrder.replace(',', '.'));
    save.mutate({ ...s, min_order: Number.isFinite(min) && min >= 0 ? min : 0, max_days_ahead: Math.max(0, Math.round(s.max_days_ahead)) });
  };

  const updatePrefs = (patch: Partial<Prefs>) => setPrefsState(setPrefs(patch));

  const testSound = () => {
    if (!playChime()) toast.info('Son bloqué', audioReady() ? 'Réessayez.' : 'Touchez la page une fois, puis réessayez.');
  };

  const enableNotifications = async () => {
    const state = await requestNotificationPermission();
    setNotif(state);
    if (state === 'granted') {
      updatePrefs({ notifications: true });
      showLocalNotification('Notifications activées', 'Vous serez prévenue à chaque nouvelle commande.');
    } else if (state === 'denied') toast.error('Refusé par le navigateur', 'Autorisez les notifications dans les réglages du site.');
  };

  const reset = async () => {
    const r = await confirm({ title: 'Réinitialiser la démo ?', message: 'Toutes les commandes, produits et réglages de ce navigateur repartent du jeu de départ. Vous serez déconnectée.', confirmLabel: 'Réinitialiser', danger: true });
    if (!r.ok) return;
    resetDemo();
    qc.clear();
    await logout();
    toast.success('Démo réinitialisée');
  };

  return (
    <form onSubmit={submit} noValidate>
      <PageHeader title="Réglages" />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card-flat flex flex-col gap-4 p-4">
          <h2 className="text-base font-bold">Boutique</h2>
          <Toggle label={s.shop_open ? 'Boutique ouverte' : 'Boutique fermée'} help="Fermée : les clients voient le site mais ne peuvent pas commander" checked={s.shop_open} onChange={(v) => setS({ ...s, shop_open: v })} />
          <LocalizedField label="Annonce en bandeau" value={s.announcement} onChange={(v) => setS({ ...s, announcement: v })} multiline rows={2} />
          <p className="help -mt-2">Vide : pas de bandeau. Exemple : « Fermé le 12 septembre ».</p>
        </section>

        <section className="card-flat flex flex-col gap-4 p-4">
          <h2 className="text-base font-bold">Commandes</h2>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Minimum de commande (DT)" inputMode="decimal" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
            <Input label="Jours à l'avance" inputMode="numeric" value={String(s.max_days_ahead)} onChange={(e) => setS({ ...s, max_days_ahead: Number(e.target.value) || 0 })} help="Jusqu'où le client peut choisir sa date" />
            <Input label="Heure limite" type="time" value={s.cutoff_time} onChange={(e) => setS({ ...s, cutoff_time: e.target.value })} help="Après, livraison au plus tôt le lendemain" />
          </div>
          <fieldset>
            <legend className="label">Jours fermés</legend>
            <div className="grid grid-cols-2 sm:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <Checkbox key={d} label={DAY_LABELS[d]} checked={s.closed_days.includes(d)} onChange={(v) => setS({ ...s, closed_days: v ? [...new Set([...s.closed_days, d])].sort() : s.closed_days.filter((x) => x !== d) })} />
              ))}
            </div>
          </fieldset>
        </section>

        <section className="card-flat flex flex-col gap-3 p-4">
          <h2 className="text-base font-bold">Alertes de commande</h2>
          <p className="text-sm text-ink-2">L'alerte s'affiche dans cet espace, gratuitement. Gardez l'onglet ouvert.</p>
          <Toggle label="Son à chaque nouvelle commande" help="Deux notes brèves" checked={prefs.sound} onChange={(v) => updatePrefs({ sound: v })} />
          <button type="button" className="btn-ghost btn-sm self-start" onClick={testSound}>
            <Volume2 className="size-4" /> Tester le son
          </button>
          <div className="mt-2 border-t border-line pt-3">
            {notif === 'unsupported' ? (
              <p className="text-sm text-ink-3">Ce navigateur ne propose pas de notifications.</p>
            ) : notif === 'granted' ? (
              <Toggle label="Notification du navigateur" help="Même si vous êtes sur un autre onglet" checked={prefs.notifications} onChange={(v) => updatePrefs({ notifications: v })} />
            ) : (
              <>
                <p className="text-sm text-ink-2">Recevez aussi une notification du navigateur, même sur un autre onglet.</p>
                <button type="button" className="btn-soft btn-sm mt-2" onClick={() => void enableNotifications()} disabled={notif === 'denied'}>
                  <Bell className="size-4" /> {notif === 'denied' ? 'Refusées par le navigateur' : 'Activer les notifications'}
                </button>
              </>
            )}
          </div>
        </section>

        {isDemo && (
          <section className="card-flat flex flex-col gap-3 border-yolk bg-yolk-soft/30 p-4">
            <h2 className="text-base font-bold">Mode démo</h2>
            <p className="text-sm text-ink-2">Aucune base n'est branchée : tout vit dans ce navigateur.</p>
            <button type="button" className="btn-ghost btn-sm self-start" onClick={() => void reset()}>
              <RefreshCw className="size-4" /> Réinitialiser la démo
            </button>
          </section>
        )}
      </div>

      <div className="sticky bottom-[calc(var(--bottom-bar-h)+env(safe-area-inset-bottom))] mt-4 flex justify-end gap-2 border-t border-line bg-cream/95 py-3 backdrop-blur md:bottom-0">
        <button type="submit" className="btn-primary" disabled={save.isPending}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer les réglages'}
        </button>
      </div>
    </form>
  );
}
