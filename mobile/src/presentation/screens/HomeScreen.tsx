import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { hasPermission } from '@/shared/utils/permissions';

/** Home hub — module entry points appear as their sprints land. */
export const HomeScreen = ({ navigation }: RootScreenProps<'Home'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();

  const canSeeDashboard = hasPermission(user, 'dashboard.read');
  const canSeeBuildings = hasPermission(user, 'buildings.read');
  const canSeeApartments = hasPermission(user, 'apartments.read');
  const canSeeOwners = hasPermission(user, 'owners.read');
  const canSeeResidents = hasPermission(user, 'residents.read');
  const canSeeLeases = hasPermission(user, 'leases.read');
  const canSeeOccupancy = hasPermission(user, 'occupancy.read');

  return (
    <Screen scroll>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>أهلاً {user?.firstName} 👋</Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          You're signed in as {user?.roles.join(', ')}. Rent, maintenance and visitor features
          arrive in the next sprints.
        </Text>
      </View>

      {canSeeDashboard ? (
        <AppButton title="Dashboard" onPress={() => navigation.navigate('Dashboard')} />
      ) : null}
      {canSeeBuildings ? (
        <AppButton title="Buildings" onPress={() => navigation.navigate('Buildings')} />
      ) : null}
      {canSeeApartments ? (
        <AppButton title="Apartments" onPress={() => navigation.navigate('Apartments')} />
      ) : null}
      {canSeeOwners ? (
        <AppButton title="Owners" onPress={() => navigation.navigate('Owners')} />
      ) : null}
      {canSeeResidents ? (
        <AppButton title="Residents" onPress={() => navigation.navigate('Residents')} />
      ) : null}
      {canSeeLeases ? (
        <AppButton title="Leases" onPress={() => navigation.navigate('Leases')} />
      ) : null}
      {canSeeOccupancy ? (
        <AppButton title="Occupancy" onPress={() => navigation.navigate('OccupancyHistory')} />
      ) : null}

      <AppButton
        title="Profile"
        variant="secondary"
        onPress={() => navigation.navigate('Profile')}
      />
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
