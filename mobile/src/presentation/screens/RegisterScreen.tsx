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
 * Real registration (validation, OTP verification, API) ships in the auth sprint.
 */
export const RegisterScreen = ({ navigation }: RootScreenProps<'Register'>): React.JSX.Element => {
  const { colors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: colors.text }]}>Create your account</Text>
      <Text style={[styles.subheading, { color: colors.textMuted }]}>
        Join your building community
      </Text>

      <View style={styles.form}>
        <AppTextInput
          label="Full name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your name"
        />
        <AppTextInput
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+9627XXXXXXXX"
        />
        <AppTextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="At least 8 characters"
        />
        <AppButton title="Create Account" onPress={() => navigation.replace('Home')} />
        <AppButton
          title="Already have an account? Sign in"
          variant="ghost"
          onPress={() => navigation.navigate('Login')}
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
