import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/application/auth/AuthContext';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { AppTextInput } from '@/presentation/components/ui/AppTextInput';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { isRequired } from '@/shared/utils/validators';

export const LoginScreen = ({ navigation }: RootScreenProps<'Login'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { login } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ identifier?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    const errors = {
      identifier: isRequired(identifier),
      password: isRequired(password),
    };
    setFieldErrors(errors);
    setFormError(null);
    if (errors.identifier || errors.password) return;

    setLoading(true);
    try {
      await login(identifier.trim(), password);
      // Success: RootNavigator switches to the authenticated stack
    } catch (error) {
      setFormError(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

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
          placeholder="you@example.com or +9627XXXXXXXX"
          error={fieldErrors.identifier}
          editable={!loading}
        />
        <AppTextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          error={fieldErrors.password}
          editable={!loading}
        />

        {formError ? (
          <Text accessibilityRole="alert" style={[styles.formError, { color: colors.danger }]}>
            {formError}
          </Text>
        ) : null}

        <AppButton title="Sign In" onPress={() => void submit()} loading={loading} />
        <AppButton
          title="Forgot password?"
          variant="ghost"
          onPress={() => navigation.navigate('ForgotPassword')}
          disabled={loading}
        />
        <AppButton
          title="Don't have an account? Register"
          variant="ghost"
          onPress={() => navigation.navigate('Register')}
          disabled={loading}
        />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  heading: { fontSize: 26, fontWeight: '700', marginTop: spacing.lg },
  subheading: { fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.xl },
  form: { gap: spacing.xs },
  formError: { fontSize: 14, textAlign: 'center', marginVertical: spacing.sm },
});
