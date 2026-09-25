import type { ReactNode } from 'react'
import { Box } from '../theme'
import { Typography } from '../ui/Typography'

type Props = {
  testID?: string
  title: string
  subtitle?: string
  action?: ReactNode
}

export function EmptyState({ testID, title, subtitle, action }: Props) {
  return (
    <Box
      testID={testID}
      padding="lg"
      marginVertical="md"
      backgroundColor="surfaceMuted"
      borderWidth={1}
      borderColor="ink"
      alignItems="flex-start"
    >
      <Typography variant="heading">{title}</Typography>
      {subtitle ? (
        <Box marginTop="xs" marginBottom={action ? 'md' : undefined}>
          <Typography variant="bodyMuted">{subtitle}</Typography>
        </Box>
      ) : null}
      {action}
    </Box>
  )
}
