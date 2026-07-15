import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { buildingsApi } from '@/infrastructure/api/propertyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { AppTextInput } from '@/presentation/components/ui/AppTextInput';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

/** Create/Edit building — edit mode when route params carry a building. */
export const BuildingFormScreen = ({
  navigation,
  route,
}: RootScreenProps<'BuildingForm'>): React.JSX.Element => {
  const { colors } = useTheme();
  const editing = route.params?.building ?? null;

  const [name, setName] = useState(editing?.name ?? '');
  const [address, setAddress] = useState(editing?.address ?? '');
  const [city, setCity] = useState(editing?.city ?? '');
  const [district, setDistrict] = useState(editing?.district ?? '');
  const [totalFloors, setTotalFloors] = useState(editing ? String(editing.totalFloors) : '');
  const [yearBuilt, setYearBuilt] = useState(editing?.yearBuilt ? String(editing.yearBuilt) : '');
  const [notes, setNotes] = useState(editing?.notes ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = (): boolean => {
    const errors: Record<string, string | undefined> = {
      name: name.trim().length < 2 ? 'Name must be at least 2 characters' : undefined,
      address: address.trim().length < 5 ? 'Address is required' : undefined,
      city: city.trim().length < 2 ? 'City is required' : undefined,
    };
    if (!editing) {
      const floors = Number(totalFloors);
      errors.totalFloors =
        !Number.isInteger(floors) || floors < 1 || floors > 200
          ? 'Total floors must be between 1 and 200'
          : undefined;
      if (yearBuilt) {
        const year = Number(yearBuilt);
        errors.yearBuilt =
          !Number.isInteger(year) || year < 1900 || year > 2100
            ? 'Year must be between 1900 and 2100'
            : undefined;
      }
    }
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const submit = async (): Promise<void> => {
    setFormError(null);
    if (!validate()) return;
    setSaving(true);
    try {
      if (editing) {
        await buildingsApi.update(editing.id, {
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          district: district.trim() || null,
          notes: notes.trim() || null,
        });
      } else {
        await buildingsApi.create({
          name: name.trim(),
          address: address.trim(),
          city: city.trim(),
          district: district.trim() || null,
          totalFloors: Number(totalFloors),
          yearBuilt: yearBuilt ? Number(yearBuilt) : null,
          notes: notes.trim() || null,
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
        {editing ? 'Edit Building' : 'New Building'}
      </Text>

      <AppTextInput
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Amman Heights"
        error={fieldErrors.name}
        editable={!saving}
      />
      <AppTextInput
        label="Address"
        value={address}
        onChangeText={setAddress}
        placeholder="Street and number"
        error={fieldErrors.address}
        editable={!saving}
      />
      <AppTextInput
        label="City"
        value={city}
        onChangeText={setCity}
        placeholder="e.g. Amman"
        error={fieldErrors.city}
        editable={!saving}
      />
      <AppTextInput
        label="District (optional)"
        value={district}
        onChangeText={setDistrict}
        placeholder="e.g. Abdoun"
        editable={!saving}
      />
      {!editing ? (
        <>
          <AppTextInput
            label="Total floors"
            value={totalFloors}
            onChangeText={setTotalFloors}
            keyboardType="number-pad"
            placeholder="e.g. 6"
            error={fieldErrors.totalFloors}
            editable={!saving}
          />
          <AppTextInput
            label="Year built (optional)"
            value={yearBuilt}
            onChangeText={setYearBuilt}
            keyboardType="number-pad"
            placeholder="e.g. 2015"
            error={fieldErrors.yearBuilt}
            editable={!saving}
          />
        </>
      ) : null}
      <AppTextInput
        label="Notes (optional)"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        placeholder="Anything worth remembering about this building"
        editable={!saving}
      />

      {formError ? (
        <Text accessibilityRole="alert" style={[styles.formError, { color: colors.danger }]}>
          {formError}
        </Text>
      ) : null}

      <AppButton
        title={editing ? 'Save Changes' : 'Create Building'}
        loading={saving}
        onPress={() => void submit()}
      />
      <AppButton title="Cancel" variant="ghost" disabled={saving} onPress={navigation.goBack} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '700', marginBottom: spacing.lg },
  formError: { fontSize: 14, textAlign: 'center', marginVertical: spacing.sm },
});
