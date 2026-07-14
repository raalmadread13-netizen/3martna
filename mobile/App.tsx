import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from '@/presentation/navigation/RootNavigator';
import { ThemeProvider, useTheme } from '@/presentation/theme/ThemeProvider';

const ThemedApp = (): React.JSX.Element => {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
};

export default function App(): React.JSX.Element {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}
