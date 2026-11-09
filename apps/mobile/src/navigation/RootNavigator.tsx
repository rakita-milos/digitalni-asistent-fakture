import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { CustomerFormScreen } from '../screens/CustomerFormScreen';
import { CustomersScreen } from '../screens/CustomersScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { InvoicesScreen } from '../screens/InvoicesScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { useAuthStore } from '../state/authStore';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Invoices: undefined;
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

/** M-01 (prijava), M-11 (kupci) i privremeni Home dok ne dođu M-03/M-04. */
export function RootNavigator() {
  const status = useAuthStore((state) => state.status);

  if (status === 'loading') {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {status === 'signedIn' ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="Invoices"
              component={InvoicesScreen}
              options={{ headerShown: true, title: 'Fakture' }}
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
