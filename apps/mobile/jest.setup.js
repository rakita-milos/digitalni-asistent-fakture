// Globalni mock native modula koji nemaju JS fallback u Jest-u.
// Pojedini testovi (npr. biometricSession.test.ts) ga dodatno preciziraju.
jest.mock('react-native-keychain', () => ({
  getSupportedBiometryType: jest.fn(async () => null),
  hasGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => false),
  getGenericPassword: jest.fn(async () => false),
  resetGenericPassword: jest.fn(async () => true),
  ACCESS_CONTROL: { BIOMETRY_ANY: 'BiometryAny' },
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'AccessibleWhenUnlockedThisDeviceOnly' },
  BIOMETRY_TYPE: { FINGERPRINT: 'Fingerprint', FACE: 'Face' },
  STORAGE_TYPE: { AES_GCM: 'KeystoreAESGCM' },
}));
