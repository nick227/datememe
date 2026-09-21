import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useRegister } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { setToken } from '../../../lib/authToken'
import { queryClient } from '../../../lib/queryClient'
import { borderWidth, colors, spacing } from '../../../theme'
import type { AuthStackParamList } from '../../../navigation/types'
import { Typography } from '../../../ui/Typography'
import { SelectField } from '../../../ui/SelectField'

type Props = NativeStackScreenProps<AuthStackParamList, 'Register'>

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const m = i + 1;
  return { label: new Date(2000, i, 1).toLocaleString('default', { month: 'long' }), value: m.toString().padStart(2, '0') };
});

const DAYS = Array.from({ length: 31 }, (_, i) => {
  const d = i + 1;
  return { label: d.toString(), value: d.toString().padStart(2, '0') };
});

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 120 }, (_, i) => {
  const y = currentYear - i;
  return { label: y.toString(), value: y.toString() };
});

export function RegisterScreen({ navigation }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [month, setMonth] = useState('')
  const [day, setDay] = useState('')
  const [year, setYear] = useState('')
  const register = useRegister()
  const sheet = useActionSheet()

  const birthdate = month && day && year ? `${year}-${month}-${day}` : ''
  const canSubmit = email && password.length >= 8 && username.length >= 3 && displayName && DATE_RE.test(birthdate)

  async function handleSubmit() {
    try {
      const result = await register.mutateAsync({ email, password, username, displayName, birthdate })
      await setToken(result.token)
      await queryClient.invalidateQueries({ queryKey: ['me'] })
    } catch (err: any) {
      sheet.show({ title: 'Could not create account', message: err?.message ?? 'Please check your details', buttons: [{ text: 'OK' }] })
    }
  }

  return (
    <ScreenContainer width="narrow">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={styles.card}>
          <Typography variant="display" style={{ marginBottom: spacing.xs }}>
            Let's find your people
          </Typography>
          <Typography variant="bodyMuted" style={{ marginBottom: spacing.xl }}>
            Skip the bio — your favorites do the talking.
          </Typography>
          <TextField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <TextField label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <TextField label="Display name" value={displayName} onChangeText={setDisplayName} />
          <View>
            <Typography variant="label" style={{ marginBottom: spacing.xs }}>Birthdate</Typography>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <SelectField
                value={month}
                options={MONTHS}
                onSelect={setMonth}
                placeholder="Month"
                style={{ flex: 2, marginBottom: 0 }}
              />
              <SelectField
                value={day}
                options={DAYS}
                onSelect={setDay}
                placeholder="Day"
                style={{ flex: 1, marginBottom: 0 }}
              />
              <SelectField
                value={year}
                options={YEARS}
                onSelect={setYear}
                placeholder="Year"
                style={{ flex: 1.5, marginBottom: 0 }}
              />
            </View>
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <Button label="Sign up" onPress={handleSubmit} loading={register.isPending} disabled={!canSubmit} />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Button label="I already have an account" variant="secondary" onPress={() => navigation.navigate('Login')} />
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
