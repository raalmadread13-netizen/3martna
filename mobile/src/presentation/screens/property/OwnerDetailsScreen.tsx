import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { Owner } from '@/domain/entities/Property';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { ownersApi } from '@/infrastructure/api/propertyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { DetailRow } from '@/presentation/components/ui/DetailRow';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { hasPermission } from '@/shared/utils/permissions';

export const OwnerDetailsScreen = ({
  navigation,
  route,
}: RootScreenProps<'OwnerDetails'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canManage = hasPermission(user, 'owners.manage');
  const { id } = route.params;

  const [owner, setOwner] = useState<Owner | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setOwner(await ownersApi.get(id));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

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

      {owner ? (
        <>
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.title, { color: colors.text }]}>{owner.fullName}</Text>
            <DetailRow label="Type" value={owner.ownerType} />
            <DetailRow label="Company" value={owner.companyName} />
            <DetailRow label="National ID / Reg." value={owner.nationalIdOrRegistration} />
            <DetailRow label="Email" value={owner.email} />
            <DetailRow label="Phone" value={owner.phoneNumber} />
            <DetailRow label="Address" value={owner.address} />
            <DetailRow label="App account" value={owner.userId ? 'Linked' : 'Not linked'} />
          </View>

          {canManage ? (
            <AppButton
              title="Edit Owner"
              onPress={() => navigation.navigate('OwnerForm', { owner })}
            />
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
