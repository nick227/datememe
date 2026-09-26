import fs from 'fs';

const path = '/home/administrator/web/datememe/packages/db/prisma/seed.ts';
let content = fs.readFileSync(path, 'utf8');

const replacements = [
  { slug: 'favorite-artists-all-time', label: 'Artists' },
  { slug: 'favorite-video-games', label: 'Video Games' },
  { slug: 'favorite-youtubers', label: 'YouTubers' },
  { slug: 'favorite-authors', label: 'Authors' },
  { slug: 'favorite-grocery-store', label: 'Grocery Stores' },
  { slug: 'favorite-clothing-brands', label: 'Clothing Brands' },
  { slug: 'essential-streaming-services', label: 'Most Used Streaming Services' },
  { slug: 'favorite-gym-chain', label: 'Gym Chains' },
  { slug: 'favorite-sports-teams', label: 'Sports Teams' },
  { slug: 'favorite-books', label: 'Books' },
  { slug: 'favorite-scifi-books', label: 'Sci-Fi Books' },
  { slug: 'favorite-board-games', label: 'Tabletop Games' },
  { slug: 'favorite-music-festivals', label: 'Music Festivals' },
  { slug: 'top-sitcoms', label: 'Best Sitcoms' },
  { slug: 'essential-pizza-toppings', label: 'Best Pizza Toppings' },
  { slug: 'favorite-workplace-perks', label: 'Workplace Perks' },
  { slug: 'favorite-game-consoles', label: 'Game Consoles' },
  { slug: 'favorite-edutubers', label: 'EduTubers' },
  { slug: 'dream-travel-destinations', label: 'Dream Destinations' },
  { slug: 'favorite-craft-medium', label: 'Craft Mediums' },
  { slug: 'favorite-book-genres', label: 'Book Genres' },
  { slug: 'musical-instruments-played', label: 'Musical Instruments' },
  { slug: 'favorite-movie-directors', label: 'Directors' },
  { slug: 'favorite-cuisines', label: 'Cuisines' },
  { slug: 'biggest-workplace-pet-peeves', label: 'Workplace Pet Peeves' },
  { slug: 'essential-tech-gadgets', label: 'Tech Gadgets' },
  { slug: 'favorite-video-game-genres', label: 'Video Game Genres' },
  { slug: 'favorite-content-formats', label: 'Content Formats' },
  { slug: 'favorite-national-parks', label: 'National Parks' },
  { slug: 'favorite-art-styles', label: 'Art Styles' },
  { slug: 'favorite-workouts', label: 'Workouts' },
];

for (const rep of replacements) {
  const regexStr = "(slug: '" + rep.slug + "',[\\s\\S]*?shortLabel: )'.*?'";
  const regex = new RegExp(regexStr);
  content = content.replace(regex, "$1'" + rep.label + "'");
}

fs.writeFileSync(path, content, 'utf8');
console.log('Renamed shortLabels successfully.');
