import * as SecureStore from 'expo-secure-store';

/**
 * Encrypted key-value storage (Keychain / Android Keystore).
 * The only place tokens and sensitive preferences are persisted.
 */
export const appStorage = {
  get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  set(key: string, value: string): Promise<void> {
    return SecureStore.setItemAsync(key, value);
  },
  remove(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(key);
  },
};
