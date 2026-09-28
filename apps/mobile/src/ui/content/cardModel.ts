export type CardModel = {
  id: string
  title: string
  titleLines?: number

  media?: {
    uri?: string | null
    credit?: string | null
    aspectRatio?: number
  }

  badge?: {
    label: string
    variant: 'neutral' | 'accent' | 'success'
  }

  meta?: {
    value: string
  }
}
