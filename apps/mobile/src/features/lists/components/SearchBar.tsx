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
  const handleChangeText = (text: string) => {
    const capitalized = text
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
    onChangeText(capitalized)
  }

  return (
    <View style={styles.container}>
      <TextInput
        value={value}
        onChangeText={handleChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.inkMuted}
        style={styles.input}
        autoCapitalize="words"
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
