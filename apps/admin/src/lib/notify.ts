/**
 * Notifications système locales : gratuites, elles restent dans le navigateur.
 * La permission n'est demandée que depuis les réglages, jamais à l'ouverture.
 */
export type NotifState = NotificationPermission | 'unsupported';

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function notificationState(): NotifState {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission(): Promise<NotifState> {
  if (!notificationsSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function showLocalNotification(title: string, body: string, onClick?: () => void): void {
  if (notificationState() !== 'granted') return;
  try {
    const n = new Notification(title, { body, tag: 'ferme-korba-order', icon: `${import.meta.env.BASE_URL}logo-96.png` });
    if (onClick) {
      n.onclick = () => {
        window.focus();
        onClick();
        n.close();
      };
    }
  } catch {
    /* certains navigateurs mobiles exigent un service worker : on ignore */
  }
}
