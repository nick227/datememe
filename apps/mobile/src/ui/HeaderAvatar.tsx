import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { useCurrentUser } from '@project/sdk'
import { colors, radius } from '../theme'
import type { MainStackParamList } from '../navigation/types'

type NavigationProp = NativeStackNavigationProp<MainStackParamList>

export function HeaderAvatar() {
  const me = useCurrentUser()
  const navigation = useNavigation<NavigationProp>()

  const profile = me.data?.profile
  if (!profile) return <View style={styles.placeholder} />

  return (
    <Pressable onPress={() => navigation.navigate('ProfileModal')} hitSlop={12}>
      {profile.avatarUrl ? (
        <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          <Text style={styles.avatarFallbackText}>{(profile.displayName || '?').charAt(0).toUpperCase()}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  placeholder: { width: 36, height: 36 },
  avatar: { width: 36, height: 36, borderRadius: radius.pill },
  avatarFallback: { backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { fontFamily: 'PlusJakartaSans_800ExtraBold', fontSize: 16, color: colors.primary },
})
