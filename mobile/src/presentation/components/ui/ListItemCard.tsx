import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

interface ListItemCardProps {
  title: string;
  subtitle?: string | null;
  badge?: string | null;
  onPress?: () => void;
}

/** Tappable card used by the module list screens (design-system tokens only). */
export const ListItemCard = ({
  title,
  subtitle,
  badge,
  onPress,
}: ListItemCardProps): React.JSX.Element => {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.badgeText, { color: colors.accent }]}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  textBlock: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 13, lineHeight: 18 },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
});
