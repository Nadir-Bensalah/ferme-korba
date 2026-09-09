const KEY = 'ferme-korba:admin:prefs:v1';

export interface Prefs {
  /** Son bref à chaque nouvelle commande. */
  sound: boolean;
  /** Notification système locale (API Notification du navigateur). */
  notifications: boolean;
}

const defaults: Prefs = { sound: true, notifications: false };

export function getPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...defaults };
    return { ...defaults, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return { ...defaults };
  }
}

export function setPrefs(patch: Partial<Prefs>): Prefs {
  const next = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* stockage indisponible : la préférence ne survit pas au rechargement */
  }
  return next;
}
