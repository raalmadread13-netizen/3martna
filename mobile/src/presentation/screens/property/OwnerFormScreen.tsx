import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { OwnerType } from '@/domain/entities/Property';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { ownersApi } from '@/infrastructure/api/propertyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { AppTextInput } from '@/presentation/components/ui/AppTextInput';
import { Screen } from '@/presentation/components/ui/Screen';
import { SelectChips } from '@/presentation/components/ui/SelectChips';
import { RootScreenProps } from '@/presentation/navigation/types';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

/** Create/Edit owner — edit mode when route params carry an owner. */
export const OwnerFormScreen = ({
  navigation,
  route,
}: RootScreenProps<'OwnerForm'>): React.JSX.Element => {
  const { colors } = useTheme();
  const editing = route.params?.owner ?? null;

  const [ownerType, setOwnerType] = useState<OwnerType>(editing?.ownerType ?? 'Individual');
  const [fullName, setFullName] = useState(editing?.fullName ?? '');
  const [companyName, setCompanyName] = useState(editing?.companyName ?? '');
  const [nationalId, setNationalId] = useState(editing?.nationalIdOrRegistration ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [phoneNumber, setPhoneNumber] = useState(editing?.phoneNumber ?? '');
  const [address, setAddress] = useState(editing?.address ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = (): boolean => {
    const errors: Record<string, string | undefined> = {
      fullName: fullName.trim().length < 2 ? 'Full name is required' : undefined,
      companyName:
        ownerType === 'Company' && companyName.trim().length < 2
          ? 'Company owners require a company name'
          : undefined,
    };
    setFieldErrors(errors);
    return !Object.values(errors).some(Boolean);
  };

  const submit = async (): Promise<void> => {
    setFormError(null);
    if (!validate()) return;
    setSaving(true);
    const body = {
      fullName: fullName.trim(),
      companyName: companyName.trim() || null,
      nationalIdOrRegistration: nationalId.trim() || null,
      email: email.trim() || null,
      phoneNumber: phoneNumber.trim() || null,
      address: address.trim() || null,
    };
    try {
      if (editing) {
        await ownersApi.update(editing.id, body);
      } else {
        await ownersApi.create({ ...body, ownerType });
      }
      navigation.goBack();
    } catch (error) {
      setFormError(apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={[styles.heading, { color: colors.text }]}>
        {editing ? 'Edit Owner' : 'New Owner'}
      </Text>

      {!editing ? (
        <SelectChips
          label="Owner type"
          options={[
            { label: 'Individual', value: 'Individual' },
            { label: 'Company', value: 'Company' },
          ]}
          selected={ownerType}
          onSelect={(value) => setOwnerType(value as OwnerType)}
          disabled={saving}
        />
      ) : null}

      <AppTextInput
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Owner or legal representative"
        error={fieldErrors.fullName}
        editable={!saving}
      />
      {ownerType === 'Company' ? (
        <AppTextInput
          label="Company name"
          value={companyName}
          onChangeText={setCompanyName}
          placeholder="Registered company name"
          error={fieldErrors.companyName}
          editable={!saving}
        />
      ) : null}
      <AppTextInput
        label="National ID / Registration (optional)"
        value={nationalId}
        onChangeText={setNationalId}
        autoCapitalize="characters"
        editable={!saving}
      />
      <AppTextInput
        label="Email (optional)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!saving}
      />
      <AppTextInput
        label="Phone (optional)"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
        placeholder="+9627XXXXXXXX"
        editable={!saving}
      />
      <AppTextInput
        label="Address (optional)"
        value={address}
        onChangeText={setAddress}
        editable={!saving}
      />

      {formError ? (
        <Text accessibilityRole="alert" style={[styles.formError, { color: colors.danger }]}>
          {formError}
        </Text>
      ) : null}

      <AppButton
        title={editing ? 'Save Changes' : 'Create Owner'}
        loading={saving}
        onPress={() => void submit()}
      />
      <AppButton title="Cancel" variant="ghost" disabled={saving} onPress={navigation.goBack} />
    </Screen>
  );
};

const styles = StyleSheet.create({
  heading: { fontSize: 22, fontWeight: '700', marginBottom: spacing.lg },
  formError: { fontSize: 14, textAlign: 'center', marginVertical: spacing.sm },
});
