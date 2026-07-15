import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { BuildingDetail, Floor } from '@/domain/entities/Property';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { buildingsApi } from '@/infrastructure/api/propertyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { AppTextInput } from '@/presentation/components/ui/AppTextInput';
import { DetailRow } from '@/presentation/components/ui/DetailRow';
import { ListItemCard } from '@/presentation/components/ui/ListItemCard';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { hasPermission } from '@/shared/utils/permissions';

export const BuildingDetailsScreen = ({
  navigation,
  route,
}: RootScreenProps<'BuildingDetails'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canManage = hasPermission(user, 'buildings.manage');
  const { id } = route.params;

  const [building, setBuilding] = useState<BuildingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [floorNumber, setFloorNumber] = useState('');
  const [floorName, setFloorName] = useState('');
  const [addingFloor, setAddingFloor] = useState(false);
  const [editingFloor, setEditingFloor] = useState<Floor | null>(null);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setBuilding(await buildingsApi.get(id));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => navigation.addListener('focus', () => void loadRef.current()), [navigation]);

  const addFloor = async (): Promise<void> => {
    const parsed = Number(floorNumber);
    if (!Number.isInteger(parsed)) {
      setError('Floor number must be a whole number');
      return;
    }
    setAddingFloor(true);
    setError(null);
    try {
      await buildingsApi.addFloor(id, { floorNumber: parsed, name: floorName.trim() || null });
      setFloorNumber('');
      setFloorName('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setAddingFloor(false);
    }
  };

  const renameFloor = async (): Promise<void> => {
    if (!editingFloor) return;
    setError(null);
    try {
      await buildingsApi.renameFloor(id, editingFloor.id, editingFloor.name?.trim() || null);
      setEditingFloor(null);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const confirmArchive = (): void => {
    Alert.alert(
      'Archive building?',
      'The building will be hidden everywhere. Buildings that still contain apartments cannot be archived.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: () => {
            setArchiving(true);
            setError(null);
            buildingsApi
              .archive(id)
              .then(() => navigation.goBack())
              .catch((err) => setError(apiErrorMessage(err)))
              .finally(() => setArchiving(false));
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

      {building ? (
        <>
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.title, { color: colors.text }]}>{building.name}</Text>
            <DetailRow label="Status" value={building.status} />
            <DetailRow label="Address" value={building.address} />
            <DetailRow label="City" value={building.city} />
            <DetailRow label="District" value={building.district} />
            <DetailRow label="Total floors" value={building.totalFloors} />
            <DetailRow label="Year built" value={building.yearBuilt} />
            <DetailRow label="Notes" value={building.notes} />
          </View>

          <AppButton
            title="View Apartments"
            variant="secondary"
            onPress={() => navigation.navigate('Apartments', { buildingId: building.id })}
          />
          {canManage ? (
            <>
              <AppButton
                title="Edit Building"
                onPress={() => navigation.navigate('BuildingForm', { building })}
              />
              <AppButton
                title="Archive Building"
                variant="ghost"
                loading={archiving}
                onPress={confirmArchive}
              />
            </>
          ) : null}

          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Floors ({building.floors.length})
          </Text>
          {building.floors.length === 0 ? (
            <Text style={[styles.emptyFloors, { color: colors.textMuted }]}>
              No floors yet — apartments need a floor.
            </Text>
          ) : (
            building.floors.map((floor) =>
              editingFloor?.id === floor.id ? (
                <View
                  key={floor.id}
                  style={[
                    styles.floorEdit,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <AppTextInput
                    label={`Rename floor ${floor.floorNumber}`}
                    value={editingFloor.name ?? ''}
                    onChangeText={(name) => setEditingFloor({ ...editingFloor, name })}
                    placeholder="e.g. Ground, Mezzanine"
                  />
                  <AppButton title="Save name" onPress={() => void renameFloor()} />
                  <AppButton title="Cancel" variant="ghost" onPress={() => setEditingFloor(null)} />
                </View>
              ) : (
                <ListItemCard
                  key={floor.id}
                  title={`Floor ${floor.floorNumber}`}
                  subtitle={floor.name}
                  badge={canManage ? 'Rename' : undefined}
                  onPress={canManage ? () => setEditingFloor(floor) : undefined}
                />
              ),
            )
          )}

          {canManage ? (
            <View
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 0 }]}>
                Add floor
              </Text>
              <AppTextInput
                label="Floor number"
                value={floorNumber}
                onChangeText={setFloorNumber}
                keyboardType="numbers-and-punctuation"
                placeholder="0 for ground, -1 for basement"
                editable={!addingFloor}
              />
              <AppTextInput
                label="Name (optional)"
                value={floorName}
                onChangeText={setFloorName}
                placeholder="e.g. Ground"
                editable={!addingFloor}
              />
              <AppButton title="Add Floor" loading={addingFloor} onPress={() => void addFloor()} />
            </View>
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyFloors: { fontSize: 13, marginBottom: spacing.md },
  floorEdit: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
