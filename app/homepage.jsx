import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AuthGuard from '../components/AuthGuard';
import useTheme from '../Theme/theme'; // ✅ Import your theme
import HomeTab from './tabs/HomeTab';

import NotificationTab from './tabs/NotificationTab'; // ✅ Import the new tab
import SettingTab from './tabs/SettingTab'; // ✅ Import the new tab
import UserTab from './tabs/UserTab';

const Tab = createBottomTabNavigator();

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
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeTab} />
      <Tab.Screen name="User" component={UserTab} />
      <Tab.Screen name="Setting" component={SettingTab} />
      <Tab.Screen name="Notifications" component={NotificationTab} />
    </Tab.Navigator>
  );
}

export default function Home() {
  return (
    <AuthGuard>
      <HomePageTabs />
    </AuthGuard>
  );
}
