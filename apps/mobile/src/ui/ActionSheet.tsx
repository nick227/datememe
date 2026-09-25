import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { borderWidth, colors, radius, spacing, type, modalHeight } from '../theme'
import { AnimatedSheet } from './AnimatedSheet'

export type ActionSheetButton = {
  testID?: string
  text: string
  style?: 'default' | 'cancel' | 'destructive'
  onPress?: () => void
}

export type ActionSheetConfig = { title: string; message?: string; buttons: ActionSheetButton[] } | null

/**
 * A real, cross-platform stand-in for `Alert.alert`. This project's
 * `react-native-web` ships `Alert.alert` as a literal no-op on web — every
 * call site silently does nothing in a browser, which is the only platform
 * this app has actually been verified against so far (confirmed live: the
 * messaging options menu, unmatch confirmation, and send-error feedback all
 * rendered nothing at all before this). Built as a bottom sheet using the
 * same `Modal` pattern already established in `SelectField.tsx`, which does
 * render correctly on web.
 */
export function useActionSheet() {
  const [config, setConfig] = useState<ActionSheetConfig>(null)
  return { config, show: setConfig, dismiss: () => setConfig(null) }
}

export function ActionSheet({ testID, config, onDismiss }: { testID?: string; config: ActionSheetConfig; onDismiss: () => void }) {
  function handlePress(button: ActionSheetButton) {
    onDismiss()
    button.onPress?.()
  }

  return (
    <AnimatedSheet testID={testID} visible={!!config} onClose={onDismiss} sheetStyle={styles.sheet}>
      {config ? (
        <>
          <Text testID={testID ? `${testID}.title` : undefined} style={styles.title}>{config.title}</Text>
          {config.message ? <Text testID={testID ? `${testID}.message` : undefined} style={styles.message}>{config.message}</Text> : null}
          {config.buttons.map((button, i) => (
            <Pressable testID={button.testID} key={button.testID ?? i} style={[styles.button, i > 0 && styles.buttonDivider]} onPress={() => handlePress(button)}>
              <Text
                style={[
                  styles.buttonText,
                  button.style === 'destructive' && styles.buttonTextDestructive,
                  button.style === 'cancel' && styles.buttonTextCancel,
                ]}
              >
                {button.text}
              </Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </AnimatedSheet>
  )
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.wheat,
    borderTopWidth: borderWidth.thick,
    borderColor: colors.ink,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    minHeight: modalHeight,
  },
  title: { ...type.heading, marginBottom: spacing.xs },
  message: { ...type.body, color: colors.inkMuted, marginBottom: spacing.md },
  button: { paddingVertical: spacing.md },
  buttonDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  buttonText: { ...type.body, fontWeight: '600', color: colors.ink },
  buttonTextDestructive: { color: colors.danger },
  buttonTextCancel: { color: colors.inkMuted, fontWeight: '400' },
})
