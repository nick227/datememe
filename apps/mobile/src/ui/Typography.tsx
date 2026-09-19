import { Text, type TextProps } from 'react-native'
import { type as themeType } from '../theme'

type Props = TextProps & {
  variant?: keyof typeof themeType
}

export function Typography({ variant = 'body', style, ...rest }: Props) {
  return <Text style={[themeType[variant], style]} {...rest} />
}
