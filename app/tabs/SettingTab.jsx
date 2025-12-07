import { Feather, FontAwesome, Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
} from 'react-native';
import { ref, onValue, update } from 'firebase/database';
import useTheme from '../../Theme/theme';
import ThemedText from '../../components/ThemedText';
import ThemedView from '../../components/ThemedView';
import { auth } from '../../config/firebaseConfig';

// Graceful notification import
let Notifications = null;
let notificationsAvailable = false;

try {
  Notifications = require('expo-notifications');
  notificationsAvailable = true;
} catch (error) {
  console.log('⚠️ Notifications not available in SettingsTab');
}

// Initialize database
let database;
try {
  const { getDatabase } = require('firebase/database');
  database = getDatabase(auth.app);
} catch (e) {
  console.error("Failed to initialize database:", e);
}

export default function SettingsTab() {
  const router = useRouter();
  const theme = useTheme();

  // State for preferences
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState('auto');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [userId, setUserId] = useState(null);

  // Modal states
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Authentication
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load push notification setting from Firebase
  useEffect(() => {
    if (!userId || !database) return;

    const settingsRef = ref(database, `users/${userId}/settings`);
    const unsubscribe = onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        if (data.pushNotifications !== undefined) {
          setPushNotifications(data.pushNotifications);
        }
      }
    });

    return () => unsubscribe();
  }, [userId]);

  const languages = [
    { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
    { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
    { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
    { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
    { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
    { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  ];

  const themeOptions = [
    { id: 'light', title: 'Light', icon: 'sunny-outline', description: 'Always use light mode' },
    { id: 'dark', title: 'Dark', icon: 'moon-outline', description: 'Always use dark mode' },
    { id: 'auto', title: 'Automatic', icon: 'phone-portrait-outline', description: 'Follow system settings' },
  ];

  const handlePushNotificationToggle = async (value) => {
    setPushNotifications(value);

    if (!userId || !database) return;

    try {
      // Update Firebase settings
      await update(ref(database, `users/${userId}/settings`), {
        pushNotifications: value,
      });

      if (!value) {
        // Cancel all scheduled notifications
        if (notificationsAvailable) {
          await Notifications.cancelAllScheduledNotificationsAsync();
          console.log('🔕 All notifications cancelled');
        }

        // Update both profile notification settings
        await update(ref(database, `users/${userId}/profile`), {
          notificationsEnabled: false,
        });
        await update(ref(database, `users/${userId}/diseaseProfile`), {
          notificationsEnabled: false,
        });

        Alert.alert(
          "Push Notifications Disabled",
          "All hydration reminders have been turned off. You can re-enable them anytime.",
          [{ text: "OK" }]
        );
      } else {
        Alert.alert(
          "Push Notifications Enabled",
          "Go to the Notification tab to set up your hydration reminders.",
          [{ text: "OK" }]
        );
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      Alert.alert(
        "Error",
        "Failed to update notification settings. Please try again.",
        [{ text: "OK" }]
      );
    }
  };

  const handleConnectedApps = useCallback(() => {
    Alert.alert(
      'Connected Apps',
      'Manage your connected third-party applications and services.',
      [
        { text: 'View Apps', onPress: () => console.log('Navigate to connected apps') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, []);

  const handleHelpCenter = useCallback(() => {
    Alert.alert(
      'Help Center',
      'What do you need help with?',
      [
        { text: 'FAQ', onPress: () => console.log('Open FAQ') },
        { text: 'Tutorials', onPress: () => console.log('Open Tutorials') },
        { text: 'Contact Support', onPress: () => handleContactUs() },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, []);

  const handleContactUs = useCallback(() => {
    Alert.alert(
      'Contact Us',
      'How would you like to reach us?',
      [
        { text: 'Email', onPress: () => Linking.openURL('mailto:support@yourapp.com') },
        { text: 'Phone', onPress: () => Linking.openURL('tel:+1234567890') },
        { text: 'Live Chat', onPress: () => console.log('Opening chat...') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, []);

  const getLanguageName = useCallback((code) => {
    return languages.find(l => l.code === code)?.name || 'English';
  }, []);

  const getThemeName = useCallback((mode) => {
    return themeOptions.find(t => t.id === mode)?.title || 'Automatic';
  }, []);

  const handleThemeSelection = useCallback((themeId) => {
    setSelectedTheme(themeId);
    setShowThemeModal(false);
  }, []);

  const handleLanguageSelection = useCallback((languageCode) => {
    setSelectedLanguage(languageCode);
    setShowLanguageModal(false);
  }, []);

  const settingsSections = useMemo(() => [
    {
      title: "Account",
      items: [
        {
          title: "Profile Information",
          icon: <Ionicons name="person-outline" size={22} color={theme.icon || theme.text} />,
          action: () => router.push('/account/edit'),
          type: 'navigation'
        },
        {
          title: "Security",
          icon: <MaterialIcons name="security" size={22} color={theme.icon || theme.text} />,
          action: () => router.push('/account/security'),
          type: 'navigation'
        },
     
      ]
    },
    {
      title: "Preferences",
      items: [
        {
          title: "Push Notifications",
          subtitle: "Receive app notifications",
          icon: <Ionicons name="notifications-outline" size={22} color={theme.icon || theme.text} />,
          type: 'toggle',
          value: pushNotifications,
          onToggle: handlePushNotificationToggle
        },
     
        {
          title: "Appearance",
          subtitle: getThemeName(selectedTheme),
          icon: <Feather name="moon" size={22} color={theme.icon || theme.text} />,
          action: () => setShowThemeModal(true),
          type: 'selection'
        },
        {
          title: "Language",
          subtitle: getLanguageName(selectedLanguage),
          icon: <Ionicons name="language-outline" size={22} color={theme.icon || theme.text} />,
          action: () => setShowLanguageModal(true),
          type: 'selection'
        }
      ]
    },
    {
      title: "Support",
      items: [
        {
          title: "Help Center",
          icon: <Ionicons name="help-circle-outline" size={22} color={theme.icon || theme.text} />,
          action: handleHelpCenter,
          type: 'navigation'
        },
        {
          title: "Contact Us",
          icon: <FontAwesome name="headphones" size={22} color={theme.icon || theme.text} />,
          action: handleContactUs,
          type: 'navigation'
        },
        {
          title: "About",
          icon: <Ionicons name="information-circle-outline" size={22} color={theme.icon || theme.text} />,
          action: () => setShowAboutModal(true),
          type: 'navigation'
        }
      ]
    }
  ], [theme, pushNotifications, emailNotifications, selectedTheme, selectedLanguage, router, handleConnectedApps, handleHelpCenter, handleContactUs, getLanguageName, getThemeName, handlePushNotificationToggle]);

  const renderSettingItem = useCallback((item, itemIndex, sectionItemsLength) => {
    const isLastItem = itemIndex === sectionItemsLength - 1;
    
    return (
      <TouchableOpacity
        key={itemIndex}
        onPress={item.type === 'toggle' ? undefined : item.action}
        style={[
          styles.optionItem,
          !isLastItem && { 
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: theme.border || 'rgba(0,0,0,0.1)'
          }
        ]}
        activeOpacity={item.type === 'toggle' ? 1 : 0.7}
        disabled={item.type === 'toggle'}
      >
        <View style={styles.optionIcon}>
          {item.icon}
        </View>
        
        <View style={styles.optionContent}>
          <ThemedText style={[styles.optionText, { color: theme.text }]}>
            {item.title}
          </ThemedText>
          {item.subtitle && (
            <ThemedText style={[styles.optionSubtitle, { color: theme.secondaryText || '#666' }]}>
              {item.subtitle}
            </ThemedText>
          )}
        </View>

        {item.type === 'toggle' ? (
          <Switch
            value={item.value}
            onValueChange={item.onToggle}
            trackColor={{ false: '#E5E5EA', true: theme.primary || '#007AFF' }}
            thumbColor={item.value ? '#FFFFFF' : '#FFFFFF'}
            ios_backgroundColor="#E5E5EA"
          />
        ) : (
          <Ionicons 
            name="chevron-forward" 
            size={18} 
            color={theme.secondaryText || '#999'} 
            style={styles.optionChevron}
          />
        )}
      </TouchableOpacity>
    );
  }, [theme]);

  const renderThemeOption = useCallback(({ item }) => {
    const isSelected = selectedTheme === item.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.modalOption,
          isSelected && {
            backgroundColor: theme.primary ? `${theme.primary}20` : 'rgba(0, 122, 255, 0.2)'
          }
        ]}
        onPress={() => handleThemeSelection(item.id)}
      >
        <View style={styles.themeOptionContent}>
          <View style={styles.themeOptionHeader}>
            <Ionicons 
              name={item.icon} 
              size={22} 
              color={isSelected ? theme.primary : (theme.icon || theme.text)}
              style={styles.modalOptionIcon}
            />
            <ThemedText style={[
              styles.modalOptionText, 
              { color: isSelected ? theme.primary : theme.text }
            ]}>
              {item.title}
            </ThemedText>
          </View>
          <ThemedText style={[styles.themeOptionDescription, { color: theme.secondaryText }]}>
            {item.description}
          </ThemedText>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={theme.primary || '#007AFF'} />
        )}
      </TouchableOpacity>
    );
  }, [selectedTheme, theme, handleThemeSelection]);

  const renderLanguageOption = useCallback(({ item }) => {
    const isSelected = selectedLanguage === item.code;
    
    return (
      <TouchableOpacity
        style={[
          styles.modalOption,
          isSelected && {
            backgroundColor: theme.primary ? `${theme.primary}20` : 'rgba(0, 122, 255, 0.2)'
          }
        ]}
        onPress={() => handleLanguageSelection(item.code)}
      >
        <ThemedText style={styles.modalOptionFlag}>
          {item.flag}
        </ThemedText>
        <View style={styles.languageOptionContent}>
          <ThemedText style={[
            styles.modalOptionText, 
            { color: isSelected ? theme.primary : theme.text }
          ]}>
            {item.name}
          </ThemedText>
          <ThemedText style={[styles.languageNative, { color: theme.secondaryText }]}>
            {item.nativeName}
          </ThemedText>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={theme.primary || '#007AFF'} />
        )}
      </TouchableOpacity>
    );
  }, [selectedLanguage, theme, handleLanguageSelection]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.background, borderBottomColor: theme.border || 'rgba(0,0,0,0.05)' }]}>
        <ThemedText style={[styles.headerTitle, { color: theme.text }]}>
          Settings
        </ThemedText>
      </View>

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {settingsSections.map((section, sectionIndex) => (
          <View key={sectionIndex} style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: theme.secondaryText || '#666' }]}>
              {section.title}
            </ThemedText>
            
            <View style={[styles.sectionItems, { backgroundColor: theme.card || '#FFFFFF' }]}>
              {section.items.map((item, itemIndex) => 
                renderSettingItem(item, itemIndex, section.items.length)
              )}
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText style={[styles.versionText, { color: theme.secondaryText || '#666' }]}>
            v1.0.0 • Build 428
          </ThemedText>
          <ThemedText style={[styles.copyrightText, { color: theme.secondaryText || '#666' }]}>
            © 2025 SmartHydrate!
          </ThemedText>
        </View>
      </ScrollView>

      {/* Theme Selection Modal */}
      <Modal
        visible={showThemeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowThemeModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContent, { backgroundColor: theme.card || '#FFFFFF' }]}>
                <View style={styles.modalHeader}>
                  <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                    Choose Theme
                  </ThemedText>
                  <TouchableOpacity 
                    onPress={() => setShowThemeModal(false)}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color={theme.text} />
                  </TouchableOpacity>
                </View>
                
                <FlatList
                  data={themeOptions}
                  keyExtractor={(item) => item.id}
                  renderItem={renderThemeOption}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Language Selection Modal */}
      <Modal
        visible={showLanguageModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowLanguageModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.modalContent, styles.languageModal, { backgroundColor: theme.card || '#FFFFFF' }]}>
                <View style={styles.modalHeader}>
                  <ThemedText style={[styles.modalTitle, { color: theme.text }]}>
                    Choose Language
                  </ThemedText>
                  <TouchableOpacity 
                    onPress={() => setShowLanguageModal(false)}
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color={theme.text} />
                  </TouchableOpacity>
                </View>
                
                <FlatList
                  data={languages}
                  keyExtractor={(item) => item.code}
                  renderItem={renderLanguageOption}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* About Modal */}
      <Modal
        visible={showAboutModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAboutModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowAboutModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.aboutModal, { backgroundColor: theme.card || '#FFFFFF' }]}>
                <View style={[styles.aboutIcon, { backgroundColor: theme.primary || '#007AFF' }]}>
                  <Ionicons name="information" size={32} color="#fff" />
                </View>
                <ThemedText style={[styles.aboutTitle, { color: theme.text }]}>
                  SmartHydrate
                </ThemedText>
                <ThemedText style={[styles.aboutVersion, { color: theme.secondaryText }]}>
                  Version 1.0.0 (Build 428)
                </ThemedText>
                <ThemedText style={[styles.aboutDescription, { color: theme.secondaryText }]}>
                  A modern mobile application built with React Native and Expo.
                </ThemedText>
                
                <View style={styles.aboutLinks}>
                  <TouchableOpacity 
                    style={styles.aboutLink}
                    onPress={() => Linking.openURL('https://yourapp.com/terms')}
                  >
                    <ThemedText style={[styles.aboutLinkText, { color: theme.primary || '#007AFF' }]}>
                      Terms of Service
                    </ThemedText>
                  </TouchableOpacity>
                  <View style={[styles.aboutLinkDivider, { backgroundColor: theme.border }]} />
                  <TouchableOpacity 
                    style={styles.aboutLink}
                    onPress={() => Linking.openURL('https://yourapp.com/privacy')}
                  >
                    <ThemedText style={[styles.aboutLinkText, { color: theme.primary || '#007AFF' }]}>
                      Privacy Policy
                    </ThemedText>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.aboutCloseButton, { backgroundColor: theme.primary || '#007AFF' }]}
                  onPress={() => setShowAboutModal(false)}
                >
                  <ThemedText style={styles.aboutCloseText}>Close</ThemedText>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 50,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionItems: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  optionIcon: {
    width: 28,
    alignItems: 'center',
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '400',
  },
  optionSubtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  optionChevron: {
    marginLeft: 8,
  },
  footer: {
    paddingTop: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    marginBottom: 4,
  },
  copyrightText: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 20,
    maxHeight: '60%',
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  languageModal: {
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    minHeight: 60,
  },
  modalOptionIcon: {
    marginRight: 12,
  },
  modalOptionFlag: {
    marginRight: 16,
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  themeOptionContent: {
    flex: 1,
  },
  themeOptionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  themeOptionDescription: {
    fontSize: 13,
    marginTop: 4,
    marginLeft: 34,
  },
  languageOptionContent: {
    flex: 1,
  },
  languageNative: {
    fontSize: 13,
    marginTop: 2,
  },
  aboutModal: {
    width: '90%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  aboutIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  aboutTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  aboutVersion: {
    fontSize: 14,
    marginBottom: 16,
  },
  aboutDescription: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  aboutLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  aboutLink: {
    paddingHorizontal: 12,
  },
  aboutLinkDivider: {
    width: 1,
    height: 16,
  },
  aboutLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  aboutCloseButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  aboutCloseText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});