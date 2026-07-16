import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { OccupancyRecord, Resident } from '@/domain/entities/Occupancy';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { occupancyApi, residentsApi } from '@/infrastructure/api/occupancyApi';
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
 * Move-Out wizard.
 * Step 1: pick the current stay to close (skipped when opened from a
 *         lease/occupancy context).
 * Step 2: confirm date + reason. The record is closed, never deleted.
 */
export const MoveOutWizardScreen = ({
  navigation,
  route,
}: RootScreenProps<'MoveOutWizard'>): React.JSX.Element => {
  const { colors } = useTheme();
  const presetOccupancyId = route.params?.occupancyId ?? null;

  const [stays, setStays] = useState<OccupancyRecord[]>([]);
  const [selected, setSelected] = useState<OccupancyRecord | null>(null);
  const [resident, setResident] = useState<Resident | null>(null);
  const [moveOutDate, setMoveOutDate] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        if (presetOccupancyId) {
          await select(await occupancyApi.get(presetOccupancyId));
          return;
        }
        const active = await occupancyApi.list({ active: true, limit: 100 });
        setStays(active.data);
      } catch (err) {
        setError(apiErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [presetOccupancyId]);

  const select = async (stay: OccupancyRecord): Promise<void> => {
    setSelected(stay);
    setResident(await residentsApi.get(stay.residentId).catch(() => null));
    setLoading(false);
  };

  const confirm = async (): Promise<void> => {
    if (!selected) return;
    if (!DATE_PATTERN.test(moveOutDate)) {
      setError('Move-out date must be YYYY-MM-DD');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await occupancyApi.moveOut(selected.id, moveOutDate, reason.trim() || undefined);
      navigation.goBack();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: colors.text }]}>Move-Out</Text>

      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
          {error}
        </Text>
      ) : null}

      {!selected ? (
        <>
          <Text style={[styles.step, { color: colors.textMuted }]}>
            Step 1 of 2 — choose the current stay to close
          </Text>
          {loading ? null : stays.length === 0 ? (
            <EmptyState title="No one is currently moved in" />
          ) : (
            stays.map((stay) => (
              <ListItemCard
                key={stay.id}
                title={`Since ${stay.moveInDate.slice(0, 10)}`}
                subtitle={`Apartment ${stay.apartmentId.slice(0, 8)}…`}
                badge="Select"
                onPress={() => void select(stay)}
              />
            ))
          )}
        </>
      ) : (
        <>
          <Text style={[styles.step, { color: colors.textMuted }]}>
            Step 2 of 2 — confirm the move-out (history is kept)
          </Text>
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <DetailRow label="Resident" value={resident?.fullName ?? selected.residentId} />
            <DetailRow label="Moved in" value={selected.moveInDate.slice(0, 10)} />
          </View>
          <AppTextInput
            label="Move-out date"
            value={moveOutDate}
            onChangeText={setMoveOutDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            editable={!submitting}
          />
          <AppTextInput
            label="Reason (optional)"
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. End of lease, relocation"
            editable={!submitting}
          />
          <AppButton title="Confirm Move-Out" loading={submitting} onPress={() => void confirm()} />
          {!presetOccupancyId ? (
            <AppButton
              title="Back"
              variant="ghost"
              disabled={submitting}
              onPress={() => setSelected(null)}
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
