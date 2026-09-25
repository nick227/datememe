import { useEffect, useState, type ReactNode } from 'react'
import { Modal, Pressable, StyleSheet, type ViewStyle, type StyleProp } from 'react-native'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated'

type Props = {
  visible: boolean
  onClose: () => void
  children: ReactNode
  testID?: string
  sheetStyle?: StyleProp<ViewStyle>
  overlayStyle?: StyleProp<ViewStyle>
}

export function AnimatedSheet({ visible, onClose, children, testID, sheetStyle, overlayStyle }: Props) {
  const [render, setRender] = useState(visible)

  useEffect(() => {
    if (visible) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRender(true)
    } else if (render) {
      const timer = setTimeout(() => setRender(false), 250) // wait for exit animation
      return () => clearTimeout(timer)
    }
  }, [visible, render])

  if (!render) return null

  return (
    <Modal
      testID={testID ? `${testID}.modal` : undefined}
      visible={true} // keep native Modal open until unmount
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View
        testID={testID ? `${testID}.overlay` : undefined}
        style={[styles.overlay, overlayStyle]}
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(200)}
      >
        <Pressable testID={testID ? `${testID}.backdrop` : undefined} style={StyleSheet.absoluteFill} onPress={onClose} />
        {visible ? ( // we use `visible` to trigger the reanimated `exiting` before `render` becomes false
          <Animated.View
            testID={testID ? `${testID}.sheet` : undefined}
            style={[styles.sheet, sheetStyle]}
            entering={SlideInDown.springify().damping(15).stiffness(250)}
            exiting={SlideOutDown.duration(200)}
          >
            {children}
          </Animated.View>
        ) : null}
      </Animated.View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
  },
})
