import React, { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { Apartment } from '@/domain/entities/Property';
import { Resident } from '@/domain/entities/Occupancy';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { leasesApi, residentsApi } from '@/infrastructure/api/occupancyApi';
import { apartmentsApi } from '@/infrastructure/api/propertyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { AppTextInput } from '@/presentation/components/ui/AppTextInput';
import { Screen } from '@/presentation/components/ui/Screen';
import { SelectChips } from '@/presentation/components/ui/SelectChips';
import { RootScreenProps } from '@/presentation/navigation/types';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Create a lease (pick apartment + resident, set terms) or — when an
 * existing lease is passed — extend its end date (the only mutable term).
 */
export const LeaseFormScreen = ({
  navigation,
  route,
}: RootScreenProps<'LeaseForm'>): React.JSX.Element => {
  const { colors } = useTheme();
  const extending = route.params?.lease ?? null;
  const presetResidentId = route.params?.residentId ?? null;

  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [apartmentId, setApartmentId] = useState<string | null>(null);
  const [residentId, setResidentId] = useState<string | null>(presetResidentId);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(extending ? extending.endDate.slice(0, 10) : '');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (extending) return;
    apartmentsApi
      .list(1, 100)
      .then((page) =>
        setApartments(page.data.filter((a) => a.status === 'Available' || a.status === 'Reserved')),
      )
      .catch((err) => setFormError(apiErrorMessage(err)));
    residentsApi
      .list({ limit: 100, status: 'inactive' })
      .then((page) => setResidents(page.data))
      .catch((err) => setFormError(apiErrorMessage(err)));
  }, [extending]);

  const submit = async (): Promise<void> => {
    setFormError(null);
    if (!DATE_PATTERN.test(endDate)) {
      setFormError('End date must be YYYY-MM-DD');
      return;
    }
    setSaving(true);
    try {
      if (extending) {
        await leasesApi.extend(extending.id, endDate);
      } else {
        if (!apartmentId || !residentId) {
          setFormError('Choose an apartment and a resident first');
          return;
        }
        if (!DATE_PATTERN.test(startDate)) {
          setFormError('Start date must be YYYY-MM-DD');
          return;
        }
        const rent = Number(monthlyRent);
        if (!(rent > 0)) {
          setFormError('Monthly rent must be a positive number');
          return;
        }
        await leasesApi.create({
          apartmentId,
          residentId,
          startDate,
          endDate,
          monthlyRent: rent,
          depositAmount: deposit ? Number(deposit) : undefined,
        });
      }
      navigation.goBack();
    } catch (error) {
      setFormError(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: colors.text }]}>
        {extending ? `Extend ${extending.contractNumber}` : 'New Lease'}
      </Text>

      {!extending ? (
        <>
          <SelectChips
            label="Apartment (available / reserved)"
            options={apartments.map((a) => ({ label: `Unit ${a.unitNumber}`, value: a.id }))}
            selected={apartmentId}
            onSelect={setApartmentId}
            disabled={saving}
          />
          {apartments.length === 0 ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              No available apartments — apartments must exist and have an owner assigned.
            </Text>
          ) : null}
          <SelectChips
            label="Resident (not currently placed)"
            options={residents.map((r) => ({ label: r.fullName, value: r.id }))}
            selected={residentId}
            onSelect={setResidentId}
            disabled={saving}
          />
          {residents.length === 0 ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              No unplaced residents — register one from the Residents screen.
            </Text>
          ) : null}
          <AppTextInput
            label="Start date"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
            editable={!saving}
          />
        </>
      ) : null}

      <AppTextInput
        label={extending ? 'New end date (after the current one)' : 'End date'}
        value={endDate}
        onChangeText={setEndDate}
        placeholder="YYYY-MM-DD"
        autoCapitalize="none"
        editable={!saving}
      />

      {!extending ? (
        <>
          <AppTextInput
            label="Monthly rent (JOD)"
            value={monthlyRent}
            onChangeText={setMonthlyRent}
            keyboardType="decimal-pad"
            editable={!saving}
          />
          <AppTextInput
            label="Deposit (JOD, optional)"
            value={deposit}
            onChangeText={setDeposit}
            keyboardType="decimal-pad"
            editable={!saving}
          />
        </>
      ) : null}

      {formError ? (
        <Text accessibilityRole="alert" style={[styles.formError, { color: colors.danger }]}>
          {formError}
        </Text>
      ) : null}

      <AppButton
        title={extending ? 'Extend Lease' : 'Create Lease'}
        loading={saving}
        onPress={() => void submit()}
      />
      <AppButton title="Cancel" variant="ghost" disabled={saving} onPress={navigation.goBack} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '700', marginBottom: spacing.lg },
  hint: { fontSize: 13, marginBottom: spacing.md },
  formError: { fontSize: 14, textAlign: 'center', marginVertical: spacing.sm },
});
