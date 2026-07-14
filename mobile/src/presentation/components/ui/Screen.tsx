import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

interface ScreenProps {
  children: React.ReactNode;
  /** Scrollable content (forms, lists of cards). */
  scroll?: boolean;
  style?: ViewStyle;
}

/** Themed safe-area wrapper used by every screen. */
export const Screen = ({ children, scroll = false, style }: ScreenProps): React.JSX.Element => {
  const { colors } = useTheme();
  const container = [styles.container, { backgroundColor: colors.background }, style];

  if (scroll) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
        <ScrollView contentContainerStyle={container} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.flex, ...container]}>{children}</View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: spacing.md },
});
