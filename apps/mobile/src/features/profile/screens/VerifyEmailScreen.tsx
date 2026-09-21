import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ApiError, useSendVerificationEmail, useVerifyEmail } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TopNavigation } from '../../../ui/TopNavigation'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { borderWidth, colors, spacing } from '../../../theme'
import type { ProfileStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<ProfileStackParamList, 'VerifyEmail'>

export function VerifyEmailScreen({ navigation }: Props) {
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const verifyEmail = useVerifyEmail()
  const sendVerification = useSendVerificationEmail()
  const sheet = useActionSheet()

  async function handleSubmit() {
    setCodeError(undefined)
    try {
      await verifyEmail.mutateAsync({ token: code })
      sheet.show({ title: 'Email verified', message: "You're all set.", buttons: [{ text: 'Done', onPress: () => navigation.goBack() }] })
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setCodeError('That code is invalid, expired, or already used.')
      } else {
        sheet.show({ title: 'Could not verify email', message: 'Try again in a moment.', buttons: [{ text: 'OK' }] })
      }
    }
  }

  async function handleResend() {
    setCodeError(undefined)
    try {
      await sendVerification.mutateAsync()
      sheet.show({ title: 'Code sent', message: 'Check your email for a new 6-digit code.', buttons: [{ text: 'OK' }] })
    } catch {
      sheet.show({ title: 'Could not send code', message: 'Try again in a moment.', buttons: [{ text: 'OK' }] })
    }
  }

  return (
    <ScreenContainer width="narrow">
      <TopNavigation alignment="left" leftAction="back" onLeftAction={() => navigation.goBack()} title="Verify your email" />
      <View style={styles.card}>
        <Typography variant="bodyMuted" style={{ marginBottom: spacing.xl }}>
          Enter the 6-digit code we just sent to your email.
        </Typography>
        <TextField
          label="Code"
          value={code}
          onChangeText={(v) => {
            setCode(v.replace(/[^0-9]/g, '').slice(0, 6))
            setCodeError(undefined)
          }}
          keyboardType="number-pad"
          maxLength={6}
          error={codeError}
        />
        <View style={{ marginTop: spacing.sm }}>
          <Button label="Verify" onPress={handleSubmit} loading={verifyEmail.isPending} disabled={code.length !== 6} />
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Button label="Resend code" variant="secondary" onPress={handleResend} loading={sendVerification.isPending} />
        </View>
      </View>
      <ActionSheet config={sheet.config} onDismiss={sheet.dismiss} />
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: borderWidth.thick,
    borderColor: colors.ink,
    padding: spacing.xl,
    margin: spacing.lg,
  },
})
