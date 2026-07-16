import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { useCursorList } from '@/application/occupancy/useCursorList';
import { Lease, LeaseStatus } from '@/domain/entities/Occupancy';
import { leasesApi } from '@/infrastructure/api/occupancyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { AppTextInput } from '@/presentation/components/ui/AppTextInput';
import { EmptyState } from '@/presentation/components/ui/EmptyState';
import { ListItemCard } from '@/presentation/components/ui/ListItemCard';
import { Screen } from '@/presentation/components/ui/Screen';
import { SelectChips } from '@/presentation/components/ui/SelectChips';
import { RootScreenProps } from '@/presentation/navigation/types';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { hasPermission } from '@/shared/utils/permissions';

export const LeasesListScreen = ({ navigation }: RootScreenProps<'Leases'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canManage = hasPermission(user, 'leases.manage');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | LeaseStatus>('all');

  const fetcher = useCallback(
    (cursor?: string) =>
      leasesApi.list({
        cursor,
        limit: 20,
        search: search.trim() || undefined,
        status: status === 'all' ? undefined : status,
      }),
    [search, status],
  );
  const list = useCursorList<Lease>(fetcher);

  const reloadRef = useRef(list.reload);
  reloadRef.current = list.reload;
  useEffect(() => navigation.addListener('focus', () => reloadRef.current()), [navigation]);

  return (
    <Screen>
      {canManage ? (
        <AppButton title="+ New Lease" onPress={() => navigation.navigate('LeaseForm', {})} />
      ) : null}

      <AppTextInput
        label="Search"
        value={search}
        onChangeText={setSearch}
        placeholder="Contract number"
        autoCapitalize="characters"
      />
      <SelectChips
        label="Status"
        options={[
          { label: 'All', value: 'all' },
          { label: 'Active', value: 'Active' },
          { label: 'Terminated', value: 'Terminated' },
          { label: 'Expired', value: 'Expired' },
        ]}
        selected={status}
        onSelect={(value) => setStatus(value as typeof status)}
      />

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
              title="No leases found"
              hint={canManage ? 'Create a lease to start renting an apartment.' : undefined}
            />
          }
          ListFooterComponent={
            list.loadingMore ? <ActivityIndicator color={colors.primary} /> : null
          }
          renderItem={({ item }) => (
            <ListItemCard
              title={item.contractNumber}
              subtitle={`${item.startDate.slice(0, 10)} → ${item.endDate.slice(0, 10)} · ${item.monthlyRent} ${item.currency}/mo`}
              badge={item.status}
              onPress={() => navigation.navigate('LeaseDetails', { id: item.id })}
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
  listContent: { paddingBottom: spacing.xl },
});
