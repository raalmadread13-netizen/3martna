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
import { isRequired } from '@/shared/utils/validators';

export const ForgotPasswordScreen = ({
  navigation,
}: RootScreenProps<'ForgotPassword'>): React.JSX.Element => {
  const { colors } = useTheme();
  const [identifier, setIdentifier] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    const error = isRequired(identifier);
    setFieldError(error);
    setFormError(null);
    if (error) return;

    setLoading(true);
    try {
      const result = await authApi.forgotPassword(identifier.trim());
      setSent(true);
      setDevCode(result.data?.devCode ?? null);
    } catch (requestError) {
      setFormError(apiErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: colors.text }]}>Forgot your password?</Text>
      <Text style={[styles.subheading, { color: colors.textMuted }]}>
        Enter your email or phone number and we'll send you a 6-digit reset code.
      </Text>

      {sent ? (
        <View
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.cardTitle, { color: colors.success }]}>✓ Code sent</Text>
          <Text style={[styles.cardBody, { color: colors.textMuted }]}>
            If the account exists, a reset code is on its way. It is valid for a limited time.
          </Text>
          {devCode ? (
            <Text style={[styles.devCode, { color: colors.accent }]}>DEV code: {devCode}</Text>
          ) : null}
          <AppButton
            title="Enter reset code"
            onPress={() => navigation.navigate('ResetPassword', { identifier: identifier.trim() })}
          />
        </View>
      ) : (
        <View style={styles.form}>
          <AppTextInput
            label="Email or phone"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
            error={fieldError}
            editable={!loading}
          />
          {formError ? (
            <Text accessibilityRole="alert" style={[styles.formError, { color: colors.danger }]}>
              {formError}
            </Text>
          ) : null}
          <AppButton title="Send reset code" onPress={() => void submit()} loading={loading} />
        </View>
      )}
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
  devCode: { fontSize: 14, fontWeight: '700' },
});
