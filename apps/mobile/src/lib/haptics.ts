import * as Haptics from 'expo-haptics'
import { Platform } from 'react-native'

export function hapticSelection() {
  if (Platform.OS === 'web') return
  Haptics.selectionAsync()
}

export function hapticLight() {
  if (Platform.OS === 'web') return
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
}

export function hapticMedium() {
  if (Platform.OS === 'web') return
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
}

export function hapticHeavy() {
  if (Platform.OS === 'web') return
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
}

export function hapticSuccess() {
  if (Platform.OS === 'web') return
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
}

export function hapticError() {
  if (Platform.OS === 'web') return
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
}
