import fs from 'fs';

const axesMap: Record<string, string[]> = {
  'favorite-artists-all-time': ['music'],
  'favorite-music-instruments': ['music', 'hobbies'],
  'top-sitcoms': ['film-tv', 'tv', 'comedy'],
  'favorite-movie-directors': ['film-tv', 'movies'],
  'top-ps5-games': ['gaming', 'action', 'playstation'],
  'favorite-ide': ['tech', 'programming'],
  'favorite-workplace-perks': ['career'],
  'workplace-pet-peeves': ['career'],
  'favorite-edutubers': ['creators', 'education'],
  'favorite-us-state': ['travel', 'geography'],
  'favorite-gym-chain': ['lifestyle', 'fitness'],
  'favorite-car-brands': ['lifestyle', 'automotive'],
  'top-honda-models': ['lifestyle', 'automotive'],
  'best-90s-sports-cars': ['lifestyle', 'automotive', 'nostalgia'],
  'current-phone': ['tech', 'lifestyle'],
  'favorite-craft-medium': ['hobbies', 'art'],
  'favorite-sewing-machine': ['hobbies', 'craft'],
  'favorite-scifi-books': ['literature', 'books', 'sci-fi'],
  'favorite-book-genres': ['literature', 'books'],
  'fictional-universe': ['literature', 'entertainment'],
};

const path = '/home/administrator/web/datememe/packages/db/prisma/seed.ts';
let content = fs.readFileSync(path, 'utf8');

for (const [slug, axes] of Object.entries(axesMap)) {
  const axesString = `axes: ${JSON.stringify(axes)},`;
  // find: slug: 'slug-name',
  const regex = new RegExp(`(slug:\\s*'${slug}',)`);
  if (content.match(regex)) {
    // Check if it already has axes
    const localChunk = content.substring(content.indexOf(`slug: '${slug}'`), content.indexOf(`slug: '${slug}'`) + 200);
    if (!localChunk.includes('axes: [')) {
      content = content.replace(regex, `$1\n      ${axesString}`);
    }
  } else {
    console.warn(`Could not find slug: ${slug}`);
  }
}

fs.writeFileSync(path, content, 'utf8');
console.log('Axes injected successfully!');
