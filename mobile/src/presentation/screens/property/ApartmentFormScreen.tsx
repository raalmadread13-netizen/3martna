import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ApartmentStatus, Building, Floor, Owner } from '@/domain/entities/Property';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { apartmentsApi, buildingsApi, ownersApi } from '@/infrastructure/api/propertyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { AppTextInput } from '@/presentation/components/ui/AppTextInput';
import { Screen } from '@/presentation/components/ui/Screen';
import { SelectChips } from '@/presentation/components/ui/SelectChips';
import { RootScreenProps } from '@/presentation/navigation/types';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

const STATUS_OPTIONS: ApartmentStatus[] = [
  'Available',
  'Leased',
  'OwnerOccupied',
  'UnderMaintenance',
  'Reserved',
];

/**
 * Create/Edit apartment. Create mode picks a building (unless preselected)
 * and one of its floors; edit mode adjusts details, status and owner.
 */
export const ApartmentFormScreen = ({
  navigation,
  route,
}: RootScreenProps<'ApartmentForm'>): React.JSX.Element => {
  const { colors } = useTheme();
  const editing = route.params?.apartment ?? null;
  const presetBuildingId = route.params?.buildingId ?? editing?.buildingId ?? null;

  const [buildings, setBuildings] = useState<Building[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [buildingId, setBuildingId] = useState<string | null>(presetBuildingId);
  const [floorId, setFloorId] = useState<string | null>(editing?.floorId ?? null);
  const [unitNumber, setUnitNumber] = useState(editing?.unitNumber ?? '');
  const [bedrooms, setBedrooms] = useState(editing ? String(editing.bedrooms) : '1');
  const [bathrooms, setBathrooms] = useState(editing ? String(editing.bathrooms) : '1');
  const [areaSqm, setAreaSqm] = useState(editing?.areaSqm ? String(editing.areaSqm) : '');
  const [rent, setRent] = useState(editing?.baseRentAmount ? String(editing.baseRentAmount) : '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [status, setStatus] = useState<ApartmentStatus>(editing?.status ?? 'Available');
  const [ownerId, setOwnerId] = useState<string | null>(editing?.ownerId ?? null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create mode without a preselected building → offer the tenant's buildings
  useEffect(() => {
    if (editing || presetBuildingId) return;
    buildingsApi
      .list(1, 100)
      .then((page) => setBuildings(page.data))
      .catch((err) => setFormError(apiErrorMessage(err)));
  }, [editing, presetBuildingId]);

  // Load the floors of the chosen building (create mode only)
  const loadFloors = useCallback((id: string): void => {
    buildingsApi
      .listFloors(id)
      .then(setFloors)
      .catch((err) => setFormError(apiErrorMessage(err)));
  }, []);

  useEffect(() => {
    if (!editing && buildingId) loadFloors(buildingId);
  }, [editing, buildingId, loadFloors]);

  // Edit mode → owner assignment choices
  useEffect(() => {
    if (!editing) return;
    ownersApi
      .list(1, 100)
      .then((page) => setOwners(page.data))
      .catch((err) => setFormError(apiErrorMessage(err)));
  }, [editing]);

  const submit = async (): Promise<void> => {
    setFormError(null);
    setSaving(true);
    try {
      if (editing) {
        await apartmentsApi.update(editing.id, {
          bedrooms: Number(bedrooms),
          bathrooms: Number(bathrooms),
          areaSqm: areaSqm ? Number(areaSqm) : null,
          baseRentAmount: rent ? Number(rent) : null,
          description: description.trim() || null,
          ...(status !== editing.status ? { status } : {}),
          ...(ownerId && ownerId !== editing.ownerId ? { ownerId } : {}),
        });
      } else {
        if (!buildingId || !floorId) {
          setFormError('Choose a building and a floor first');
          return;
        }
        if (!unitNumber.trim()) {
          setFormError('Unit number is required');
          return;
        }
        await apartmentsApi.create({
          buildingId,
          floorId,
          unitNumber: unitNumber.trim(),
          bedrooms: Number(bedrooms) || 1,
          bathrooms: Number(bathrooms) || 1,
          areaSqm: areaSqm ? Number(areaSqm) : null,
          baseRentAmount: rent ? Number(rent) : null,
          description: description.trim() || null,
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
        {editing ? `Edit Unit ${editing.unitNumber}` : 'New Apartment'}
      </Text>

      {!editing ? (
        <>
          {!presetBuildingId ? (
            <SelectChips
              label="Building"
              options={buildings.map((b) => ({ label: b.name, value: b.id }))}
              selected={buildingId}
              onSelect={(value) => {
                setBuildingId(value);
                setFloorId(null);
              }}
              disabled={saving}
            />
          ) : null}
          {buildingId ? (
            floors.length > 0 ? (
              <SelectChips
                label="Floor"
                options={floors.map((f) => ({
                  label: f.name ? `${f.floorNumber} · ${f.name}` : `Floor ${f.floorNumber}`,
                  value: f.id,
                }))}
                selected={floorId}
                onSelect={setFloorId}
                disabled={saving}
              />
            ) : (
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                This building has no floors yet — add one from Building Details.
              </Text>
            )
          ) : null}
          <AppTextInput
            label="Unit number"
            value={unitNumber}
            onChangeText={setUnitNumber}
            placeholder="e.g. 101"
            editable={!saving}
          />
        </>
      ) : null}

      <AppTextInput
        label="Bedrooms"
        value={bedrooms}
        onChangeText={setBedrooms}
        keyboardType="number-pad"
        editable={!saving}
      />
      <AppTextInput
        label="Bathrooms"
        value={bathrooms}
        onChangeText={setBathrooms}
        keyboardType="number-pad"
        editable={!saving}
      />
      <AppTextInput
        label="Area m² (optional)"
        value={areaSqm}
        onChangeText={setAreaSqm}
        keyboardType="decimal-pad"
        editable={!saving}
      />
      <AppTextInput
        label="Base rent JOD (optional)"
        value={rent}
        onChangeText={setRent}
        keyboardType="decimal-pad"
        editable={!saving}
      />
      <AppTextInput
        label="Description (optional)"
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={3}
        editable={!saving}
      />

      {editing ? (
        <>
          <SelectChips
            label="Status (transitions are validated by the server)"
            options={STATUS_OPTIONS.map((s) => ({ label: s, value: s }))}
            selected={status}
            onSelect={(value) => setStatus(value as ApartmentStatus)}
            disabled={saving}
          />
          {owners.length > 0 ? (
            <SelectChips
              label="Owner"
              options={owners.map((o) => ({ label: o.fullName, value: o.id }))}
              selected={ownerId}
              onSelect={setOwnerId}
              disabled={saving}
            />
          ) : null}
        </>
      ) : null}

      {formError ? (
        <Text accessibilityRole="alert" style={[styles.formError, { color: colors.danger }]}>
          {formError}
        </Text>
      ) : null}

      <AppButton
        title={editing ? 'Save Changes' : 'Create Apartment'}
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
