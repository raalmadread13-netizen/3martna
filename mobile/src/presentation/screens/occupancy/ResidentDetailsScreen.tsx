import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { Lease, Resident } from '@/domain/entities/Occupancy';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { leasesApi, residentsApi } from '@/infrastructure/api/occupancyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { DetailRow } from '@/presentation/components/ui/DetailRow';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { hasPermission } from '@/shared/utils/permissions';

export const ResidentDetailsScreen = ({
  navigation,
  route,
}: RootScreenProps<'ResidentDetails'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canManage = hasPermission(user, 'residents.manage');
  const canSeeLeases = hasPermission(user, 'leases.read');
  const { id } = route.params;

  const [resident, setResident] = useState<Resident | null>(null);
  const [activeLease, setActiveLease] = useState<Lease | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const loaded = await residentsApi.get(id);
      setResident(loaded);
      if (canSeeLeases) {
        const leases = await leasesApi.list({ residentId: id, status: 'Active', limit: 1 });
        setActiveLease(leases.data[0] ?? null);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id, canSeeLeases]);

  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => navigation.addListener('focus', () => void loadRef.current()), [navigation]);

  if (loading) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen scroll>
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}

      {resident ? (
        <>
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.title, { color: colors.text }]}>{resident.fullName}</Text>
            <DetailRow label="Status" value={resident.isActive ? 'Living in' : 'Not placed'} />
            <DetailRow label="Phone" value={resident.phoneNumber} />
            <DetailRow label="Email" value={resident.email} />
            <DetailRow label="Residency type" value={resident.residencyType} />
            <DetailRow label="Move-in date" value={resident.moveInDate?.slice(0, 10)} />
            <DetailRow label="Move-out date" value={resident.moveOutDate?.slice(0, 10)} />
            <DetailRow label="Emergency contact" value={resident.emergencyContactName} />
            <DetailRow label="Emergency phone" value={resident.emergencyContactPhone} />
            {activeLease ? (
              <DetailRow label="Active lease" value={activeLease.contractNumber} />
            ) : null}
          </View>

          {canManage ? (
            <AppButton
              title="Edit Resident"
              onPress={() => navigation.navigate('ResidentForm', { resident })}
            />
          ) : null}
          {activeLease ? (
            <AppButton
              title="View Active Lease"
              variant="secondary"
              onPress={() => navigation.navigate('LeaseDetails', { id: activeLease.id })}
            />
          ) : null}
          <AppButton
            title="Occupancy History"
            variant="secondary"
            onPress={() => navigation.navigate('OccupancyHistory', { residentId: resident.id })}
          />
        </>
      ) : null}
    </Screen>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  error: { fontSize: 14, textAlign: 'center', marginVertical: spacing.sm },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  title: { fontSize: 20, fontWeight: '700', marginBottom: spacing.sm },
});
