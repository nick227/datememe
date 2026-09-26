import { db } from '@project/db'
import { TaxonomyMediaService } from '../services/TaxonomyMediaService'
import { resolveWikidataImage } from '../services/imageProviders/wikimedia'
import type { ImageCandidate } from '../services/imageProviders'

// Reviewed identities, not first-result matching. Same-name films, books,
// bands, places and stock-photo subjects are deliberately not interchangeable.
const fixtures = [
  { type: 'movie', name: 'Inception', qid: 'Q25188', cover: true, categories: ['top-movies'] },
  { type: 'movie', name: 'Parasite', qid: 'Q61448040' },
  { type: 'movie', name: 'The Shining', qid: 'Q186341' },
  { type: 'movie', name: 'The Godfather', qid: 'Q47703' },
  { type: 'movie', name: 'The Dark Knight', qid: 'Q163872' },
  { type: 'movie', name: 'Pulp Fiction', qid: 'Q104123' },
  { type: 'movie', name: 'Get Out', qid: 'Q25136235' },
  { type: 'movie', name: 'Hereditary', qid: 'Q47524071' },
  { type: 'movie', name: 'The Exorcist', qid: 'Q274167', cover: true, categories: ['favorite-horror-movies'] },
  { type: 'movie', name: 'Halloween', qid: 'Q221103' },
  { type: 'movie', name: 'Scream', qid: 'Q27411' },
  { type: 'movie', name: 'A Nightmare on Elm Street', qid: 'Q329434' },
  { type: 'movie', name: 'Alien', qid: 'Q103569' },
  { type: 'movie', name: 'The Thing', qid: 'Q210756' },

  { type: 'band', name: 'Nirvana', qid: 'Q11649', cover: true, categories: ['top-90s-bands', 'top-rock-bands'] },
  { type: 'band', name: 'Radiohead', qid: 'Q44190' },
  { type: 'band', name: 'Taylor Swift', qid: 'Q26876', categories: ['top-pop-artists'] },
  { type: 'band', name: 'Kendrick Lamar', qid: 'Q130798', categories: ['top-hiphop-artists'] },
  { type: 'band', name: 'Oasis', qid: 'Q382890' },
  { type: 'band', name: 'Pearl Jam', qid: 'Q142701' },
  { type: 'band', name: 'The Smashing Pumpkins', qid: 'Q184217' },
  { type: 'band', name: 'Blur', qid: 'Q485820' },
  { type: 'band', name: 'Weezer', qid: 'Q209956' },
  { type: 'band', name: 'No Doubt', qid: 'Q43259' },
  { type: 'band', name: 'Green Day', qid: 'Q47871' },
  { type: 'band', name: 'R.E.M.', qid: 'Q134969' },

  { type: 'book', name: 'Dune', qid: 'Q190192', cover: true, categories: ['favorite-scifi-books'] },
  { type: 'book', name: 'The Hobbit', qid: 'Q74287' },
  { type: 'book', name: '1984', qid: 'Q208460' },
  { type: 'book', name: 'Foundation', qid: 'Q753894' },

  { type: 'country', name: 'Japan', qid: 'Q17', cover: true },
  { type: 'country', name: 'Italy', qid: 'Q38' },
  { type: 'country', name: 'Iceland', qid: 'Q189' },
  { type: 'country', name: 'Greece', qid: 'Q41' },

  { type: 'national-park', name: 'Yellowstone', qid: 'Q351', cover: true },
  { type: 'national-park', name: 'Yosemite', qid: 'Q180402' },
  { type: 'national-park', name: 'Grand Canyon', qid: 'Q118841' },
  { type: 'national-park', name: 'Zion', qid: 'Q205325' },

  { type: 'video-game', name: 'Marvel\'s Spider-Man 2', qid: 'Q108479502', cover: true, categories: ['favorite-video-games'] },
  { type: 'video-game', name: 'God of War Ragnarök', qid: 'Q99397916' },
  { type: 'video-game', name: 'Returnal', qid: 'Q96240947' },
  { type: 'video-game', name: 'Ghost of Tsushima', qid: 'Q42564798' },
  { type: 'video-game', name: 'Demon\'s Souls', qid: 'Q1153708' },
  { type: 'video-game', name: 'Elden Ring', qid: 'Q64826862' },
  { type: 'video-game', name: 'The Last of Us Part I', qid: 'Q113377532' },
  { type: 'video-game', name: 'Horizon Forbidden West', qid: 'Q96216443' },
  { type: 'video-game', name: 'Cyberpunk 2077', qid: 'Q3182559' },
  { type: 'video-game', name: 'Final Fantasy XVI', qid: 'Q112229438' },
  { type: 'video-game', name: 'The Witcher 3: Wild Hunt', qid: 'Q4267401' },
  { type: 'video-game', name: 'Red Dead Redemption 2', qid: 'Q27438121' },
  { type: 'video-game', name: 'Minecraft', qid: 'Q49740' },
  { type: 'video-game', name: 'Grand Theft Auto V', qid: 'Q17452' },

  { type: 'author', name: 'Jane Austen', qid: 'Q36322', cover: true, categories: ['favorite-authors'] },
  { type: 'author', name: 'Charles Dickens', qid: 'Q5686' },
  { type: 'author', name: 'Mark Twain', qid: 'Q7245' },
  { type: 'author', name: 'Fyodor Dostoevsky', qid: 'Q991' },
  { type: 'author', name: 'Leo Tolstoy', qid: 'Q7243' },
  { type: 'author', name: 'Stephen King', qid: 'Q39829' },
  { type: 'author', name: 'J.K. Rowling', qid: 'Q34660' },
  { type: 'author', name: 'George R.R. Martin', qid: 'Q181677' },
  { type: 'author', name: 'Agatha Christie', qid: 'Q35064' },
  { type: 'author', name: 'Toni Morrison', qid: 'Q72334' },

  { type: 'tv-show', name: 'The Bear', qid: 'Q112761982', cover: true, categories: ['top-tv-shows'] },
  { type: 'tv-show', name: 'Succession', qid: 'Q30599007' },
  { type: 'tv-show', name: 'White Lotus', qid: 'Q106679014' }, // changed name to match seed.ts
  { type: 'tv-show', name: 'Severance', qid: 'Q101096725' },
  { type: 'tv-show', name: 'The Sopranos', qid: 'Q23628' },
  { type: 'tv-show', name: 'Breaking Bad', qid: 'Q1079' },
  { type: 'tv-show', name: 'The Wire', qid: 'Q478360' },
  { type: 'tv-show', name: 'Game of Thrones', qid: 'Q23572' },
  { type: 'tv-show', name: 'Stranger Things', qid: 'Q19798734' },
  { type: 'tv-show', name: 'The Office', qid: 'Q23831' },
  { type: 'tv-show', name: 'Seinfeld', qid: 'Q23733' },
  { type: 'tv-show', name: 'Friends', qid: 'Q23659' },
  { type: 'tv-show', name: 'Mad Men', qid: 'Q223977' },
  { type: 'tv-show', name: 'Better Call Saul', qid: 'Q14925221' },
  { type: 'tv-show', name: 'Fargo', qid: 'Q15931555' },

  { type: 'fast-food-chain', name: 'Sweetgreen', qid: 'Q7655681' },
  { type: 'fast-food-chain', name: 'In-N-Out', qid: 'Q1205312' },
  { type: 'fast-food-chain', name: 'Shake Shack', qid: 'Q3958999' },
  { type: 'fast-food-chain', name: 'Taco Bell', qid: 'Q751538' },
  { type: 'fast-food-chain', name: 'Cava', qid: 'Q65063065' },
  { type: 'fast-food-chain', name: 'Popeyes', qid: 'Q1330910' },
  { type: 'fast-food-chain', name: 'Chipotle', qid: 'Q465751' },
  { type: 'fast-food-chain', name: 'Culver\'s', qid: 'Q1143589' },
  { type: 'fast-food-chain', name: 'Waffle House', qid: 'Q1701206' },
  { type: 'fast-food-chain', name: 'McDonald\'s', qid: 'Q38076' },
  { type: 'fast-food-chain', name: 'Wendy\'s', qid: 'Q550258' },
  { type: 'fast-food-chain', name: 'Burger King', qid: 'Q177054' },
  { type: 'fast-food-chain', name: 'Chick-fil-A', qid: 'Q491516' },
  { type: 'fast-food-chain', name: 'Subway', qid: 'Q244457' },
  { type: 'fast-food-chain', name: 'Five Guys', qid: 'Q1131810' },

  { type: 'coffee-chain', name: 'Starbucks', qid: 'Q37158' },
  { type: 'coffee-chain', name: 'Peet\'s Coffee', qid: 'Q1094101' },
  { type: 'coffee-chain', name: 'Dunkin\'', qid: 'Q847743' },
  { type: 'coffee-chain', name: 'Philz Coffee', qid: 'Q18156812' },
  { type: 'coffee-chain', name: 'Blue Bottle Coffee', qid: 'Q4928917' },
  { type: 'coffee-chain', name: 'Dutch Bros', qid: 'Q5317253' },
  { type: 'coffee-chain', name: 'Tim Hortons', qid: 'Q175106' },
  { type: 'coffee-chain', name: 'Caribou Coffee', qid: 'Q5039494' },
  { type: 'coffee-chain', name: 'Costa Coffee', qid: 'Q608845' },
  { type: 'coffee-chain', name: 'Pret A Manger', qid: 'Q2109109' },
  { type: 'coffee-chain', name: 'Panera Bread', qid: 'Q7130852' },
  { type: 'coffee-chain', name: 'Blank Street Coffee', qid: 'Q114792509' },

  { type: 'clothing-brand', name: 'Patagonia', qid: 'Q2465360' },
  { type: 'clothing-brand', name: 'Nike', qid: 'Q483915' },
  { type: 'clothing-brand', name: 'Zara', qid: 'Q147662' },
  { type: 'clothing-brand', name: 'Carhartt', qid: 'Q1036087' },
  { type: 'clothing-brand', name: 'Lululemon', qid: 'Q6702957' },
  { type: 'clothing-brand', name: 'Uniqlo', qid: 'Q26070' },
  { type: 'clothing-brand', name: 'The North Face', qid: 'Q152784' },
  { type: 'clothing-brand', name: 'Levi\'s', qid: 'Q127962' },
  { type: 'clothing-brand', name: 'Adidas', qid: 'Q3895' },
  { type: 'clothing-brand', name: 'Everlane', qid: 'Q21410966' },
  { type: 'clothing-brand', name: 'H&M', qid: 'Q188326' },
  { type: 'clothing-brand', name: 'Gucci', qid: 'Q178516' },
  { type: 'clothing-brand', name: 'Supreme', qid: 'Q19522137' },
  { type: 'clothing-brand', name: 'Ralph Lauren', qid: 'Q1070529' },
  { type: 'clothing-brand', name: 'Vans', qid: 'Q173003' },

  { type: 'social-media', name: 'Instagram', qid: 'Q209330' },
  { type: 'social-media', name: 'TikTok', qid: 'Q48938223' },
  { type: 'social-media', name: 'Twitter / X', qid: 'Q918' },
  { type: 'social-media', name: 'Reddit', qid: 'Q1136' },
  { type: 'social-media', name: 'LinkedIn', qid: 'Q213660' },
  { type: 'social-media', name: 'Pinterest', qid: 'Q255381' },
  { type: 'social-media', name: 'Snapchat', qid: 'Q333618' },
  { type: 'social-media', name: 'BeReal', qid: 'Q111947460' },
  { type: 'social-media', name: 'YouTube', qid: 'Q866' },
  { type: 'social-media', name: 'Facebook', qid: 'Q355' },
  { type: 'social-media', name: 'Twitch', qid: 'Q4555537' },
  { type: 'social-media', name: 'Discord', qid: 'Q22907849' },

  { type: 'grocery-store', name: 'Whole Foods', qid: 'Q2665804' },
  { type: 'grocery-store', name: 'Trader Joe\'s', qid: 'Q1333061' },
  { type: 'grocery-store', name: 'Aldi', qid: 'Q41171672' },
  { type: 'grocery-store', name: 'Kroger', qid: 'Q153417' },
  { type: 'grocery-store', name: 'Publix', qid: 'Q1535640' },
  { type: 'grocery-store', name: 'H-E-B', qid: 'Q1222479' },
  { type: 'grocery-store', name: 'Safeway', qid: 'Q1508234' },
  { type: 'grocery-store', name: 'Wegmans', qid: 'Q1665481' },
  { type: 'grocery-store', name: 'Meijer', qid: 'Q6810243' },
  { type: 'grocery-store', name: 'H Mart', qid: 'Q484435' },
  { type: 'grocery-store', name: 'Target', qid: 'Q1046951' },
  { type: 'grocery-store', name: 'Sprouts', qid: 'Q7581373' },
  { type: 'grocery-store', name: 'Costco', qid: 'Q715583' },

  { type: 'cuisine', name: 'Italian', qid: 'Q192786' },
  { type: 'cuisine', name: 'Mexican', qid: 'Q207965' },
  { type: 'cuisine', name: 'Japanese', qid: 'Q234138' },
  { type: 'cuisine', name: 'Indian', qid: 'Q192087' },
  { type: 'cuisine', name: 'Thai', qid: 'Q841984' },
  { type: 'cuisine', name: 'Chinese', qid: 'Q10876842' },
  { type: 'cuisine', name: 'French', qid: 'Q6661' },
  { type: 'cuisine', name: 'Mediterranean', qid: 'Q934309' },
  { type: 'cuisine', name: 'Greek', qid: 'Q744027' },
  { type: 'cuisine', name: 'Korean', qid: 'Q647500' },
  { type: 'cuisine', name: 'Vietnamese', qid: 'Q826059' },
  { type: 'cuisine', name: 'Spanish', qid: 'Q622512' },
  { type: 'cuisine', name: 'Lebanese', qid: 'Q929239' },
  { type: 'cuisine', name: 'Ethiopian', qid: 'Q257508' },
  { type: 'cuisine', name: 'Peruvian', qid: 'Q749847' },

  { type: 'country', name: 'Australia', qid: 'Q408' },
  { type: 'country', name: 'New Zealand', qid: 'Q664' },
  { type: 'country', name: 'Switzerland', qid: 'Q39' },
  { type: 'country', name: 'France', qid: 'Q142' },
  { type: 'country', name: 'Brazil', qid: 'Q155' },
  { type: 'country', name: 'Thailand', qid: 'Q869' },
  { type: 'country', name: 'South Africa', qid: 'Q258' },
  { type: 'country', name: 'Peru', qid: 'Q419' },
  { type: 'country', name: 'Maldives', qid: 'Q826' },
  { type: 'country', name: 'Canada', qid: 'Q16' },

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
  { type: 'tv-show', name: 'It\'s Always Sunny in Philadelphia', qid: 'Q23670' },
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
  { type: 'sports-team', name: 'Los Angeles Lakers', qid: 'Q121783' },
  { type: 'sports-team', name: 'Golden State Warriors', qid: 'Q157376' },
  { type: 'sports-team', name: 'Real Madrid', qid: 'Q8682' },
  { type: 'sports-team', name: 'Manchester United', qid: 'Q18656' },
  { type: 'sports-team', name: 'New York Yankees', qid: 'Q213417' },
  { type: 'sports-team', name: 'Boston Red Sox', qid: 'Q213959' },
  { type: 'sports-team', name: 'Dallas Cowboys', qid: 'Q204862' },
  { type: 'sports-team', name: 'New England Patriots', qid: 'Q193390' },
  { type: 'sports-team', name: 'Green Bay Packers', qid: 'Q213837' },
  { type: 'sports-team', name: 'Los Angeles Dodgers', qid: 'Q334634' },
  { type: 'athlete', name: 'LeBron James', qid: 'Q36159' },
  { type: 'athlete', name: 'Michael Jordan', qid: 'Q41421' },
  { type: 'athlete', name: 'Kobe Bryant', qid: 'Q25369' },
  { type: 'athlete', name: 'Stephen Curry', qid: 'Q352159' },
  { type: 'athlete', name: 'Kevin Durant', qid: 'Q102806986' },
  { type: 'athlete', name: 'Giannis Antetokounmpo', qid: 'Q8991894' },
  { type: 'athlete', name: 'Nikola Jokić', qid: 'Q17281073' },
  { type: 'athlete', name: 'Luka Dončić', qid: 'Q19844712' },
  { type: 'athlete', name: 'Lionel Messi', qid: 'Q615' },
  { type: 'athlete', name: 'Cristiano Ronaldo', qid: 'Q11571' },
  { type: 'athlete', name: 'Neymar Jr', qid: 'Q142794' },
  { type: 'athlete', name: 'Kylian Mbappé', qid: 'Q21621995' },
  { type: 'athlete', name: 'Erling Haaland', qid: 'Q28967995' },
  { type: 'athlete', name: 'Diego Maradona', qid: 'Q17515' },
  { type: 'athlete', name: 'Pelé', qid: 'Q12897' },
  { type: 'movie-director', name: 'Christopher Nolan', qid: 'Q25191' },
  { type: 'movie-director', name: 'Steven Spielberg', qid: 'Q8877' },
  { type: 'movie-director', name: 'Quentin Tarantino', qid: 'Q3772' },
  { type: 'movie-director', name: 'Martin Scorsese', qid: 'Q41148' },
  { type: 'movie-director', name: 'Greta Gerwig', qid: 'Q271967' },
  { type: 'movie-director', name: 'Denis Villeneuve', qid: 'Q548823' },
  { type: 'movie-director', name: 'Stanley Kubrick', qid: 'Q2001' },
  { type: 'movie-director', name: 'Alfred Hitchcock', qid: 'Q7374' },
  { type: 'movie-director', name: 'Francis Ford Coppola', qid: 'Q56094' },
  { type: 'movie-director', name: 'Wes Anderson', qid: 'Q223687' },
  { type: 'movie-director', name: 'Bong Joon Ho', qid: 'Q495980' },
  { type: 'movie-director', name: 'Ridley Scott', qid: 'Q56005' },
  { type: 'national-park', name: 'Yellowstone', qid: 'Q351' },
  { type: 'national-park', name: 'Yosemite', qid: 'Q180402' },
  { type: 'national-park', name: 'Grand Canyon', qid: 'Q4570025' },
  { type: 'national-park', name: 'Zion', qid: 'Q20001811' },
  { type: 'national-park', name: 'Glacier', qid: 'Q35666' },
  { type: 'national-park', name: 'Rocky Mountain', qid: 'Q27713330' },
  { type: 'national-park', name: 'Acadia', qid: 'Q5014257' },
  { type: 'national-park', name: 'Arches', qid: 'Q632848' },
  { type: 'national-park', name: 'Olympic', qid: 'Q8418' },
  { type: 'national-park', name: 'Great Smoky Mountains', qid: 'Q1360486' },
  { type: 'national-park', name: 'Joshua Tree', qid: 'Q735202' },
  { type: 'national-park', name: 'Denali', qid: 'Q217136' },
  { type: 'board-game', name: 'Catan', qid: 'Q1903' },
  { type: 'board-game', name: 'Ticket to Ride', qid: 'Q60608326' },
  { type: 'board-game', name: 'Monopoly', qid: 'Q17243' },
  { type: 'board-game', name: 'Dungeons & Dragons', qid: 'Q1375' },
  { type: 'board-game', name: 'Chess', qid: 'Q718' },
  { type: 'board-game', name: 'Scrabble', qid: 'Q30612283' },
  { type: 'board-game', name: 'Carcassonne', qid: 'Q6582' },
  { type: 'board-game', name: 'Pandemic', qid: 'Q12184' },
  { type: 'board-game', name: 'Wingspan', qid: 'Q111109349' },
  { type: 'board-game', name: 'Risk', qid: 'Q37285002' },
  { type: 'video-game', name: 'Marvel\'s Spider-Man 2', qid: 'Q108479502' },
  { type: 'video-game', name: 'God of War Ragnarök', qid: 'Q99397916' },
  { type: 'video-game', name: 'Returnal', qid: 'Q96240947' },
  { type: 'video-game', name: 'Ghost of Tsushima', qid: 'Q42564798' },
  { type: 'video-game', name: 'Demon\'s Souls', qid: 'Q1153708' },
  { type: 'video-game', name: 'Elden Ring', qid: 'Q64826862' },
  { type: 'video-game', name: 'The Last of Us Part I', qid: 'Q113377532' },
  { type: 'video-game', name: 'Horizon Forbidden West', qid: 'Q96216443' },
  { type: 'video-game', name: 'Cyberpunk 2077', qid: 'Q3182559' },
  { type: 'video-game', name: 'Final Fantasy XVI', qid: 'Q99397792' },
  { type: 'video-game', name: 'Red Dead Redemption 2', qid: 'Q27438121' },
  { type: 'video-game', name: 'Grand Theft Auto V', qid: 'Q17452' },
  { type: 'sports-team', name: 'Toronto Maple Leafs', qid: 'Q203384' },
  { type: 'sports-team', name: 'Chicago Cubs', qid: 'Q246782' },
  { type: 'movie-director', name: 'David Fincher', qid: 'Q184903' },
  { type: 'movie-director', name: 'Sofia Coppola', qid: 'Q193628' },
  { type: 'movie-director', name: 'Guillermo del Toro', qid: 'Q219124' },
  { type: 'movie-director', name: 'Jordan Peele', qid: 'Q3371986' },
  { type: 'book', name: 'Moby-Dick', qid: 'Q174596' },
  { type: 'book', name: 'War and Peace', qid: 'Q111731093' },
  { type: 'book', name: 'The Odyssey', qid: 'Q35160' },
  { type: 'book', name: 'Jane Eyre', qid: 'Q182961' },
  { type: 'book', name: 'Do Androids Dream of Electric Sheep?', qid: 'Q605249' },
  { type: 'book', name: 'Solaris', qid: 'Q14646' },
  { type: 'book', name: 'The Time Machine', qid: 'Q627333' },
  { type: 'book', name: 'Twenty Thousand Leagues Under the Sea', qid: 'Q183565' },
  { type: 'board-game', name: 'Backgammon', qid: 'Q2878424' },
  { type: 'board-game', name: 'Go', qid: 'Q41587' },
  { type: 'board-game', name: 'Cluedo', qid: 'Q17245' },
  { type: 'board-game', name: 'Mahjong', qid: 'Q3277744' },
  { type: 'board-game', name: 'Dominoes', qid: 'Q104660734' },
  { type: 'tv-show', name: 'The X-Files', qid: 'Q2744' },
  { type: 'tv-show', name: 'Twin Peaks', qid: 'Q2085' },
  { type: 'tv-show', name: 'Doctor Who', qid: 'Q34316' },
  { type: 'tv-show', name: 'Star Trek: The Next Generation', qid: 'Q7601015' },
  { type: 'tv-show', name: 'The Twilight Zone', qid: 'Q742103' },
  { type: 'tv-show', name: 'Buffy the Vampire Slayer', qid: 'Q4035486' },
  { type: 'national-park', name: 'Everglades', qid: 'Q597281' },
  { type: 'national-park', name: 'Death Valley', qid: 'Q118388' },
  { type: 'national-park', name: 'Sequoia', qid: 'Q1975652' },
  { type: 'national-park', name: 'Mount Rainier', qid: 'Q194057' },
  { type: 'video-game', name: 'Pac-Man', qid: 'Q2626874' },
  { type: 'video-game', name: 'Tetris', qid: 'Q3519191' },
  { type: 'video-game', name: 'Doom', qid: 'Q189784' },
  { type: 'video-game', name: 'Pong', qid: 'Q216293' },
  { type: 'video-game', name: 'Space Invaders', qid: 'Q220665' },
  { type: 'video-game', name: 'The Legend of Zelda: Ocarina of Time', qid: 'Q213911' },
  { type: 'video-game', name: 'Super Mario Bros.', qid: 'Q11168' },
  { type: 'video-game', name: 'Street Fighter II', qid: 'Q1133204' },
] as const

// Reviewed fallback titles: retain this provider's own identity and credit.
// These are image IDs, never external identities for the taxonomy entity.
const fallbacks = [] as const

const media = new TaxonomyMediaService()
const report: object[] = []

async function openverse(id: string, expectedTitle: string): Promise<ImageCandidate> {
  const response = await fetch(`https://api.openverse.org/v1/images/${id}/`, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`Openverse ${response.status}`)
  const item = await response.json() as any
  if (item.title !== expectedTitle) throw new Error('Fallback identity changed; review required')
  return {
    provider: 'openverse', externalId: item.id, title: item.title,
    previewUrl: item.thumbnail, sourceUrl: item.url, landingUrl: item.foreign_landing_url,
    creator: item.creator, license: item.license, licenseUrl: item.license_url, attribution: item.attribution,
    width: item.width, height: item.height,
    importRule: ['cc0', 'pdm', 'by', 'by-sa'].includes(item.license) ? 'IMPORT_ALLOWED' : 'REVIEW_REQUIRED',
    metadata: { source: item.source, provider: item.provider, reviewedFixture: true },
  }
}

async function main() {
  const actor = await db.user.findFirst({ where: { role: 'ADMIN' } })
  if (!actor) throw new Error('Seed an ADMIN user first')
  async function attach(target: { entityId?: string; entityTypeId?: string; categoryId?: string }, candidate: ImageCandidate, label: string) {
    const metadata = { ...candidate.metadata, previewUrl: candidate.previewUrl, reviewedFixture: true }
    const previous = await db.mediaAsset.findFirst({ where: { ...target, isPrimary: true, provider: candidate.provider, sourceId: candidate.externalId } })
    if ((previous?.metadata as any)?.reviewedFixture) {
      report.push({ label, status: 'already-imported', provider: candidate.provider })
      return
    }
    const asset = await media.importAndAttach(target, { ...candidate, metadata }, actor!.id, actor!.role)
    report.push({ label, status: 'imported', provider: candidate.provider, sourceId: candidate.externalId, sha256: asset.sha256 })
  }

  for (const fixture of fixtures) {
    const type = await db.entityType.findUnique({ where: { slug: fixture.type } })
    const entity = type && await db.entity.findFirst({ where: { entityTypeId: type.id, canonicalName: fixture.name } })
    if (!type || !entity) { report.push({ label: fixture.name, status: 'missing-taxonomy-record' }); continue }
    let fetchedFromNetwork = false
    try {
      // Record the verified entity identity even when it has no usable image.
      await db.entityExternalRef.upsert({
        where: { entityId_provider: { entityId: entity.id, provider: 'wikimedia' } },
        create: { entityId: entity.id, provider: 'wikimedia', externalId: fixture.qid },
        update: { externalId: fixture.qid },
      })
      const cached = await db.mediaAsset.findFirst({ where: { entityId: entity.id, isPrimary: true, provider: 'wikimedia', sourceId: fixture.qid } })
      const candidate: ImageCandidate | null = (cached?.metadata as any)?.reviewedFixture ? {
        provider: 'wikimedia', externalId: fixture.qid, title: (cached!.metadata as any).title,
        previewUrl: (cached!.metadata as any).previewUrl ?? cached!.sourceUrl!, sourceUrl: cached!.sourceUrl!, landingUrl: cached!.landingUrl ?? undefined,
        creator: cached!.creator ?? undefined, license: cached!.license ?? undefined,
        licenseUrl: cached!.licenseUrl ?? undefined, attribution: cached!.attribution ?? undefined,
        importRule: 'IMPORT_ALLOWED', metadata: cached!.metadata as any,
      } : await (async () => {
        fetchedFromNetwork = true;
        return resolveWikidataImage(fixture.qid)
      })()
      if (!candidate || candidate.importRule !== 'IMPORT_ALLOWED') {
        report.push({ label: fixture.name, status: candidate ? 'rights-review-required' : 'missing-image', qid: fixture.qid })
        continue
      }
      await attach({ entityId: entity.id }, candidate, fixture.name)
      if ('cover' in fixture && fixture.cover) await attach({ entityTypeId: type.id }, candidate, `type:${fixture.type}`)
      const categories = await db.category.findMany({ where: { entityTypeId: type.id, ...( 'categories' in fixture ? { slug: { in: [...fixture.categories] } } : { id: '__none__' }) } })
      for (const category of categories) await attach({ categoryId: category.id }, candidate, `list:${category.slug}`)
    } catch (error: any) {
      report.push({ label: fixture.name, status: 'failed-import', reason: error.message ?? String(error) })
    }
    // Avoid hammering public APIs. Failures stay visible, never become blind matches.
    if (fetchedFromNetwork) {
      await new Promise((resolve) => setTimeout(resolve, 5000))
    }
  }
  for (const fixture of fallbacks) {
    const entity = await db.entity.findFirst({ where: { canonicalName: fixture.name, entityType: { slug: fixture.type } } })
    if (!entity) continue
    try { await attach({ entityId: entity.id }, await openverse(fixture.id, fixture.title), fixture.name) }
    catch (error: any) { report.push({ label: fixture.name, status: 'failed-fallback', reason: error.message }) }
  }

  // Quarantine the exact mismatches identified in the prior automatic seed.
  // Keep the assets and their provenance for review; only remove primary status.
  const mismatchedIds = ['cab90ed5-cf34-484b-8f83-e8f2f842c100', '4d09bf13-6ae2-409b-a955-14cc1702cdbe', 'f97b4eef-0908-4503-b79c-c75669f26b84', '2900c00a-5cd7-46bb-bdf0-03dd049b1440', 'bea82445-88cf-42ae-9f0c-29eaef5a58c7', 'c63256b9-399d-47aa-a090-91b2abb1306e', '0d16e586-0375-40b2-8268-4a6152e57cd6', 'dbe122bb-9dc6-4fa9-a672-7532c953baa7', '12275dfb-0595-4093-b4f2-994a2dc0616e', '9237a56c-1d21-49c1-8c33-61f057bdd2b9', 'f4bcdd3e-1650-4a08-b346-a7147b60ab92']
  const wrong = await db.mediaAsset.findMany({ where: { provider: 'openverse', sourceId: { in: mismatchedIds }, isPrimary: true } })
  for (const asset of wrong) {
    await db.$transaction(async (tx) => {
      await tx.mediaAsset.update({ where: { id: asset.id }, data: { isPrimary: false } })
      if (asset.entityId) await tx.entity.update({ where: { id: asset.entityId }, data: { imageUrl: null } })
      await tx.adminAuditEvent.create({ data: { actorUserId: actor.id, actorRole: actor.role, action: 'quarantine_mismatched_thumbnail', targetType: 'media_asset', targetId: asset.id, beforeValue: { isPrimary: true }, afterValue: { isPrimary: false } } })
    })
  }
  const itemsToClear = [...fixtures, ...fallbacks]
  for (const f of itemsToClear) {
    await db.entityExternalRef.deleteMany({ where: { provider: 'openverse', entity: { canonicalName: f.name, entityType: { slug: f.type } } } })
  }
  console.log(JSON.stringify({ results: report, quarantined: wrong.length, primaryAssets: await db.mediaAsset.count({ where: { isPrimary: true } }) }, null, 2))
  if (report.some((r: any) => r.status.startsWith('failed'))) process.exitCode = 1
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
