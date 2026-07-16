import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/application/auth/AuthContext';
import {
  BuildingSummary,
  DashboardSummary,
  LeaseAlerts,
  RecentActivity,
} from '@/domain/entities/Dashboard';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { dashboardApi } from '@/infrastructure/api/dashboardApi';
import { EmptyState } from '@/presentation/components/ui/EmptyState';
import { ListItemCard } from '@/presentation/components/ui/ListItemCard';
import { StatCard } from '@/presentation/components/ui/StatCard';
import { RootScreenProps } from '@/presentation/navigation/types';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { hasPermission } from '@/shared/utils/permissions';

interface QuickAction {
  label: string;
  permission: string;
  onPress: () => void;
}

/**
 * Dashboard Home — the pilot's landing view. One pull-to-refresh screen
 * that answers "what is the state of my buildings right now?".
 */
export const DashboardScreen = ({
  navigation,
}: RootScreenProps<'Dashboard'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [buildings, setBuildings] = useState<BuildingSummary[]>([]);
  const [alerts, setAlerts] = useState<LeaseAlerts | null>(null);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh'): Promise<void> => {
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const [summaryData, buildingData, alertData, activityData] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.buildings(),
        dashboardApi.leaseAlerts(),
        dashboardApi.activity(15),
      ]);
      setSummary(summaryData);
      setBuildings(buildingData);
      setAlerts(alertData);
      setActivity(activityData);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(
    () => navigation.addListener('focus', () => void loadRef.current('initial')),
    [navigation],
  );

  const quickActions: QuickAction[] = [
    {
      label: '+ Building',
      permission: 'buildings.manage',
      onPress: () => navigation.navigate('BuildingForm', {}),
    },
    {
      label: '+ Apartment',
      permission: 'apartments.manage',
      onPress: () => navigation.navigate('ApartmentForm', {}),
    },
    {
      label: '+ Resident',
      permission: 'residents.manage',
      onPress: () => navigation.navigate('ResidentForm', {}),
    },
    {
      label: '+ Lease',
      permission: 'leases.manage',
      onPress: () => navigation.navigate('LeaseForm', {}),
    },
    {
      label: 'Move In',
      permission: 'occupancy.manage',
      onPress: () => navigation.navigate('MoveInWizard', {}),
    },
    {
      label: 'Announcements',
      permission: 'dashboard.read',
      onPress: () =>
        Alert.alert('Announcements', 'Announcements arrive with the Communication module.'),
    },
  ].filter((action) => hasPermission(user, action.permission));

  if (loading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load('refresh')}
            tintColor={colors.primary}
          />
        }
      >
        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
            {error}
          </Text>
        ) : null}

        {summary ? (
          <View style={styles.grid}>
            <StatCard label="Buildings" value={summary.totalBuildings} />
            <StatCard label="Apartments" value={summary.totalApartments} />
            <StatCard label="Occupied" value={summary.occupiedApartments} />
            <StatCard label="Vacant" value={summary.vacantApartments} />
            <StatCard label="Owners" value={summary.totalOwners} />
            <StatCard label="Residents" value={summary.totalResidents} />
            <StatCard label="Active leases" value={summary.activeLeases} />
            <StatCard
              label="Expiring in 30 days"
              value={summary.expiringLeases}
              accent={summary.expiringLeases > 0}
            />
            <StatCard label="Open maintenance" value={summary.openMaintenanceRequests} />
            <StatCard label="Occupancy" value={`${summary.occupancyRate}%`} accent />
          </View>
        ) : null}

        {quickActions.length > 0 ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick actions</Text>
            <View style={styles.grid}>
              {quickActions.map((action) => (
                <Pressable
                  key={action.label}
                  accessibilityRole="button"
                  onPress={action.onPress}
                  style={({ pressed }) => [
                    styles.quickAction,
                    {
                      backgroundColor: colors.surfaceMuted,
                      borderColor: colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.quickActionText, { color: colors.text }]}>
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {alerts && (alerts.expiringSoon.length > 0 || alerts.expired.length > 0) ? (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Lease alerts</Text>
            {alerts.expiringSoon.map((lease) => (
              <ListItemCard
                key={lease.id}
                title={lease.contractNumber}
                subtitle={`Expires ${lease.endDate.slice(0, 10)}`}
                badge="Expiring"
                onPress={() => navigation.navigate('LeaseDetails', { id: lease.id })}
              />
            ))}
            {alerts.expired.map((lease) => (
              <ListItemCard
                key={lease.id}
                title={lease.contractNumber}
                subtitle={`Ended ${lease.endDate.slice(0, 10)}`}
                badge="Expired"
                onPress={() => navigation.navigate('LeaseDetails', { id: lease.id })}
              />
            ))}
          </>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Buildings</Text>
        {buildings.length === 0 ? (
          <EmptyState title="No buildings yet" hint="Use “+ Building” to add the first one." />
        ) : (
          buildings.map((building) => (
            <Pressable
              key={building.buildingId}
              accessibilityRole="button"
              onPress={() => navigation.navigate('BuildingDetails', { id: building.buildingId })}
              style={({ pressed }) => [
                styles.buildingCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.buildingHeader}>
                <Text style={[styles.buildingName, { color: colors.text }]} numberOfLines={1}>
                  {building.name}
                </Text>
                <Text style={[styles.buildingPercent, { color: colors.accent }]}>
                  {building.occupancyPercent}%
                </Text>
              </View>
              <Text style={[styles.buildingAddress, { color: colors.textMuted }]} numberOfLines={1}>
                {building.address}, {building.city}
              </Text>
              <Text style={[styles.buildingCounts, { color: colors.textMuted }]}>
                {building.apartmentCount} apartments · {building.occupied} occupied ·{' '}
                {building.vacant} vacant
              </Text>
              <View style={[styles.meter, { backgroundColor: colors.surfaceMuted }]}>
                <View
                  style={[
                    styles.meterFill,
                    {
                      backgroundColor: colors.accent,
                      width: `${Math.min(100, Math.max(0, building.occupancyPercent))}%`,
                    },
                  ]}
                />
              </View>
            </Pressable>
          ))
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent activity</Text>
        {activity.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          activity.map((item) => (
            <View
              key={`${item.type}-${item.entityId}-${item.occurredAt}`}
              style={[
                styles.activityRow,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.activityText, { color: colors.text }]} numberOfLines={2}>
                {item.description}
              </Text>
              <Text style={[styles.activityTime, { color: colors.textMuted }]}>
                {item.occurredAt.slice(0, 10)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loader: { marginTop: spacing.xl },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  error: { fontSize: 14, textAlign: 'center', marginBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  quickAction: {
    flexBasis: '30%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  quickActionText: { fontSize: 13, fontWeight: '600' },
  buildingCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: 4,
  },
  buildingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buildingName: { fontSize: 16, fontWeight: '600', flexShrink: 1 },
  buildingPercent: { fontSize: 16, fontWeight: '700' },
  buildingAddress: { fontSize: 13 },
  buildingCounts: { fontSize: 12 },
  meter: { height: 6, borderRadius: radius.full, overflow: 'hidden', marginTop: 4 },
  meterFill: { height: '100%', borderRadius: radius.full },
  activityRow: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  activityText: { fontSize: 13, flex: 1 },
  activityTime: { fontSize: 12 },
});
