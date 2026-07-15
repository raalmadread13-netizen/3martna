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
import { ApartmentDetailsScreen } from '@/presentation/screens/property/ApartmentDetailsScreen';
import { ApartmentFormScreen } from '@/presentation/screens/property/ApartmentFormScreen';
import { ApartmentsListScreen } from '@/presentation/screens/property/ApartmentsListScreen';
import { BuildingDetailsScreen } from '@/presentation/screens/property/BuildingDetailsScreen';
import { BuildingFormScreen } from '@/presentation/screens/property/BuildingFormScreen';
import { BuildingsListScreen } from '@/presentation/screens/property/BuildingsListScreen';
import { OwnerDetailsScreen } from '@/presentation/screens/property/OwnerDetailsScreen';
import { OwnerFormScreen } from '@/presentation/screens/property/OwnerFormScreen';
import { OwnersListScreen } from '@/presentation/screens/property/OwnersListScreen';
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
            <Stack.Screen
              name="Buildings"
              component={BuildingsListScreen}
              options={{ title: 'Buildings' }}
            />
            <Stack.Screen
              name="BuildingDetails"
              component={BuildingDetailsScreen}
              options={{ title: 'Building' }}
            />
            <Stack.Screen
              name="BuildingForm"
              component={BuildingFormScreen}
              options={{ title: 'Building' }}
            />
            <Stack.Screen
              name="Apartments"
              component={ApartmentsListScreen}
              options={{ title: 'Apartments' }}
            />
            <Stack.Screen
              name="ApartmentDetails"
              component={ApartmentDetailsScreen}
              options={{ title: 'Apartment' }}
            />
            <Stack.Screen
              name="ApartmentForm"
              component={ApartmentFormScreen}
              options={{ title: 'Apartment' }}
            />
            <Stack.Screen
              name="Owners"
              component={OwnersListScreen}
              options={{ title: 'Owners' }}
            />
            <Stack.Screen
              name="OwnerDetails"
              component={OwnerDetailsScreen}
              options={{ title: 'Owner' }}
            />
            <Stack.Screen
              name="OwnerForm"
              component={OwnerFormScreen}
              options={{ title: 'Owner' }}
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
