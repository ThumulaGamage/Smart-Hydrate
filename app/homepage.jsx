import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AuthGuard from '../components/AuthGuard';
import useTheme from '../Theme/theme'; // ✅ Import your theme
import HomeTab from './tabs/HomeTab';
import NotificationTab from './tabs/NotificationTab'; // ✅ Import the new tab
import SettingTab from './tabs/SettingTab'; // ✅ Import the new tab
import UserTab from './tabs/UserTab';

const Tab = createBottomTabNavigator();

// Wrapper component to add scroll to each tab
function ScrollableTabWrapper({ children }) {
  const theme = useTheme();
  
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        bounces={true}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// Individual tab components wrapped with scroll
function ScrollableHomeTab() {
  return (
    <ScrollableTabWrapper>
      <HomeTab />
    </ScrollableTabWrapper>
  );
}

function ScrollableUserTab() {
  return (
    <ScrollableTabWrapper>
      <UserTab />
    </ScrollableTabWrapper>
  );
}

function ScrollableSettingTab() {
  return (
    <ScrollableTabWrapper>
      <SettingTab />
    </ScrollableTabWrapper>
  );
}

function ScrollableNotificationTab() {
  return (
    <ScrollableTabWrapper>
      <NotificationTab />
    </ScrollableTabWrapper>
  );
}

function HomePageTabs() {
  const theme = useTheme(); // ✅ Use your theme

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = 'home-outline'; // changed icon to represent home
          } else if (route.name === 'User') {
            iconName = 'person-circle-outline';
          } else if (route.name === 'Setting') {
            iconName = 'settings-outline';
          } else if (route.name === 'Notifications') {
            iconName = 'notifications-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted || 'gray',
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border || '#ccc',
          elevation: 8, // Android shadow
          shadowColor: '#000', // iOS shadow
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        headerShown: false,
        tabBarHideOnKeyboard: true, // Hide tab bar when keyboard is open
      })}
    >
      <Tab.Screen name="Home" component={ScrollableHomeTab} />
      <Tab.Screen name="User" component={ScrollableUserTab} />
      <Tab.Screen name="Setting" component={ScrollableSettingTab} />
      <Tab.Screen name="Notifications" component={ScrollableNotificationTab} />
    </Tab.Navigator>
  );
}

export default function Home() {
  return (
    <SafeAreaProvider>
      <AuthGuard>
        <HomePageTabs />
      </AuthGuard>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20, // Extra padding at bottom for better scroll experience
  },
});