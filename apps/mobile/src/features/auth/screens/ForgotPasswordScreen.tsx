import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useForgotPassword } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { borderWidth, colors, spacing } from '../../../theme'
import type { AuthStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>

export function ForgotPasswordScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const forgotPassword = useForgotPassword()

  async function handleSubmit() {
    // The backend always returns 200 regardless of whether the email exists
    // (no enumeration) — so the client's job is just to move forward, not to
    // branch on the result. A network failure is the only real error case.
    try {
      await forgotPassword.mutateAsync({ email })
    } catch {
      // Fall through to the same next screen anyway — a transient failure
      // here shouldn't strand the user; the reset screen has its own "resend
      // code" action if the code never actually arrives.
    }
    navigation.navigate('ResetPassword', { email })
  }

  return (
    <ScreenContainer testID="screen.forgot-password" width="narrow">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={styles.card}>
          <Typography variant="display" style={{ marginBottom: spacing.xs }}>
            Reset your password
          </Typography>
          <Typography variant="bodyMuted" style={{ marginBottom: spacing.xl }}>
            Enter your account email and we&apos;ll send you a 6-digit code.
          </Typography>
          <TextField testID="forgot-password.email"
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <View style={{ marginTop: spacing.sm }}>
            <Button testID="forgot-password.submit" label="Send code" onPress={handleSubmit} loading={forgotPassword.isPending} disabled={!email} />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Button testID="forgot-password.back-to-log-in" label="Back to log in" variant="secondary" onPress={() => navigation.navigate('Login')} />
          </View>
        </View>
      </ScrollView>
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
