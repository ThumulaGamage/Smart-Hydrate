import { Text } from 'react-native';
import useTheme from '../Theme/theme';

export default function ThemedText({ style, ...props }) {
  const theme = useTheme();
  return <Text style={[{ color: theme.text }, style]} {...props} />;
}

