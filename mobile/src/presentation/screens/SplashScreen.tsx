import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppBootstrap } from '@/application/hooks/useAppBootstrap';
import { RootScreenProps } from '@/presentation/navigation/types';
import { palette, spacing } from '@/presentation/theme/colors';

/** Brand splash — waits for bootstrap, then hands off to Welcome. */
export const SplashScreen = ({ navigation }: RootScreenProps<'Splash'>): React.JSX.Element => {
  const { isReady } = useAppBootstrap();

  useEffect(() => {
    if (isReady) navigation.replace('Welcome');
  }, [isReady, navigation]);

  return (
    <View style={styles.container}>
      <Text style={styles.logoAr}>عمارتنا</Text>
      <Text style={styles.logoEn}>3martna</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.navy900,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoAr: { color: palette.gold500, fontSize: 44, fontWeight: '700' },
  logoEn: { color: palette.slate400, fontSize: 18, marginTop: spacing.sm, letterSpacing: 4 },
});
