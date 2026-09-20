import { useState } from 'react'
import { Alert, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useLogin } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { setToken } from '../../../lib/authToken'
import { queryClient } from '../../../lib/queryClient'
import { colors, radius, spacing } from '../../../theme'
import type { AuthStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const login = useLogin()

  async function handleSubmit() {
    try {
      const result = await login.mutateAsync({ email, password })
      // Store the token before re-triggering the /auth/me refetch the hook's own
      // onSuccess already fired — that first one raced ahead of the token write
      // and would have gone out unauthenticated.
      await setToken(result.token)
      await queryClient.invalidateQueries({ queryKey: ['me'] })
    } catch (err: any) {
      Alert.alert('Login failed', err?.message ?? 'Check your email and password')
    }
  }

  return (
    <ScreenContainer width="narrow" decorated>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <View style={styles.card}>
          <Typography variant="display" style={{ marginBottom: spacing.xs }}>
            Good to see you again
          </Typography>
          <Typography variant="bodyMuted" style={{ marginBottom: spacing.xl }}>
            Log in to pick up where you left off.
          </Typography>
          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <View style={{ marginTop: spacing.sm }}>
            <Button
              label="Log in"
              onPress={handleSubmit}
              loading={login.isPending}
              disabled={!email || !password}
            />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Button label="Create an account" variant="secondary" onPress={() => navigation.navigate('Register')} />
          </View>
        </View>
      </View>
    </ScreenContainer>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
})
