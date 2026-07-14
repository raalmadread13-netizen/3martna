import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { Screen } from '@/presentation/components/ui/Screen';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

/**
 * Profile placeholder — shows the authenticated identity and owns the
 * logout flow. Editing, avatar upload and verification actions arrive
 * in the profile feature sprint.
 */
export const ProfileScreen = (): React.JSX.Element => {
  const { colors } = useTheme();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async (): Promise<void> => {
    setLoggingOut(true);
    await logout(); // flips the navigator back to the guest stack
  };

  if (!user) return <Screen>{null}</Screen>;

  const rows: Array<[string, string]> = [
    ['Name', `${user.firstName} ${user.lastName}`],
    ['Phone', `${user.phoneNumber} ${user.phoneVerified ? '✓' : '(unverified)'}`],
    ['Email', user.email ? `${user.email} ${user.emailVerified ? '✓' : '(unverified)'}` : '—'],
    ['Language', user.preferredLanguage === 'ar' ? 'العربية' : 'English'],
    ['Roles', user.roles.join(', ') || '—'],
  ];

  return (
    <Screen scroll>
      <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
        <Text style={[styles.avatarText, { color: colors.onPrimary }]}>
          {user.firstName.charAt(0)}
          {user.lastName.charAt(0)}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {rows.map(([label, value], index) => (
          <View
            key={label}
            style={[
              styles.row,
              index < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
            ]}
          >
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>{label}</Text>
            <Text style={[styles.rowValue, { color: colors.text }]} numberOfLines={1}>
              {value}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Profile editing and verification arrive in an upcoming sprint.
      </Text>

      <AppButton
        title="Sign Out"
        variant="secondary"
        onPress={() => void handleLogout()}
        loading={loggingOut}
      />
    </Screen>
  );
};

const styles = StyleSheet.create({
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.lg,
  },
  avatarText: { fontSize: 30, fontWeight: '700' },
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden', marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  rowLabel: { fontSize: 13, fontWeight: '600' },
  rowValue: { fontSize: 15, flexShrink: 1, textAlign: 'right' },
  hint: { fontSize: 13, marginBottom: spacing.md, textAlign: 'center' },
});
