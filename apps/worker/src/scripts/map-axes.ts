import { db } from '@project/db'

async function run() {
  const axesMap: Record<string, string[]> = {
    'top-90s-bands': ['music', 'nostalgia'],
    'top-rock-bands': ['music', 'energy'],
    'top-pop-artists': ['music', 'pop-culture'],
    'top-hiphop-artists': ['music', 'energy'],
    'favorite-artists-all-time': ['music'],
    'top-albums': ['music', 'deep-cuts'],
    'favorite-music-festivals': ['music', 'outdoors', 'social'],
    'musical-instruments-played': ['music', 'creative'],
    'top-movies': ['film-tv', 'storytelling'],
    'top-tv-shows': ['film-tv', 'storytelling'],
    'essential-streaming-services': ['film-tv', 'tech'],
    'favorite-sitcoms': ['film-tv', 'humor', 'comfort'],
    'favorite-movie-directors': ['film-tv', 'artistic'],
    'favorite-grocery-store': ['food', 'lifestyle'],
    'go-to-fast-food': ['food', 'comfort'],
    'go-to-coffee-chain': ['food', 'daily-habit'],
    'essential-pizza-toppings': ['food', 'comfort'],
    'favorite-cuisines': ['food', 'culture'],
    'favorite-snacks': ['food', 'comfort'],
    'dream-job': ['career', 'ambition'],
    'favorite-workplace-perks': ['career', 'lifestyle'],
    'biggest-workplace-pet-peeves': ['career', 'social'],
    'most-used-social-media': ['tech', 'social', 'daily-habit'],
    'primary-web-browser': ['tech', 'utility'],
    'essential-tech-gadgets': ['tech', 'lifestyle'],
    'favorite-video-games': ['gaming', 'escapism'],
    'favorite-game-consoles': ['gaming', 'tech', 'nostalgia'],
    'favorite-video-game-genres': ['gaming', 'behavior'],
    'favorite-youtubers': ['creators', 'pop-culture'],
    'favorite-edutubers': ['creators', 'learning'],
    'favorite-content-formats': ['creators', 'consumption'],
    'dream-travel-destinations': ['travel', 'culture', 'adventure'],
    'favorite-national-parks': ['outdoors', 'travel', 'nature'],
    'favorite-craft-medium': ['creative', 'hands-on'],
    'favorite-art-styles': ['creative', 'aesthetics'],
    'favorite-authors': ['literature', 'storytelling'],
    'favorite-books': ['literature', 'storytelling', 'deep-cuts'],
    'favorite-scifi-books': ['literature', 'escapism', 'nerd'],
    'favorite-book-genres': ['literature', 'taste'],
    'ideal-fictional-universe': ['escapism', 'nerd', 'imagination'],
    'favorite-clothing-brands': ['lifestyle', 'aesthetics'],
    'favorite-gym-chain': ['lifestyle', 'health', 'fitness'],
    'favorite-workouts': ['lifestyle', 'health', 'fitness'],
    'favorite-sports-teams': ['sports', 'fandom', 'social'],
    'top-athletes': ['sports', 'performance'],
    'top-podcasts': ['podcasts', 'learning', 'daily-habit'],
    'favorite-board-games': ['tabletop', 'social', 'strategy']
  }

  // Deactivate redundant categories
  const toDeactivate = [
    'favorite-sitcoms',
    'favorite-scifi-books',
    'top-rock-bands',
    'top-pop-artists'
  ]

  for (const slug of toDeactivate) {
    await db.category.updateMany({
      where: { slug },
      data: { isActive: false }
    })
    console.log(`Deactivated ${slug}`)
  }

  // Update axes for remaining active categories
  for (const [slug, axes] of Object.entries(axesMap)) {
    if (toDeactivate.includes(slug)) continue
    await db.category.updateMany({
      where: { slug },
      data: { axes }
    })
    console.log(`Updated axes for ${slug}: ${axes.join(', ')}`)
  }
}

run().catch(console.error).finally(() => process.exit(0))
