import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

interface StatCardProps {
  label: string;
  value: number | string;
  /** Highlights the value (alerts, notable numbers). */
  accent?: boolean;
}

/** Compact statistics tile for the dashboard grid (two per row). */
export const StatCard = ({ label, value, accent = false }: StatCardProps): React.JSX.Element => {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.value, { color: accent ? colors.accent : colors.text }]}>{value}</Text>
      <Text style={[styles.label, { color: colors.textMuted }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexBasis: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 2,
  },
  value: { fontSize: 24, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '500' },
});
