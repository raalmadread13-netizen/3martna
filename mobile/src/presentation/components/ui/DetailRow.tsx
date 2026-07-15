import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

interface DetailRowProps {
  label: string;
  value: string | number | null | undefined;
}

/** Label/value line for details screens. Renders “—” for empty values. */
export const DetailRow = ({ label, value }: DetailRowProps): React.JSX.Element => {
  const { colors } = useTheme();
  const display = value === null || value === undefined || value === '' ? '—' : String(value);
  return (
    <View style={styles.row}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.value, { color: colors.text }]} numberOfLines={2}>
        {display}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
});
