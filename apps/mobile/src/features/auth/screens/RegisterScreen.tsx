import { useState } from 'react'
import { Alert, ScrollView, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useRegister } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { setToken } from '../../../lib/authToken'
import { queryClient } from '../../../lib/queryClient'
import { spacing } from '../../../theme'
import type { AuthStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const register = useRegister()

  const canSubmit = email && password.length >= 8 && username.length >= 3 && displayName && DATE_RE.test(birthdate)

  async function handleSubmit() {
    try {
      const result = await register.mutateAsync({ email, password, username, displayName, birthdate })
      await setToken(result.token)
      await queryClient.invalidateQueries({ queryKey: ['me'] })
    } catch (err: any) {
      Alert.alert('Could not create account', err?.message ?? 'Please check your details')
    }
  }

  return (
    <ScreenContainer>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <Typography variant="title" style={{ marginBottom: spacing.xl }}>Create your account</Typography>
        <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
        <TextField label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
        <TextField label="Display name" value={displayName} onChangeText={setDisplayName} />
        <TextField
          label="Birthdate"
          value={birthdate}
          onChangeText={setBirthdate}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
        />
        <View style={{ marginTop: spacing.sm }}>
          <Button label="Sign up" onPress={handleSubmit} loading={register.isPending} disabled={!canSubmit} />
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Button label="I already have an account" variant="secondary" onPress={() => navigation.navigate('Login')} />
        </View>
      </ScrollView>
    </ScreenContainer>
  )
}
