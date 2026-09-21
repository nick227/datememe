import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useLogin } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { GoogleAuthButton, OrDivider } from '../../../ui/SocialAuthButton'
import { setToken } from '../../../lib/authToken'
import { queryClient } from '../../../lib/queryClient'
import { borderWidth, colors, spacing } from '../../../theme'
import type { AuthStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()
  const sheet = useActionSheet()

  async function handleSubmit() {
    try {
      const result = await login.mutateAsync({ email, password })
      // Persist credentials before fetching the canonical bootstrap.
      await setToken(result.token)
      await queryClient.invalidateQueries({ queryKey: ['me'] })
    } catch (err: any) {
      sheet.show({ title: 'Login failed', message: err?.message ?? 'Check your email and password', buttons: [{ testID: 'login.dialog.ok', text: 'OK' }] })
    }
  }

  function handleGooglePress() {
    sheet.show({ title: 'Coming soon', message: 'Google sign-in isn’t wired up yet — log in with email for now.', buttons: [{ testID: 'login.dialog.ok', text: 'OK' }] })
  }

  return (
    <ScreenContainer testID="screen.login" width="narrow">
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={styles.card}>
          <Typography variant="display" style={{ marginBottom: spacing.xs }}>
            Good to see you again
          </Typography>
          <Typography variant="bodyMuted" style={{ marginBottom: spacing.xl }}>
            Log in to pick up where you left off.
          </Typography>
          <GoogleAuthButton onPress={handleGooglePress} />
          <OrDivider />
          <TextField testID="login.email"
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextField testID="login.password" label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <View style={{ marginTop: spacing.sm }}>
            <Button testID="login.submit"
              label="Log in"
              onPress={handleSubmit}
              loading={login.isPending}
              disabled={!email || !password}
            />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Button testID="login.create-an-account" label="Create an account" variant="secondary" onPress={() => navigation.navigate('Register')} />
          </View>
          <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
            <Button testID="login.forgot-password" label="Forgot password?" variant="secondary" onPress={() => navigation.navigate('ForgotPassword')} />
          </View>
        </View>
      </View>
      <ActionSheet testID="login.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
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
