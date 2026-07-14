import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/presentation/components/ui/Screen';
import { radius, spacing } from '@/presentation/theme/colors';
import { ThemeMode, useTheme } from '@/presentation/theme/ThemeProvider';

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/** Settings — theme switching works today; more sections come with features. */
export const SettingsScreen = (): React.JSX.Element => {
  const { colors, mode, setMode } = useTheme();

  return (
    <Screen>
      <Text style={[styles.section, { color: colors.textMuted }]}>APPEARANCE</Text>
      <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {MODES.map((item, index) => {
          const selected = mode === item.value;
          return (
            <Pressable
              key={item.value}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setMode(item.value)}
              style={[
                styles.row,
                index < MODES.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.rowLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={{ color: selected ? colors.accent : colors.textMuted }}>
                {selected ? '●' : '○'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Language, notifications, security and account settings arrive with their feature sprints.
      </Text>
    </Screen>
  );
};

const styles = StyleSheet.create({
  section: { fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: spacing.sm },
  group: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
  },
  rowLabel: { fontSize: 16 },
  hint: { fontSize: 13, marginTop: spacing.lg, lineHeight: 19 },
});
