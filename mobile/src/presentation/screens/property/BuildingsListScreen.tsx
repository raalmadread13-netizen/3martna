import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { usePagedList } from '@/application/property/usePagedList';
import { Building } from '@/domain/entities/Property';
import { buildingsApi } from '@/infrastructure/api/propertyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { EmptyState } from '@/presentation/components/ui/EmptyState';
import { ListItemCard } from '@/presentation/components/ui/ListItemCard';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { hasPermission } from '@/shared/utils/permissions';

export const BuildingsListScreen = ({
  navigation,
}: RootScreenProps<'Buildings'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canManage = hasPermission(user, 'buildings.manage');

  const fetcher = useCallback((page: number) => buildingsApi.list(page), []);
  const list = usePagedList<Building>(fetcher);

  // Refresh when returning from create/edit/archive (single stable listener)
  const reloadRef = useRef(list.reload);
  reloadRef.current = list.reload;
  useEffect(() => navigation.addListener('focus', () => reloadRef.current()), [navigation]);

  return (
    <Screen>
      {canManage ? (
        <AppButton title="+ Add Building" onPress={() => navigation.navigate('BuildingForm', {})} />
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
              title="No buildings yet"
              hint={canManage ? 'Add your first building to get started.' : undefined}
            />
          }
          ListFooterComponent={
            list.loadingMore ? <ActivityIndicator color={colors.primary} /> : null
          }
          renderItem={({ item }) => (
            <ListItemCard
              title={item.name}
              subtitle={`${item.address}, ${item.city}`}
              badge={item.status}
              onPress={() => navigation.navigate('BuildingDetails', { id: item.id })}
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
  listContent: { paddingBottom: spacing.xl, paddingTop: spacing.sm },
});
