import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import { useRegister, useRedeemCoupon } from '@project/sdk'
import { ScreenContainer } from '../../../ui/ScreenContainer'
import { TextField } from '../../../ui/TextField'
import { Button } from '../../../ui/Button'
import { ActionSheet, useActionSheet } from '../../../ui/ActionSheet'
import { GoogleAuthButton, OrDivider } from '../../../ui/SocialAuthButton'
import { setToken } from '../../../lib/authToken'
import { queryClient } from '../../../lib/queryClient'
import { borderWidth, colors, radius, spacing } from '../../../theme'
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
  const [promoCode, setPromoCode] = useState('')
  const register = useRegister()
  const redeemCoupon = useRedeemCoupon()
  const sheet = useActionSheet()

  const birthdate = month && day && year ? `${year}-${month}-${day}` : ''
  const canSubmit = email && password.length >= 8 && username.length >= 3 && displayName && DATE_RE.test(birthdate)

  async function handleSubmit() {
    try {
      const result = await register.mutateAsync({ email, password, username, displayName, birthdate })
      // Persist credentials first — redeeming needs an authenticated request.
      await setToken(result.token)
      await queryClient.invalidateQueries({ queryKey: ['me'] })

      if (promoCode.trim()) {
        try {
          const redeemed = await redeemCoupon.mutateAsync(promoCode.trim())
          sheet.show({
            title: redeemed.grant ? 'Welcome — you’re a member!' : 'Code applied',
            message: redeemed.grant
              ? `Your code unlocked Premium${redeemed.grant.expiresAt ? ` until ${new Date(redeemed.grant.expiresAt).toLocaleDateString()}` : ' — for life'}.`
              : `That code is a ${redeemed.redemption.discountPercent}% discount — it's saved on your account for when you upgrade.`,
            buttons: [{ testID: 'register.dialog.ok', text: 'OK' }],
          })
        } catch (err: any) {
          // Don't block a successful registration over a bad/expired code.
          sheet.show({ title: 'Account created', message: err?.message ?? 'That code couldn’t be applied, but your account is ready to go.', buttons: [{ testID: 'register.dialog.ok', text: 'OK' }] })
        }
      }
    } catch (err: any) {
      sheet.show({ title: 'Could not create account', message: err?.message ?? 'Please check your details', buttons: [{ testID: 'register.dialog.ok', text: 'OK' }] })
    }
  }

  function handleGooglePress() {
    sheet.show({ title: 'Coming soon', message: 'Google sign-up isn’t wired up yet — use email for now.', buttons: [{ testID: 'register.dialog.ok', text: 'OK' }] })
  }

  return (
    <ScreenContainer testID="screen.register" width="narrow">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View style={styles.card}>

          <GoogleAuthButton onPress={handleGooglePress} />
          <OrDivider />

          <TextField testID="register.email" label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <TextField testID="register.password" label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <TextField testID="register.username" label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
          <TextField testID="register.display-name" label="Display name" value={displayName} onChangeText={setDisplayName} />
          <View>
            <Typography variant="label" style={{ marginBottom: spacing.xs }}>Birthdate</Typography>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md }}>
              <SelectField testID="register.month"
                value={month}
                options={MONTHS}
                onSelect={setMonth}
                placeholder="Month"
                style={{ flex: 2, marginBottom: 0 }}
              />
              <SelectField testID="register.day"
                value={day}
                options={DAYS}
                onSelect={setDay}
                placeholder="Day"
                style={{ flex: 1, marginBottom: 0 }}
              />
              <SelectField testID="register.year"
                value={year}
                options={YEARS}
                onSelect={setYear}
                placeholder="Year"
                style={{ flex: 1.5, marginBottom: 0 }}
              />
            </View>
          </View>
          <TextField testID="register.promo-code"
            label="Promo code (optional)"
            value={promoCode}
            onChangeText={setPromoCode}
            autoCapitalize="characters"
            placeholder="Promotion code"
          />
          <View style={{ marginTop: spacing.sm }}>
            <Button testID="register.submit" label="Sign up" onPress={handleSubmit} loading={register.isPending || redeemCoupon.isPending} disabled={!canSubmit} />
          </View>
          <View style={{ marginTop: spacing.md }}>
            <Button testID="register.i-already-have-an-account" label="I already have an account" variant="secondary" onPress={() => navigation.navigate('Login')} />
          </View>
        </View>
      </ScrollView>
      <ActionSheet testID="register.dialog" config={sheet.config} onDismiss={sheet.dismiss} />
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
  perksBanner: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
})
