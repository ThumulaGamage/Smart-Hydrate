import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import useTheme from '../Theme/theme';

export default function ThemedButton({ title, onPress, style, textStyle }) {
  const theme = useTheme();
  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: theme.primary }, style]}
      onPress={onPress}
    >
      <Text style={[styles.text, { color: theme.buttonText }, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});