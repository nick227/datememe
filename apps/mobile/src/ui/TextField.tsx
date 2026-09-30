import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native'
import { borderWidth, colors, radius, spacing, type } from '../theme'

type Props = TextInputProps & { label?: string; error?: string; containerStyle?: StyleProp<ViewStyle> }

export function TextField({ label, error, style, containerStyle, ...rest }: Props) {
  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.inkMuted}
        style={[styles.input, error && styles.inputError, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.md },
  label: { ...type.label, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: borderWidth.thin,
    borderColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
  inputError: {
    borderWidth: borderWidth.thick,
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.xs,
  },
})
