import { useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';
import useTheme from '../Theme/theme';

export default function ThemedTextInput({ style, ...props }) {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <TextInput
      style={[
        styles.input,
        {
          backgroundColor: theme.inputBackground,
          color: theme.text,
          borderColor: isFocused ? theme.primaryDark || '#000' : theme.primary,
        },
        style,
      ]}
      placeholderTextColor={theme.mode === 'dark' ? '#ccc' : '#555'}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    marginVertical: 10,
  },
});
