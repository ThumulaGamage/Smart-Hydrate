import React, { useState } from 'react';
import { View, TextInput, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ThemedText from '../ThemedText';
import useTheme from '../../Theme/theme';

const EditableField = ({ 
  label, 
  value, 
  onChangeText, 
  editable = false,
  keyboardType = 'default',
  placeholder = '',
  disabled = false,
  icon = null
}) => {
  const theme = useTheme();
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.fieldContainer}>
      <ThemedText style={[styles.label, { color: theme.secondaryText }]}>
        {label}
      </ThemedText>
      
      {editable ? (
        <View style={[
          styles.inputWrapper,
          {
            backgroundColor: theme.card,
            borderColor: isFocused ? theme.primary : theme.border,
            borderWidth: isFocused ? 2 : 1,
          }
        ]}>
          {icon && (
            <View style={styles.iconContainer}>
              <Ionicons name={icon} size={20} color={theme.secondaryText} />
            </View>
          )}
          <TextInput
            style={[
              styles.input,
              { color: theme.text, flex: 1 }
            ]}
            value={value}
            onChangeText={onChangeText}
            keyboardType={keyboardType}
            placeholder={placeholder}
            placeholderTextColor={theme.secondaryText}
            editable={!disabled}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
          />
        </View>
      ) : (
        <View style={[
          styles.displayValue,
          { 
            backgroundColor: theme.card,
            borderColor: theme.border,
          }
        ]}>
          {icon && (
            <View style={styles.iconContainer}>
              <Ionicons name={icon} size={20} color={theme.secondaryText} />
            </View>
          )}
          <ThemedText style={[styles.valueText, { color: theme.text, flex: 1 }]}>
            {value || 'Not set'}
          </ThemedText>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fieldContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  input: {
    fontSize: 16,
    fontWeight: '500',
  },
  displayValue: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  valueText: {
    fontSize: 16,
    fontWeight: '500',
  },
  iconContainer: {
    marginRight: 12,
  },
});

export default EditableField;