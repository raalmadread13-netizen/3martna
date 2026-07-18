import * as Notifications from 'expo-notifications';

/**
 * Push-notification plumbing (Expo + FCM/APNs), prepared for later sprints.
 * Feature code will call registerForPushNotifications() after login and
 * send the token to the backend.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const registerForPushNotifications = async (): Promise<string | null> => {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;
  if (existingStatus !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return null;

  const token = await Notifications.getDevicePushTokenAsync();
  return typeof token.data === 'string' ? token.data : null;
};
