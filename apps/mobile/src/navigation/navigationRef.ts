import { createNavigationContainerRef } from '@react-navigation/native'

// GlobalHeader (and anything nested in it, like HeaderAvatar) lives outside
// any Stack/Tab.Navigator's own screen tree — useNavigation() has no context
// there. This ref lets it navigate imperatively instead, same as React
// Navigation's own documented pattern for chrome rendered above a navigator.
export const navigationRef = createNavigationContainerRef()
