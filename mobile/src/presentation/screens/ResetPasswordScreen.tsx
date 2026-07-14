import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { authApi } from '@/infrastructure/api/authApi';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { AppTextInput } from '@/presentation/components/ui/AppTextInput';
import { Screen } from '@/presentation/components/ui/Screen';
import { RootScreenProps } from '@/presentation/navigation/types';
import { radius, spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';
import { isRequired, isStrongPassword, matches } from '@/shared/utils/validators';

export const ResetPasswordScreen = ({
  navigation,
  route,
}: RootScreenProps<'ResetPassword'>): React.JSX.Element => {
  const { colors } = useTheme();
  const [identifier, setIdentifier] = useState(route.params?.identifier ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (): Promise<void> => {
    const errors = {
      identifier: isRequired(identifier),
      code: /^\d{6}$/.test(code) ? undefined : 'Enter the 6-digit code',
      password: isStrongPassword(password),
      confirmPassword: matches(password)(confirmPassword),
    };
    setFieldErrors(errors);
    setFormError(null);
    if (Object.values(errors).some(Boolean)) return;

    setLoading(true);
    try {
      await authApi.resetPassword(identifier.trim(), code, password);
      setDone(true);
    } catch (error) {
      setFormError(apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <Screen>
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.cardTitle, { color: colors.success }]}>✓ Password reset</Text>
          <Text style={[styles.cardBody, { color: colors.textMuted }]}>
            Your password has been changed and all previous sessions were signed out. Sign in with
            your new password.
          </Text>
          <AppButton title="Go to sign in" onPress={() => navigation.navigate('Login')} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: colors.text }]}>Reset your password</Text>
      <Text style={[styles.subheading, { color: colors.textMuted }]}>
        Enter the 6-digit code you received and choose a new password.
      </Text>

      <View style={styles.form}>
        <AppTextInput
          label="Email or phone"
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          error={fieldErrors.identifier}
          editable={!loading}
        />
        <AppTextInput
          label="Reset code"
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          placeholder="123456"
          error={fieldErrors.code}
          editable={!loading}
        />
        <AppTextInput
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="8+ chars, upper & lower case, digit"
          error={fieldErrors.password}
          editable={!loading}
        />
        <AppTextInput
          label="Confirm new password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          error={fieldErrors.confirmPassword}
          editable={!loading}
        />

        {formError ? (
          <Text accessibilityRole="alert" style={[styles.formError, { color: colors.danger }]}>
            {formError}
          </Text>
        ) : null}

        <AppButton title="Reset password" onPress={() => void submit()} loading={loading} />
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  heading: { fontSize: 26, fontWeight: '700', marginTop: spacing.lg },
  subheading: { fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.xl, lineHeight: 21 },
  form: { gap: spacing.xs },
  formError: { fontSize: 14, textAlign: 'center', marginVertical: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm },
  cardTitle: { fontSize: 18, fontWeight: '600' },
  cardBody: { fontSize: 14, lineHeight: 21 },
});
