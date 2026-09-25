import type { TextProps as RNTextProps } from 'react-native'
import { Text } from '../theme'
import type { Theme } from '../theme'

type Props = RNTextProps & {
  variant?: keyof Theme['textVariants']
  children?: React.ReactNode
}

export function Typography({ variant = 'body', style, ...rest }: Props) {
  return <Text variant={variant} style={style as any} {...rest} />
}
