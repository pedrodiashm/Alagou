import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DEFAULT_CHANNEL_ID = 'alerts';

export const NOTIFICATION_NEARBY_RADIUS_METERS = 1000;

/**
 * Configura o comportamento das notificações (mostrar banner/lista em foreground)
 * e cria o canal do Android (obrigatório para o prompt de permissão no Android 13+).
 */
export async function configureNotifications() {
  if (Platform.OS === 'web') return;

  const Notifications = await import('expo-notifications');

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
      name: 'Alertas de alagamento próximos',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#208AEF',
    });
  }
}

/**
 * Pede permissão e obtém o token do Expo Push Service para o aparelho.
 * Retorna null no web ou quando o usuário nega / projectId não configurado.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const Notifications = await import('expo-notifications');

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('[Notifications] Permissão negada. Alerta de proximidade desativado.');
    return null;
  }

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    if (!projectId) {
      console.warn('[Notifications] projectId ausente. Rode "npx eas-cli init" para habilitar push.');
      return null;
    }
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  } catch (e: any) {
    console.warn('[Notifications] Falha ao obter push token:', e?.message || e);
    return null;
  }
}