import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { Apartment, Owner } from '@/domain/entities/Property';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { apartmentsApi, ownersApi } from '@/infrastructure/api/propertyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { DetailRow } from '@/presentation/components/ui/DetailRow';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { hasPermission } from '@/shared/utils/permissions';

export const ApartmentDetailsScreen = ({
  navigation,
  route,
}: RootScreenProps<'ApartmentDetails'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canManage = hasPermission(user, 'apartments.manage');
  const { id } = route.params;

  const [apartment, setApartment] = useState<Apartment | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const unit = await apartmentsApi.get(id);
      setApartment(unit);
      setOwner(unit.ownerId ? await ownersApi.get(unit.ownerId).catch(() => null) : null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => navigation.addListener('focus', () => void loadRef.current()), [navigation]);

  const confirmArchive = (): void => {
    Alert.alert('Archive apartment?', 'The apartment will be hidden everywhere.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => {
          setArchiving(true);
          setError(null);
          apartmentsApi
            .archive(id)
            .then(() => navigation.goBack())
            .catch((err) => setError(apiErrorMessage(err)))
            .finally(() => setArchiving(false));
        },
      },
    ]);
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

      {apartment ? (
        <>
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.title, { color: colors.text }]}>Unit {apartment.unitNumber}</Text>
            <DetailRow label="Status" value={apartment.status} />
            <DetailRow label="Bedrooms" value={apartment.bedrooms} />
            <DetailRow label="Bathrooms" value={apartment.bathrooms} />
            <DetailRow
              label="Area"
              value={apartment.areaSqm != null ? `${apartment.areaSqm} m²` : null}
            />
            <DetailRow
              label="Base rent"
              value={
                apartment.baseRentAmount != null
                  ? `${apartment.baseRentAmount} ${apartment.currency}`
                  : null
              }
            />
            <DetailRow label="Owner" value={owner ? owner.fullName : apartment.ownerId} />
            <DetailRow label="Description" value={apartment.description} />
          </View>

          <AppButton
            title="View Building"
            variant="secondary"
            onPress={() => navigation.navigate('BuildingDetails', { id: apartment.buildingId })}
          />
          {owner ? (
            <AppButton
              title="View Owner"
              variant="secondary"
              onPress={() => navigation.navigate('OwnerDetails', { id: owner.id })}
            />
          ) : null}
          {canManage ? (
            <>
              <AppButton
                title="Edit Apartment"
                onPress={() => navigation.navigate('ApartmentForm', { apartment })}
              />
              <AppButton
                title="Archive Apartment"
                variant="ghost"
                loading={archiving}
                onPress={confirmArchive}
              />
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
