import { View } from 'react-native';
import useTheme from '../Theme/theme';

export default function ThemedView({ style, ...props }) {
  const theme = useTheme();
  return <View style={[{ backgroundColor: theme.background }, style]} {...props} />;
}

