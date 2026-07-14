import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { AppTextInput } from '@/presentation/components/ui/AppTextInput';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

/**
 * Placeholder — UI shell only.
 * Real authentication (API call, token storage, OTP) ships in the auth sprint.
 */
export const LoginScreen = ({ navigation }: RootScreenProps<'Login'>): React.JSX.Element => {
  const { colors } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: colors.text }]}>Welcome back</Text>
      <Text style={[styles.subheading, { color: colors.textMuted }]}>
        Sign in to manage your building
      </Text>

      <View style={styles.form}>
        <AppTextInput
          label="Email or phone"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <AppTextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />
        <AppButton title="Sign In" onPress={() => navigation.replace('Home')} />
        <AppButton
          title="Don't have an account? Register"
          variant="ghost"
          onPress={() => navigation.navigate('Register')}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  heading: { fontSize: 26, fontWeight: '700', marginTop: spacing.lg },
  subheading: { fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.xl },
  form: { gap: spacing.xs },
});
