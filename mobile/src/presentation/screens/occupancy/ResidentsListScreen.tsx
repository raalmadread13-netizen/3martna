import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { useCursorList } from '@/application/occupancy/useCursorList';
import { Resident } from '@/domain/entities/Occupancy';
import { residentsApi } from '@/infrastructure/api/occupancyApi';
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

export const ResidentsListScreen = ({
  navigation,
}: RootScreenProps<'Residents'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canManage = hasPermission(user, 'residents.manage');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');

  const fetcher = useCallback(
    (cursor?: string) =>
      residentsApi.list({
        cursor,
        limit: 20,
        search: search.trim() || undefined,
        status: status === 'all' ? undefined : status,
      }),
    [search, status],
  );
  const list = useCursorList<Resident>(fetcher);

  const reloadRef = useRef(list.reload);
  reloadRef.current = list.reload;
  useEffect(() => navigation.addListener('focus', () => reloadRef.current()), [navigation]);

  return (
    <Screen>
      {canManage ? (
        <AppButton
          title="+ Register Resident"
          onPress={() => navigation.navigate('ResidentForm', {})}
        />
      ) : null}

      <AppTextInput
        label="Search"
        value={search}
        onChangeText={setSearch}
        placeholder="Name, phone or email"
        autoCapitalize="none"
      />
      <SelectChips
        label="Occupancy"
        options={[
          { label: 'All', value: 'all' },
          { label: 'Living in', value: 'active' },
          { label: 'Not placed', value: 'inactive' },
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
              title="No residents found"
              hint={canManage ? 'Register a resident to start the occupancy workflow.' : undefined}
            />
          }
          ListFooterComponent={
            list.loadingMore ? <ActivityIndicator color={colors.primary} /> : null
          }
          renderItem={({ item }) => (
            <ListItemCard
              title={item.fullName}
              subtitle={item.phoneNumber}
              badge={item.isActive ? 'Living in' : 'Not placed'}
              onPress={() => navigation.navigate('ResidentDetails', { id: item.id })}
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
