import { useEffect } from 'react'
import { Platform } from 'react-native'
import { useNavigation } from '@react-navigation/native'

// Screen options are owned by each route; background fetches cannot overwrite
// the active screen's document title. The container adds the brand suffix.
export function usePageTitle(title: string | undefined) {
  const navigation = useNavigation()
  useEffect(() => {
    if (Platform.OS === 'web') navigation.setOptions({ title })
  }, [navigation, title])
}
