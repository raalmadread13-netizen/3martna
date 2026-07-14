import React from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '@/application/auth/AuthContext';
import { ForgotPasswordScreen } from '@/presentation/screens/ForgotPasswordScreen';
import { HomeScreen } from '@/presentation/screens/HomeScreen';
import { LoginScreen } from '@/presentation/screens/LoginScreen';
import { ProfileScreen } from '@/presentation/screens/ProfileScreen';
import { RegisterScreen } from '@/presentation/screens/RegisterScreen';
import { ResetPasswordScreen } from '@/presentation/screens/ResetPasswordScreen';
import { SettingsScreen } from '@/presentation/screens/SettingsScreen';
import { SplashScreen } from '@/presentation/screens/SplashScreen';
import { WelcomeScreen } from '@/presentation/screens/WelcomeScreen';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Auth-aware navigation: the mounted stack is decided by the session
 * state, so screens never navigate across the auth boundary themselves.
 */
export const RootNavigator = (): React.JSX.Element => {
  const { colors, isDark } = useTheme();
  const { status } = useAuth();

  if (status === 'loading') {
    // Session restore in progress — brand splash, no navigator yet
    return <SplashScreen />;
  }

  const navigationTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      primary: colors.primary,
      border: colors.border,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
        }}
      >
        {status === 'authenticated' ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: '3martna' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ title: 'Settings' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Welcome"
              component={WelcomeScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign In' }} />
            <Stack.Screen
              name="Register"
              component={RegisterScreen}
              options={{ title: 'Create Account' }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ title: 'Forgot Password' }}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
              options={{ title: 'Reset Password' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
