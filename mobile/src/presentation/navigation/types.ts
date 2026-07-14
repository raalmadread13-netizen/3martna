import type { NativeStackScreenProps } from '@react-navigation/native-stack';

/** Route params for the root stack. Extended per feature sprint. */
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- React Navigation requires a type alias (implicit index signature)
export type RootStackParamList = {
  Splash: undefined;
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  Home: undefined;
  Settings: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<
  RootStackParamList,
  T
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
