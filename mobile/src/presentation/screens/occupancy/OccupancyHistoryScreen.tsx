import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { useCursorList } from '@/application/occupancy/useCursorList';
import { OccupancyRecord } from '@/domain/entities/Occupancy';
import { occupancyApi } from '@/infrastructure/api/occupancyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { EmptyState } from '@/presentation/components/ui/EmptyState';
import { ListItemCard } from '@/presentation/components/ui/ListItemCard';
import { Screen } from '@/presentation/components/ui/Screen';
import { SelectChips } from '@/presentation/components/ui/SelectChips';
import { RootScreenProps } from '@/presentation/navigation/types';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { hasPermission } from '@/shared/utils/permissions';

/** Every stay ever recorded, newest first. Move-outs never delete rows. */
export const OccupancyHistoryScreen = ({
  navigation,
  route,
}: RootScreenProps<'OccupancyHistory'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canMove = hasPermission(user, 'occupancy.manage');
  const apartmentId = route.params?.apartmentId;
  const residentId = route.params?.residentId;

  const [filter, setFilter] = useState<'all' | 'active' | 'closed'>('all');

  const fetcher = useCallback(
    (cursor?: string) =>
      occupancyApi.list({
        cursor,
        limit: 20,
        apartmentId,
        residentId,
        active: filter === 'all' ? undefined : filter === 'active',
      }),
    [apartmentId, residentId, filter],
  );
  const list = useCursorList<OccupancyRecord>(fetcher);

  const reloadRef = useRef(list.reload);
  reloadRef.current = list.reload;
  useEffect(() => navigation.addListener('focus', () => reloadRef.current()), [navigation]);

  return (
    <Screen>
      {canMove ? (
        <>
          <AppButton
            title="Move-In Wizard"
            onPress={() => navigation.navigate('MoveInWizard', {})}
          />
          <AppButton
            title="Move-Out Wizard"
            variant="secondary"
            onPress={() => navigation.navigate('MoveOutWizard', {})}
          />
        </>
      ) : null}

      <SelectChips
        label="Show"
        options={[
          { label: 'All stays', value: 'all' },
          { label: 'Current', value: 'active' },
          { label: 'Ended', value: 'closed' },
        ]}
        selected={filter}
        onSelect={(value) => setFilter(value as typeof filter)}
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
          ListEmptyComponent={<EmptyState title="No occupancy records yet" />}
          ListFooterComponent={
            list.loadingMore ? <ActivityIndicator color={colors.primary} /> : null
          }
          renderItem={({ item }) => (
            <ListItemCard
              title={`${item.moveInDate.slice(0, 10)} → ${
                item.moveOutDate ? item.moveOutDate.slice(0, 10) : 'present'
              }`}
              subtitle={item.moveOutReason}
              badge={item.isActive ? 'Current' : 'Ended'}
              onPress={
                canMove && item.isActive
                  ? () => navigation.navigate('MoveOutWizard', { occupancyId: item.id })
                  : undefined
              }
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
