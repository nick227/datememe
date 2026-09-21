import type { ImageProvider } from './types'
import { wikimediaProvider } from './wikimedia'
import { openverseProvider } from './openverse'
import { tmdbProvider, unsplashProvider, pexelsProvider, pixabayProvider } from './catalog'

export const imageProviders: ImageProvider[] = [
  wikimediaProvider,
  tmdbProvider,
  openverseProvider,
  unsplashProvider,
  pexelsProvider,
  pixabayProvider,
].sort((a, b) => a.priority - b.priority)

export function getImageProvider(id: string) {
  return imageProviders.find((provider) => provider.id === id)
}

export type { ImageCandidate, ImageImportRule, ImageProvider, ImageSearchContext } from './types'
