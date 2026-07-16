import React, { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { ResidencyType } from '@/domain/entities/Occupancy';
import { apiErrorMessage } from '@/infrastructure/api/client';
import { residentsApi } from '@/infrastructure/api/occupancyApi';
import { AppButton } from '@/presentation/components/ui/AppButton';
import { AppTextInput } from '@/presentation/components/ui/AppTextInput';
import { Screen } from '@/presentation/components/ui/Screen';
import { SelectChips } from '@/presentation/components/ui/SelectChips';
import { RootScreenProps } from '@/presentation/navigation/types';
import { spacing } from '@/presentation/theme/colors';
import { useTheme } from '@/presentation/theme/ThemeProvider';

const PHONE_PATTERN = /^\+?[0-9]{9,15}$/;

/** Register/Edit resident — edit mode when route params carry a resident. */
export const ResidentFormScreen = ({
  navigation,
  route,
}: RootScreenProps<'ResidentForm'>): React.JSX.Element => {
  const { colors } = useTheme();
  const editing = route.params?.resident ?? null;

  const [fullName, setFullName] = useState(editing?.fullName ?? '');
  const [phoneNumber, setPhoneNumber] = useState(editing?.phoneNumber ?? '');
  const [email, setEmail] = useState(editing?.email ?? '');
  const [residencyType, setResidencyType] = useState<ResidencyType>(
    editing?.residencyType ?? 'LeaseTenant',
  );
  const [emergencyName, setEmergencyName] = useState(editing?.emergencyContactName ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(editing?.emergencyContactPhone ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const validate = (): boolean => {
    const errors: Record<string, string | undefined> = {
      fullName: fullName.trim().length < 2 ? 'Full name is required' : undefined,
      phoneNumber: !PHONE_PATTERN.test(phoneNumber.trim())
        ? 'Valid international phone required'
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
      phoneNumber: phoneNumber.trim(),
      email: email.trim() || null,
      residencyType,
      emergencyContactName: emergencyName.trim() || null,
      emergencyContactPhone: emergencyPhone.trim() || null,
    };
    try {
      if (editing) {
        await residentsApi.update(editing.id, body);
      } else {
        await residentsApi.create(body);
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
        {editing ? 'Edit Resident' : 'Register Resident'}
      </Text>

      <AppTextInput
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        placeholder="As on the ID document"
        error={fieldErrors.fullName}
        editable={!saving}
      />
      <AppTextInput
        label="Phone"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
        placeholder="+9627XXXXXXXX"
        error={fieldErrors.phoneNumber}
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
      <SelectChips
        label="Residency type"
        options={[
          { label: 'Lease tenant', value: 'LeaseTenant' },
          { label: 'Owner occupant', value: 'OwnerOccupant' },
          { label: 'Family member', value: 'FamilyMember' },
        ]}
        selected={residencyType}
        onSelect={(value) => setResidencyType(value as ResidencyType)}
        disabled={saving}
      />
      <AppTextInput
        label="Emergency contact name (optional)"
        value={emergencyName}
        onChangeText={setEmergencyName}
        editable={!saving}
      />
      <AppTextInput
        label="Emergency contact phone (optional)"
        value={emergencyPhone}
        onChangeText={setEmergencyPhone}
        keyboardType="phone-pad"
        editable={!saving}
      />

      {formError ? (
        <Text accessibilityRole="alert" style={[styles.formError, { color: colors.danger }]}>
          {formError}
        </Text>
      ) : null}

      <AppButton
        title={editing ? 'Save Changes' : 'Register Resident'}
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
