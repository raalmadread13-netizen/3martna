import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Lease, Resident } from '@/domain/entities/Occupancy';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { leasesApi, occupancyApi, residentsApi } from '@/infrastructure/api/occupancyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { AppTextInput } from '@/presentation/components/ui/AppTextInput';
import { DetailRow } from '@/presentation/components/ui/DetailRow';
import { EmptyState } from '@/presentation/components/ui/EmptyState';
import { ListItemCard } from '@/presentation/components/ui/ListItemCard';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Move-In wizard.
 * Step 1: pick the ACTIVE lease being moved into (only leases without a
 *         current stay are offered).
 * Step 2: confirm the business-effective move-in date.
 */
export const MoveInWizardScreen = ({
  navigation,
  route,
}: RootScreenProps<'MoveInWizard'>): React.JSX.Element => {
  const { colors } = useTheme();
  const presetLeaseId = route.params?.leaseId ?? null;

  const [candidates, setCandidates] = useState<Lease[]>([]);
  const [lease, setLease] = useState<Lease | null>(null);
  const [resident, setResident] = useState<Resident | null>(null);
  const [moveInDate, setMoveInDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 data: active leases that do not have an active stay yet
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        if (presetLeaseId) {
          await select(await leasesApi.get(presetLeaseId));
          return;
        }
        const active = await leasesApi.list({ status: 'Active', limit: 100 });
        const open: Lease[] = [];
        for (const candidate of active.data) {
          const stays = await occupancyApi.list({ leaseId: candidate.id, active: true, limit: 1 });
          if (stays.data.length === 0) open.push(candidate);
        }
        setCandidates(open);
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [presetLeaseId]);

  const select = async (chosen: Lease): Promise<void> => {
    setLease(chosen);
    setMoveInDate(chosen.startDate.slice(0, 10));
    setResident(await residentsApi.get(chosen.residentId).catch(() => null));
    setLoading(false);
  };

  const confirm = async (): Promise<void> => {
    if (!lease) return;
    if (!DATE_PATTERN.test(moveInDate)) {
      setError('Move-in date must be YYYY-MM-DD');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await occupancyApi.moveIn(lease.id, moveInDate);
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: colors.text }]}>Move-In</Text>

      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}

      {!lease ? (
        <>
          <Text style={[styles.step, { color: colors.textMuted }]}>
            Step 1 of 2 — choose the active lease being moved into
          </Text>
          {loading ? null : candidates.length === 0 ? (
            <EmptyState
              title="No leases awaiting move-in"
              hint="Create an active lease first; leases with a current stay are not shown."
            />
          ) : (
            candidates.map((candidate) => (
              <ListItemCard
                key={candidate.id}
                title={candidate.contractNumber}
                subtitle={`${candidate.startDate.slice(0, 10)} → ${candidate.endDate.slice(0, 10)}`}
                badge="Select"
                onPress={() => void select(candidate)}
              />
            ))
          )}
        </>
      ) : (
        <>
          <Text style={[styles.step, { color: colors.textMuted }]}>
            Step 2 of 2 — confirm the move-in
          </Text>
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <DetailRow label="Lease" value={lease.contractNumber} />
            <DetailRow label="Resident" value={resident?.fullName ?? lease.residentId} />
            <DetailRow
              label="Lease period"
              value={`${lease.startDate.slice(0, 10)} → ${lease.endDate.slice(0, 10)}`}
            />
          </View>
          <AppTextInput
            label="Move-in date (inside the lease period)"
            value={moveInDate}
            onChangeText={setMoveInDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            editable={!submitting}
          />
          <AppButton title="Confirm Move-In" loading={submitting} onPress={() => void confirm()} />
          {!presetLeaseId ? (
            <AppButton
              title="Back"
              variant="ghost"
              disabled={submitting}
              onPress={() => setLease(null)}
            />
          ) : null}
        </>
      )}

      <AppButton title="Cancel" variant="ghost" disabled={submitting} onPress={navigation.goBack} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '700', marginBottom: spacing.sm },
  step: { fontSize: 13, marginBottom: spacing.md },
  error: { fontSize: 14, textAlign: 'center', marginVertical: spacing.sm },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
});
