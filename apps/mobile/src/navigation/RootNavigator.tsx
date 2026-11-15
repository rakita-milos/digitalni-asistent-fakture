import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AccountScreen } from '../screens/AccountScreen';
import { CustomerFormScreen } from '../screens/CustomerFormScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { InvoiceDetailScreen } from '../screens/InvoiceDetailScreen';
import { InvoiceFormScreen } from '../screens/InvoiceFormScreen';
import { InvoicesScreen } from '../screens/InvoicesScreen';
import { LockScreen } from '../screens/LockScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RemindersScreen } from '../screens/RemindersScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SetupScreen } from '../screens/setup/SetupScreen';
import { useAuthStore } from '../state/authStore';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Setup: undefined;
  Reminders: undefined;
  Settings: undefined;
  Account: undefined;
  Invoices: undefined;
  InvoiceForm: { invoiceId?: string } | undefined;
  InvoiceDetail: { invoiceId: string; notice?: string };
  Customers: undefined;
  CustomerForm: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <ActivityIndicator size="large" color="#1D4ED8" />
    </View>
  );
}

/** M-01 (prijava i biometrijsko otključavanje), M-03 (početna), M-04/M-05/M-08 (fakture), M-11 (kupci), M-12 (nalog). */
export function RootNavigator() {
  const status = useAuthStore((state) => state.status);

  if (status === 'loading') {
    return <SplashScreen />;
  }

  if (status === 'locked') {
    return <LockScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'signedIn' ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="Setup"
              component={SetupScreen}
              options={{ headerShown: true, title: 'Postavljanje firme' }}
            />
            <Stack.Screen
              name="Reminders"
              component={RemindersScreen}
              options={{ headerShown: true, title: 'Podsjetnici' }}
            />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ headerShown: true, title: 'Podešavanja' }}
            />
            <Stack.Screen
              name="Account"
              component={AccountScreen}
              options={{ headerShown: true, title: 'Nalog' }}
            />
            <Stack.Screen
              name="Invoices"
              component={InvoicesScreen}
              options={{ headerShown: true, title: 'Fakture' }}
            />
            <Stack.Screen
              name="InvoiceForm"
              component={InvoiceFormScreen}
              options={{ headerShown: true, title: 'Nova faktura' }}
            />
            <Stack.Screen
              name="InvoiceDetail"
              component={InvoiceDetailScreen}
              options={{ headerShown: true, title: 'Faktura' }}
            />
            <Stack.Screen
              name="Customers"
              component={CustomersScreen}
              options={{ headerShown: true, title: 'Kupci' }}
            />
            <Stack.Screen
              name="CustomerForm"
              component={CustomerFormScreen}
              options={{ headerShown: true, title: 'Novi kupac' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB' },
});
