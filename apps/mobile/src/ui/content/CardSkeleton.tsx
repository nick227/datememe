import { Box } from '../../theme'
import { Skeleton } from '../Skeleton'
import { CardShell } from './CardShell'

export function CardSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <CardShell>
        <CardShell.Media>
          <Box width="100%" aspectRatio={16 / 9} />
          <Skeleton variant="rect" width="100%" height="100%" style={{ position: 'absolute' }} />
        </CardShell.Media>
        <CardShell.Body>
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="40%" />
        </CardShell.Body>
      </CardShell>
    )
  }

  return (
    <CardShell>
      <CardShell.Media>
        <Box width="100%" aspectRatio={16 / 9} />
        <Skeleton variant="rect" width="100%" height="100%" style={{ position: 'absolute' }} />
      </CardShell.Media>
      <CardShell.Body>
        <Skeleton variant="text" width="60%" />
        <Skeleton variant="text" width="90%" />
        <CardShell.Insight>
          <Skeleton variant="text" width="50%" />
        </CardShell.Insight>
        <CardShell.ActionRow>
          <Skeleton variant="text" width="30%" />
        </CardShell.ActionRow>
      </CardShell.Body>
    </CardShell>
  )
}
