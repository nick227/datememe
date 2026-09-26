import fs from 'fs';

const newQids = `
  { type: 'sports-team', name: 'Chicago Bulls', qid: 'Q128109' },
  { type: 'sports-team', name: 'FC Barcelona', qid: 'Q7156' },
  { type: 'sports-team', name: 'Green Bay Packers', qid: 'Q213837' },
  { type: 'sports-team', name: 'Los Angeles Dodgers', qid: 'Q334634' },
  { type: 'sports-team', name: 'Arsenal FC', qid: 'Q9617' },
  { type: 'sports-team', name: 'Scuderia Ferrari', qid: 'Q169898' },
  { type: 'sports-team', name: 'Mercedes-AMG Petronas F1 Team', qid: 'Q172721' },
  { type: 'athlete', name: 'Serena Williams', qid: 'Q11459' },
  { type: 'athlete', name: 'Tiger Woods', qid: 'Q10993' },
  { type: 'athlete', name: 'Roger Federer', qid: 'Q1426' },
  { type: 'athlete', name: 'Usain Bolt', qid: 'Q1189' },
  { type: 'athlete', name: 'Muhammad Ali', qid: 'Q36107' },
  { type: 'athlete', name: 'Simone Biles', qid: 'Q7520267' },
  { type: 'book', name: 'The Great Gatsby', qid: 'Q214371' },
  { type: 'book', name: 'Pride and Prejudice', qid: 'Q170583' },
  { type: 'book', name: 'The Catcher in the Rye', qid: 'Q183883' },
  { type: 'book', name: 'The Kite Runner', qid: 'Q118894980' },
  { type: 'board-game', name: 'Betrayal at House on the Hill', qid: 'Q831656' },
  { type: 'tv-show', name: 'It\\'s Always Sunny in Philadelphia', qid: 'Q23670' },
  { type: 'tv-show', name: 'Scrubs', qid: 'Q485668' },
  { type: 'tv-show', name: 'Community', qid: 'Q728553' },
  { type: 'video-game', name: 'Super Mario Odyssey', qid: 'Q28234671' },
  { type: 'video-game', name: 'The Legend of Zelda: Breath of the Wild', qid: 'Q17185964' },
  { type: 'video-game', name: 'Halo: Combat Evolved', qid: 'Q276217' },
  { type: 'video-game', name: 'Half-Life 2', qid: 'Q193581' },
  { type: 'tv-show', name: 'True Detective', qid: 'Q7847400' },
  { type: 'tv-show', name: 'Peaky Blinders', qid: 'Q14944179' },
  { type: 'tv-show', name: 'The Last of Us', qid: 'Q87131973' },
  { type: 'movie-director', name: 'Peter Jackson', qid: 'Q4465' },
  { type: 'movie-director', name: 'James Cameron', qid: 'Q42574' },
  { type: 'movie-director', name: 'George Lucas', qid: 'Q38222' },
`;

const path = '/home/administrator/web/datememe/apps/server/src/scripts/seed-taxonomy-media.ts';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/\] as const/, newQids + '] as const');

fs.writeFileSync(path, content, 'utf8');
console.log('QIDs appended successfully');
