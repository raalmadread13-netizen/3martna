import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { palette, spacing } from '@/presentation/theme/colors';

/** Brand splash shown while the session is being restored. */
export const SplashScreen = (): React.JSX.Element => (
  <View style={styles.container}>
    <Text style={styles.logoAr}>عمارتنا</Text>
    <Text style={styles.logoEn}>3martna</Text>
    <ActivityIndicator color={palette.gold500} style={styles.spinner} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.navy900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoAr: { color: palette.gold500, fontSize: 44, fontWeight: '700' },
  logoEn: { color: palette.slate400, fontSize: 18, marginTop: spacing.sm, letterSpacing: 4 },
  spinner: { marginTop: spacing.xl },
});
