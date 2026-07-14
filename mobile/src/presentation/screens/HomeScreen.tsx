import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

/** Empty home — dashboards land here in the feature sprints. */
export const HomeScreen = ({ navigation }: RootScreenProps<'Home'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();

  return (
    <Screen>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>أهلاً {user?.firstName} 👋</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          You're signed in as {user?.roles.join(', ')}. Dashboards, rent, maintenance and visitor
          features arrive in the next sprints.
        </Text>
      </View>
      <AppButton title="Profile" onPress={() => navigation.navigate('Profile')} />
      <AppButton
        title="Settings"
        variant="secondary"
        onPress={() => navigation.navigate('Settings')}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  title: { fontSize: 20, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 21 },
});
