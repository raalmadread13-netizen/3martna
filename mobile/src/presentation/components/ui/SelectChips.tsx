import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

export interface ChipOption {
  label: string;
  value: string;
}

interface SelectChipsProps {
  label: string;
  options: ChipOption[];
  selected: string | null;
  onSelect: (value: string) => void;
  disabled?: boolean;
}

/** Compact single-select chip row (floors, statuses, owners…). */
export const SelectChips = ({
  label,
  options,
  selected,
  onSelect,
  disabled = false,
}: SelectChipsProps): React.JSX.Element => {
  const { colors } = useTheme();
  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
              disabled={disabled}
              onPress={() => onSelect(option.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.surfaceMuted,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[styles.chipText, { color: active ? colors.onPrimary : colors.text }]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: '500', marginBottom: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  chipText: { fontSize: 13, fontWeight: '500' },
});
