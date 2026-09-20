import { useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View, FlatList, SafeAreaView } from 'react-native'
import { borderWidth, colors, radius, spacing, type } from '../theme'
import { Icon } from './Icon'

export type SelectOption = { label: string; value: string }

type Props = {
  label?: string
  value: string
  options: SelectOption[]
  onSelect: (value: string) => void
  placeholder?: string
  error?: string
  style?: any
}

export function SelectField({ label, value, options, onSelect, placeholder, error, style }: Props) {
  const [open, setOpen] = useState(false)
  
  const selectedOption = options.find((o) => o.value === value)

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        style={[styles.input, error && styles.inputError]}
        onPress={() => setOpen(true)}
      >
        <Text style={selectedOption ? styles.textSelected : styles.textPlaceholder}>
          {selectedOption ? selectedOption.label : placeholder || 'Select...'}
        </Text>
        <Icon name="ChevronDown" size={20} color={colors.inkMuted} />
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{label || placeholder}</Text>
              <Pressable onPress={() => setOpen(false)} style={styles.closeBtn}>
                <Icon name="X" size={24} color={colors.ink} />
              </Pressable>
            </View>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.option}
                  onPress={() => {
                    onSelect(item.value)
                    setOpen(false)
                  }}
                >
                  <Text style={[styles.optionText, item.value === value && styles.optionTextSelected]}>
                    {item.label}
                  </Text>
                  {item.value === value && <Icon name="Check" size={20} color={colors.accent} />}
                </Pressable>
              )}
            />
            <SafeAreaView />
          </View>
        </View>
      </Modal>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputError: {
    borderWidth: borderWidth.thick,
    borderColor: colors.danger,
  },
  textSelected: {
    fontSize: 16,
    color: colors.ink,
  },
  textPlaceholder: {
    fontSize: 16,
    color: colors.inkMuted,
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  modalTitle: {
    ...type.heading,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceMuted,
  },
  optionText: {
    fontSize: 16,
    color: colors.ink,
  },
  optionTextSelected: {
    color: colors.accent,
    fontWeight: '600',
  },
})
