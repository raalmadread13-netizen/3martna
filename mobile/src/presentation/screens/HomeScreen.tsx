import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

/** Empty home — dashboards land here in the feature sprints. */
export const HomeScreen = ({ navigation }: RootScreenProps<'Home'>): React.JSX.Element => {
  const { colors } = useTheme();

  return (
    <Screen>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>🏗️ Foundation ready</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          Sprint 1 delivered the architecture. Dashboards, rent, maintenance and visitor features
          arrive in the next sprints.
        </Text>
      </View>
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
  title: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 14, lineHeight: 21 },
});
