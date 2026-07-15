import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { usePagedList } from '@/application/property/usePagedList';
import { Apartment } from '@/domain/entities/Property';
import { apartmentsApi } from '@/infrastructure/api/propertyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { EmptyState } from '@/presentation/components/ui/EmptyState';
import { ListItemCard } from '@/presentation/components/ui/ListItemCard';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { hasPermission } from '@/shared/utils/permissions';

export const ApartmentsListScreen = ({
  navigation,
  route,
}: RootScreenProps<'Apartments'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canManage = hasPermission(user, 'apartments.manage');
  const buildingId = route.params?.buildingId;

  const fetcher = useCallback(
    (page: number) => apartmentsApi.list(page, 20, buildingId),
    [buildingId],
  );
  const list = usePagedList<Apartment>(fetcher);

  const reloadRef = useRef(list.reload);
  reloadRef.current = list.reload;
  useEffect(() => navigation.addListener('focus', () => reloadRef.current()), [navigation]);

  return (
    <Screen>
      {canManage ? (
        <AppButton
          title="+ Add Apartment"
          onPress={() => navigation.navigate('ApartmentForm', { buildingId })}
        />
      ) : null}

      {buildingId ? (
        <Text style={[styles.filterNote, { color: colors.textMuted }]}>
          Showing apartments of the selected building
        </Text>
      ) : null}

      {list.error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: colors.danger }]}>
          {list.error}
        </Text>
      ) : null}

      {list.loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={list.refreshing}
              onRefresh={list.refresh}
              tintColor={colors.primary}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={list.loadMore}
          ListEmptyComponent={
            <EmptyState
              title="No apartments yet"
              hint={canManage ? 'Add an apartment to a building floor.' : undefined}
            />
          }
          ListFooterComponent={
            list.loadingMore ? <ActivityIndicator color={colors.primary} /> : null
          }
          renderItem={({ item }) => (
            <ListItemCard
              title={`Unit ${item.unitNumber}`}
              subtitle={`${item.bedrooms} bed · ${item.bathrooms} bath${
                item.baseRentAmount != null ? ` · ${item.baseRentAmount} ${item.currency}` : ''
              }`}
              badge={item.status}
              onPress={() => navigation.navigate('ApartmentDetails', { id: item.id })}
            />
          )}
          contentContainerStyle={styles.listContent}
        />
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xl },
  error: { fontSize: 14, textAlign: 'center', marginVertical: spacing.sm },
  filterNote: { fontSize: 12, textAlign: 'center', marginVertical: spacing.xs },
  listContent: { paddingBottom: spacing.xl, paddingTop: spacing.sm },
});
