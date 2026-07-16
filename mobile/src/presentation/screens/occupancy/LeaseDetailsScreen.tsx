import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { Lease, OccupancyRecord, Resident } from '@/domain/entities/Occupancy';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { leasesApi, occupancyApi, residentsApi } from '@/infrastructure/api/occupancyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { AppTextInput } from '@/presentation/components/ui/AppTextInput';
import { DetailRow } from '@/presentation/components/ui/DetailRow';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { hasPermission } from '@/shared/utils/permissions';

export const LeaseDetailsScreen = ({
  navigation,
  route,
}: RootScreenProps<'LeaseDetails'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canManage = hasPermission(user, 'leases.manage');
  const canMove = hasPermission(user, 'occupancy.manage');
  const { id } = route.params;

  const [lease, setLease] = useState<Lease | null>(null);
  const [resident, setResident] = useState<Resident | null>(null);
  const [occupancy, setOccupancy] = useState<OccupancyRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [terminating, setTerminating] = useState(false);
  const [terminateReason, setTerminateReason] = useState('');
  const [showTerminate, setShowTerminate] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const loaded = await leasesApi.get(id);
      setLease(loaded);
      setResident(await residentsApi.get(loaded.residentId).catch(() => null));
      const stays = await occupancyApi.list({ leaseId: id, active: true, limit: 1 });
      setOccupancy(stays.data[0] ?? null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => navigation.addListener('focus', () => void loadRef.current()), [navigation]);

  const terminate = (): void => {
    if (terminateReason.trim().length < 3) {
      setError('A termination reason (3+ characters) is required');
      return;
    }
    Alert.alert(
      'Terminate lease?',
      'The lease ends immediately and any active occupancy is closed automatically.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Terminate',
          style: 'destructive',
          onPress: () => {
            setTerminating(true);
            setError(null);
            leasesApi
              .terminate(id, terminateReason.trim())
              .then(() => {
                setShowTerminate(false);
                setTerminateReason('');
                return load();
              })
              .catch((err) => setError(apiErrorMessage(err)))
              .finally(() => setTerminating(false));
          },
        },
      ],
    );
  };

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

      {lease ? (
        <>
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.title, { color: colors.text }]}>{lease.contractNumber}</Text>
            <DetailRow label="Status" value={lease.status} />
            <DetailRow label="Resident" value={resident?.fullName ?? lease.residentId} />
            <DetailRow
              label="Period"
              value={`${lease.startDate.slice(0, 10)} → ${lease.endDate.slice(0, 10)}`}
            />
            <DetailRow label="Monthly rent" value={`${lease.monthlyRent} ${lease.currency}`} />
            <DetailRow label="Deposit" value={`${lease.depositAmount} ${lease.currency}`} />
            <DetailRow label="Payment frequency" value={lease.paymentFrequency} />
            <DetailRow label="Late fee" value={`${lease.lateFeePercent}%`} />
            <DetailRow label="Grace days" value={lease.graceDays} />
            <DetailRow label="Occupancy" value={occupancy ? 'Moved in' : 'Not moved in'} />
            {lease.terminationReason ? (
              <DetailRow label="Termination reason" value={lease.terminationReason} />
            ) : null}
          </View>

          <AppButton
            title="View Apartment"
            variant="secondary"
            onPress={() => navigation.navigate('ApartmentDetails', { id: lease.apartmentId })}
          />
          {canMove && lease.status === 'Active' && !occupancy ? (
            <AppButton
              title="Move In Resident"
              onPress={() => navigation.navigate('MoveInWizard', { leaseId: lease.id })}
            />
          ) : null}
          {canMove && occupancy ? (
            <AppButton
              title="Move Out Resident"
              onPress={() => navigation.navigate('MoveOutWizard', { occupancyId: occupancy.id })}
            />
          ) : null}
          {canManage && lease.status === 'Active' ? (
            <>
              <AppButton
                title="Extend Lease"
                variant="secondary"
                onPress={() => navigation.navigate('LeaseForm', { lease })}
              />
              {showTerminate ? (
                <View
                  style={[
                    styles.card,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <AppTextInput
                    label="Termination reason"
                    value={terminateReason}
                    onChangeText={setTerminateReason}
                    placeholder="e.g. Tenant request, contract breach"
                    editable={!terminating}
                  />
                  <AppButton
                    title="Confirm Termination"
                    loading={terminating}
                    onPress={terminate}
                  />
                  <AppButton
                    title="Cancel"
                    variant="ghost"
                    disabled={terminating}
                    onPress={() => setShowTerminate(false)}
                  />
                </View>
              ) : (
                <AppButton
                  title="Terminate Lease"
                  variant="ghost"
                  onPress={() => setShowTerminate(true)}
                />
              )}
            </>
          ) : null}
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
