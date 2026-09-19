import { StyleSheet, TextInput, View } from 'react-native'
import { colors, radius, spacing } from '../../../theme'

export function SearchBar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string
  onChangeText: (text: string) => void
  placeholder: string
}) {
  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  input: {
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.ink,
  },
})
