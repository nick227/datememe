import fs from 'fs';

const path = '/home/administrator/web/datememe/packages/db/prisma/seed.ts';
let content = fs.readFileSync(path, 'utf8');

// The replacement mapping
const replacements = [
  {
    regex: /const jobs = \[(.*?)\]/s,
    replacement: "const jobs = [\n" +
    "    { name: 'Software Engineer', icon: 'monitor' },\n" +
    "    { name: 'Marine Biologist', icon: 'fish' },\n" +
    "    { name: 'Pastry Chef', icon: 'croissant' },\n" +
    "    { name: 'Architect', icon: 'pencil-ruler' },\n" +
    "    { name: 'Park Ranger', icon: 'trees' },\n" +
    "    { name: 'Graphic Designer', icon: 'palette' },\n" +
    "    { name: 'Data Scientist', icon: 'bar-chart' },\n" +
    "    { name: 'Registered Nurse', icon: 'stethoscope' },\n" +
    "    { name: 'Electrician', icon: 'zap' },\n" +
    "    { name: 'Teacher', icon: 'book-open' },\n" +
    "    { name: 'Plumber', icon: 'wrench' },\n" +
    "    { name: 'Financial Analyst', icon: 'trending-up' }\n" +
    "  ]\n" +
    "  for (const item of jobs) await upsertEntity(jobTitle.id, item.name, { metadata: { icon: item.icon } })"
  },
  {
    regex: /for \(const name of jobs\) await upsertEntity\(jobTitle.id, name\)/,
    replacement: ''
  },
  {
    regex: /const toppings = \[(.*?)\]/s,
    replacement: "const toppings = [\n" +
    "    { name: 'Pepperoni', icon: 'circle-dot' },\n" +
    "    { name: 'Mushrooms', icon: 'mushroom' },\n" +
    "    { name: 'Onions', icon: 'circle' },\n" +
    "    { name: 'Sausage', icon: 'circle-dashed' },\n" +
    "    { name: 'Bacon', icon: 'bacon' },\n" +
    "    { name: 'Extra cheese', icon: 'cheese' },\n" +
    "    { name: 'Black olives', icon: 'circle' },\n" +
    "    { name: 'Green peppers', icon: 'bell' },\n" +
    "    { name: 'Pineapple', icon: 'sun' },\n" +
    "    { name: 'Jalapeños', icon: 'flame' },\n" +
    "    { name: 'Prosciutto', icon: 'beef' },\n" +
    "    { name: 'Spinach', icon: 'leaf' },\n" +
    "    { name: 'Garlic', icon: 'garlic' },\n" +
    "    { name: 'Anchovies', icon: 'fish' },\n" +
    "    { name: 'Basil', icon: 'leafy-green' }\n" +
    "  ]\n" +
    "  for (const item of toppings) await upsertEntity(pizzaTopping.id, item.name, { metadata: { icon: item.icon } })"
  },
  {
    regex: /for \(const name of toppings\) await upsertEntity\(pizzaTopping.id, name\)/,
    replacement: ''
  },
  {
    regex: /const peeves = \[(.*?)\]/s,
    replacement: "const peeves = [\n" +
    "    { name: 'Micro-management', icon: 'eye' },\n" +
    "    { name: 'Meaningless Meetings', icon: 'calendar-x' },\n" +
    "    { name: 'Reply-All Emails', icon: 'mail-warning' },\n" +
    "    { name: 'Coworkers chewing loudly', icon: 'ear-off' },\n" +
    "    { name: 'Slow Wi-Fi', icon: 'wifi-off' },\n" +
    "    { name: 'Office politics', icon: 'users' },\n" +
    "    { name: 'Microwaving Fish', icon: 'fish' },\n" +
    "    { name: 'Leaving the printer jammed', icon: 'printer' },\n" +
    "    { name: 'Taking credit for others\\' work', icon: 'user-minus' },\n" +
    "    { name: 'Last-minute meetings', icon: 'clock' }\n" +
    "  ]\n" +
    "  for (const item of peeves) await upsertEntity(petPeeve.id, item.name, { metadata: { icon: item.icon } })"
  },
  {
    regex: /for \(const name of peeves\) await upsertEntity\(petPeeve.id, name\)/,
    replacement: ''
  }
];

for (const r of replacements) {
  content = content.replace(r.regex, r.replacement);
}

const categories = [
  'dream-job', 'favorite-workplace-perks', 'biggest-workplace-pet-peeves', 
  'favorite-workouts', 'favorite-book-genres', 'favorite-video-game-genres', 
  'favorite-art-styles', 'favorite-content-formats', 'favorite-craft-medium', 
  'musical-instruments-played', 'essential-pizza-toppings'
];

for (const cat of categories) {
  const regexStr = "(slug: '" + cat + "',[\\s\\S]*?)(isActive: false,)?([\\s\\S]*?\\})";
  const regex = new RegExp(regexStr, 'g');
  content = content.replace(regex, (match, p1, p2, p3) => {
    if (match.includes('metadata:')) {
       return match.replace(/metadata:\s*\{([^}]*)\}/, "metadata: { $1, mediaKind: 'ICON' }");
    }
    return p1 + "metadata: { mediaKind: 'ICON' },\n    isActive: true,\n" + p3;
  });
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done!');
