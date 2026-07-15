import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

interface EmptyStateProps {
  title: string;
  hint?: string;
}

/** Friendly placeholder for empty lists. */
export const EmptyState = ({ title, hint }: EmptyStateProps): React.JSX.Element => {
  const { colors } = useTheme();
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  title: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, textAlign: 'center', paddingHorizontal: spacing.lg },
});
