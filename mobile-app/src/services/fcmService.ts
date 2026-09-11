/**
 * Serviço de Gerenciamento de Notificações Push (Firebase Cloud Messaging)
 */

export interface NotificationPayload {
  title: string;
  body: string;
  alertType: string;
  deviceId: string;
  timestamp: number;
}

type NotificationHandler = (payload: NotificationPayload) => void;

class FcmPushService {
  private fcmToken: string | null = null;
  private handlers: NotificationHandler[] = [];

  public async registerForPushNotifications(): Promise<string> {
    console.log('[FCM] Solicitando permissões de notificação push...');
    this.fcmToken = 'fcm_mobile_token_' + Math.random().toString(36).substring(7);
    console.log('[FCM] Token registrado:', this.fcmToken);
    return this.fcmToken;
  }

  public onNotificationReceived(handler: NotificationHandler) {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter(h => h !== handler);
    };
  }

  public simulateIncomingPush(payload: NotificationPayload) {
    this.handlers.forEach(h => h(payload));
  }
}

export const fcmService = new FcmPushService();
