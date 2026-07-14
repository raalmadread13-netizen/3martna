import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

export const WelcomeScreen = ({ navigation }: RootScreenProps<'Welcome'>): React.JSX.Element => {
  const { colors } = useTheme();

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={[styles.titleAr, { color: colors.accent }]}>عمارتنا</Text>
        <Text style={[styles.title, { color: colors.text }]}>Your building, in your pocket</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Rent, maintenance, visitors and community — one app for owners, tenants and staff.
        </Text>
      </View>
      <View style={styles.actions}>
        <AppButton title="Sign In" onPress={() => navigation.navigate('Login')} />
        <AppButton
          title="Create Account"
          variant="ghost"
          onPress={() => navigation.navigate('Register')}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  titleAr: { fontSize: 52, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  subtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.lg, lineHeight: 21 },
  actions: { paddingBottom: spacing.lg },
});
