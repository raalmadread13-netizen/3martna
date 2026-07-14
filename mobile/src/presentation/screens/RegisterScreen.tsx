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
import { isEmail, isPhone, isRequired, isStrongPassword, matches } from '@/shared/utils/validators';

interface FormState {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  password: string;
  confirmPassword: string;
}

const EMPTY: FormState = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export const RegisterScreen = ({ navigation }: RootScreenProps<'Register'>): React.JSX.Element => {
  const { colors } = useTheme();
  const { register } = useAuth();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Partial<FormState>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof FormState) => (value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const submit = async (): Promise<void> => {
    const errors: Partial<FormState> = {
      firstName: isRequired(form.firstName),
      lastName: isRequired(form.lastName),
      phoneNumber: isRequired(form.phoneNumber) ?? isPhone(form.phoneNumber),
      email: form.email ? isEmail(form.email) : undefined,
      password: isStrongPassword(form.password),
      confirmPassword: matches(form.password)(form.confirmPassword),
    };
    setFieldErrors(errors);
    setFormError(null);
    if (Object.values(errors).some(Boolean)) return;

    setLoading(true);
    try {
      await register({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        phoneNumber: form.phoneNumber.trim(),
        email: form.email.trim() || undefined,
        password: form.password,
      });
      // Success: RootNavigator switches to the authenticated stack
    } catch (error) {
      setFormError(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: colors.text }]}>Create your account</Text>
      <Text style={[styles.subheading, { color: colors.textMuted }]}>
        Join your building community
      </Text>

      <View style={styles.form}>
        <AppTextInput
          label="First name"
          value={form.firstName}
          onChangeText={set('firstName')}
          error={fieldErrors.firstName}
          editable={!loading}
        />
        <AppTextInput
          label="Last name"
          value={form.lastName}
          onChangeText={set('lastName')}
          error={fieldErrors.lastName}
          editable={!loading}
        />
        <AppTextInput
          label="Phone number"
          value={form.phoneNumber}
          onChangeText={set('phoneNumber')}
          keyboardType="phone-pad"
          placeholder="+9627XXXXXXXX"
          error={fieldErrors.phoneNumber}
          editable={!loading}
        />
        <AppTextInput
          label="Email (optional)"
          value={form.email}
          onChangeText={set('email')}
          autoCapitalize="none"
          keyboardType="email-address"
          error={fieldErrors.email}
          editable={!loading}
        />
        <AppTextInput
          label="Password"
          value={form.password}
          onChangeText={set('password')}
          secureTextEntry
          placeholder="8+ chars, upper & lower case, digit"
          error={fieldErrors.password}
          editable={!loading}
        />
        <AppTextInput
          label="Confirm password"
          value={form.confirmPassword}
          onChangeText={set('confirmPassword')}
          secureTextEntry
          error={fieldErrors.confirmPassword}
          editable={!loading}
        />

        {formError ? (
          <Text accessibilityRole="alert" style={[styles.formError, { color: colors.danger }]}>
            {formError}
          </Text>
        ) : null}

        <AppButton title="Create Account" onPress={() => void submit()} loading={loading} />
        <AppButton
          title="Already have an account? Sign in"
          variant="ghost"
          onPress={() => navigation.navigate('Login')}
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
