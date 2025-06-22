import { Feather, FontAwesome, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import useTheme from '../../Theme/theme';
import ThemedText from '../../components/ThemedText';
import ThemedView from '../../components/ThemedView';

export default function SettingsTab() {
  const router = useRouter();
  const theme = useTheme();

  const settingsSections = [
    {
      title: "Account",
      items: [
        {
          title: "Profile Information",
          icon: <Ionicons name="person" size={22} color={theme.icon || theme.text} />,
          action: () => router.push('/account/edit')
        },
        {
          title: "Security",
          icon: <MaterialIcons name="security" size={22} color={theme.icon || theme.text} />,
          action: () => router.push('/account/security')
        },
        {
          title: "Connected Apps",
          icon: <Ionicons name="link" size={22} color={theme.icon || theme.text} />,
          action: () => router.push('/account/connections')
        }
      ]
    },
    {
      title: "Preferences",
      items: [
        {
          title: "Notifications",
          icon: <Ionicons name="notifications" size={22} color={theme.icon || theme.text} />,
          action: () => router.push('/account/notifications')
        },
        {
          title: "Appearance",
          icon: <Feather name="moon" size={22} color={theme.icon || theme.text} />,
          action: () => router.push('/account/appearance')
        },
        {
          title: "Language",
          icon: <Ionicons name="language" size={22} color={theme.icon || theme.text} />,
          action: () => router.push('/account/language')
        }
      ]
    },
    {
      title: "Support",
      items: [
        {
          title: "Help Center",
          icon: <Ionicons name="help-circle" size={22} color={theme.icon || theme.text} />,
          action: () => router.push('/account/help')
        },
        {
          title: "Contact Us",
          icon: <FontAwesome name="headphones" size={22} color={theme.icon || theme.text} />,
          action: () => router.push('/account/contact')
        },
        {
          title: "About",
          icon: <Ionicons name="information-circle" size={22} color={theme.icon || theme.text} />,
          action: () => router.push('/account/about')
        }
      ]
    }
  ];

  return (
    <ThemedView style={styles.container}>
      {/* Modern Header without Back Button */}
      <View style={[styles.headerContainer, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.background }]}>
          <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
            Settings
          </ThemedText>
        </View>
      </View>

      {/* Modern Settings List with Sections */}
      <View style={styles.content}>
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.secondaryText }]}>
              {section.title}
            </ThemedText>
            
            <View style={[styles.sectionItems, { backgroundColor: theme.card }]}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={itemIndex}
                  onPress={item.action}
                  style={[
                    styles.optionItem,
                    itemIndex !== section.items.length - 1 && { 
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border 
                    }
                  ]}
                  activeOpacity={0.7}
                >
                  <View style={styles.optionIcon}>
                    {item.icon}
                  </View>
                  <ThemedText style={[styles.optionText, { color: theme.text }]}>
                    {item.title}
                  </ThemedText>
                  <Ionicons 
                    name="chevron-forward" 
                    size={18} 
                    color={theme.secondaryText} 
                    style={styles.optionChevron}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>

      {/* Modern Footer with App Info */}
      <View style={styles.footer}>
        <ThemedText style={[styles.versionText, { color: theme.secondaryText }]}>
          v1.2.8 • Build 428
        </ThemedText>
        <ThemedText style={[styles.copyrightText, { color: theme.secondaryText }]}>
          © 2023 YourApp Inc.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    paddingTop: 50, // Added safe area padding at the top
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
    paddingTop: 8, // Reduced top padding since we have headerContainer padding
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  sectionItems: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  optionIcon: {
    width: 24,
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    flex: 1,
    fontSize: 16,
  },
  optionChevron: {
    marginLeft: 8,
  },
  footer: {
    padding: 20,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
  },
});