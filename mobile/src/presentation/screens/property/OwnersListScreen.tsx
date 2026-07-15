import React, { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { usePagedList } from '@/application/property/usePagedList';
import { Owner } from '@/domain/entities/Property';
import { ownersApi } from '@/infrastructure/api/propertyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { EmptyState } from '@/presentation/components/ui/EmptyState';
import { ListItemCard } from '@/presentation/components/ui/ListItemCard';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { hasPermission } from '@/shared/utils/permissions';

export const OwnersListScreen = ({ navigation }: RootScreenProps<'Owners'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const canManage = hasPermission(user, 'owners.manage');

  const fetcher = useCallback((page: number) => ownersApi.list(page), []);
  const list = usePagedList<Owner>(fetcher);

  const reloadRef = useRef(list.reload);
  reloadRef.current = list.reload;
  useEffect(() => navigation.addListener('focus', () => reloadRef.current()), [navigation]);

  return (
    <Screen>
      {canManage ? (
        <AppButton title="+ Add Owner" onPress={() => navigation.navigate('OwnerForm', {})} />
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
              title="No owners yet"
              hint={canManage ? 'Register apartment owners to assign them to units.' : undefined}
            />
          }
          ListFooterComponent={
            list.loadingMore ? <ActivityIndicator color={colors.primary} /> : null
          }
          renderItem={({ item }) => (
            <ListItemCard
              title={item.fullName}
              subtitle={item.companyName ?? item.email ?? item.phoneNumber}
              badge={item.ownerType}
              onPress={() => navigation.navigate('OwnerDetails', { id: item.id })}
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
