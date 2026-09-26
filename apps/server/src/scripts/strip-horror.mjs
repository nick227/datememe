import fs from 'fs';

const path = '/home/administrator/web/datememe/packages/db/prisma/seed-staging.ts';
let content = fs.readFileSync(path, 'utf8');

// Remove from CATEGORIES array
content = content.replace(/, 'favorite-horror-movies'/g, '');
content = content.replace(/'favorite-horror-movies', /g, '');

// Remove from picks objects (lines starting with spaces and 'favorite-horror-movies': ...)
content = content.replace(/\n\s*'favorite-horror-movies': \[.*\],/g, '');

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed seed-staging.ts');
