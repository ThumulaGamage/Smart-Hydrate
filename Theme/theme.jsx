import { useColorScheme } from 'react-native';

const common = {
  borderRadius: 12,
  spacing: 16,
  font: {
    size: 16,
    weight: '600',
  },
};

const light = {
  mode: 'light',
  background: '#FFFFFF',
  card: '#F5F5F5',
  primary: '#2196F3',
  icon: '#2196F3',
  secondary: ' #E3F2FD',
  text: 'rgb(0, 67, 154)',
  textMuted: 'rgb(0, 0, 0)',
  border: 'rgb(111, 162, 255)',
  buttonText: '#FFFFFF',
  primaryDark: 'rgb(2, 24, 191)',
  inputBackground: 'rgb(255, 255, 255)',
  error: '#D32F2F', // Added for consistency with SignIn modal
  infoBackground: '#E3F2FD', // Added for the notice box in AddVehicle
  infoText: '#2196F3',       // Added for the notice box in AddVehicle
  ...common,
};

const dark = {
  mode: 'dark',
  background: '#000000',
  card: '#1E1E1E',
  primary: '#2196F3',
  icon: 'rgb(198, 226, 249)',
  secondary: '#1565C0',
  text: '#FFFFFF',
  textMuted: 'rgb(118, 182, 216)',
  border: ' rgb(46, 87, 250)',
  buttonText: '#FFFFFF',
  primaryDark: 'rgb(46, 87, 250)',
  inputBackground: 'rgb(0, 0, 0)',
  error: '#FF5252', // Added for consistency with SignIn modal (darker shade of red)
  infoBackground: ' #1A2F45', // Darker background for info box
  infoText: 'rgb(198, 226, 249)', // Lighter text for dark info box
  ...common,
};

const Themes = { light, dark };

export default function useTheme() {
  const scheme = useColorScheme();
  return Themes[scheme] || Themes.light;
}