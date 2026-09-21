import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { ApiError, useForgotPassword, useResetPassword } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { borderWidth, colors, spacing } from '../../../theme'
import type { AuthStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetPassword'>

export function ResetPasswordScreen({ route, navigation }: Props) {
  const { email } = route.params
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [codeError, setCodeError] = useState<string | undefined>()
  const resetPassword = useResetPassword()
  const forgotPassword = useForgotPassword()
  const sheet = useActionSheet()

  const canSubmit = code.length === 6 && newPassword.length >= 8

  async function handleSubmit() {
    setCodeError(undefined)
    try {
      await resetPassword.mutateAsync({ email, token: code, newPassword })
      sheet.show({
        title: 'Password updated',
        message: 'All your other sessions have been signed out for safety. Log in with your new password.',
        buttons: [{ text: 'Log in', onPress: () => navigation.navigate('Login') }],
      })
    } catch (err) {
      if (err instanceof ApiError && err.status === 400) {
        setCodeError('That code is invalid, expired, or already used.')
      } else {
        sheet.show({ title: 'Could not reset password', message: 'Try again in a moment.', buttons: [{ text: 'OK' }] })
      }
    }
  }

  async function handleResend() {
    setCodeError(undefined)
    try {
      await forgotPassword.mutateAsync({ email })
    } catch {
      // Same no-enumeration posture as the initial request — move on regardless.
    }
    sheet.show({ title: 'Code sent', message: `If an account exists for ${email}, a new code is on the way.`, buttons: [{ text: 'OK' }] })
  }

  return (
    <ScreenContainer width="narrow">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={styles.card}>
          <Typography variant="display" style={{ marginBottom: spacing.xs }}>
            Check your email
          </Typography>
          <Typography variant="bodyMuted" style={{ marginBottom: spacing.xl }}>
            Enter the 6-digit code we sent to {email}, plus your new password.
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
          <TextField label="New password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
          <View style={{ marginTop: spacing.sm }}>
            <Button label="Reset password" onPress={handleSubmit} loading={resetPassword.isPending} disabled={!canSubmit} />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Button label="Resend code" variant="secondary" onPress={handleResend} loading={forgotPassword.isPending} />
          </View>
        </View>
      </ScrollView>
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
  },
})
