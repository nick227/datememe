const items = [
  ...['Whole Foods', 'Trader Joe\'s', 'Aldi', 'Kroger', 'Publix', 'H-E-B', 'Safeway', 'Wegmans', 'Meijer', 'H Mart', 'Target', 'Sprouts', 'Costco'].map(n => ({type: 'grocery-store', name: n})),
  ...['Sweetgreen', 'In-N-Out', 'Shake Shack', 'Taco Bell', 'Cava', 'Popeyes', 'Chipotle', 'Culver\'s', 'Waffle House', 'McDonald\'s', 'Wendy\'s', 'Burger King', 'Chick-fil-A', 'Subway', 'Five Guys'].map(n => ({type: 'fast-food-chain', name: n})),
  ...['Starbucks', 'Peet\'s Coffee', 'Dunkin\'', 'Philz Coffee', 'Blue Bottle Coffee', 'Dutch Bros', 'Tim Hortons', 'Caribou Coffee', 'Costa Coffee', 'Pret A Manger', 'Panera Bread', 'Blank Street Coffee'].map(n => ({type: 'coffee-chain', name: n})),
  ...['Patagonia', 'Nike', 'Zara', 'Carhartt', 'Lululemon', 'Uniqlo', 'The North Face', 'Levi\'s', 'Adidas', 'Everlane', 'H&M', 'Gucci', 'Supreme', 'Ralph Lauren', 'Vans'].map(n => ({type: 'clothing-brand', name: n})),
  ...['Instagram', 'TikTok', 'Twitter / X', 'Reddit', 'LinkedIn', 'Pinterest', 'Snapchat', 'BeReal', 'YouTube', 'Facebook', 'Twitch', 'Discord'].map(n => ({type: 'social-media', name: n, q: n === 'Twitter / X' ? 'Twitter' : n})),
  ...['Japan', 'Italy', 'Australia', 'New Zealand', 'Iceland', 'Switzerland', 'Greece', 'Spain', 'France', 'Brazil', 'Thailand', 'South Africa', 'Peru', 'Maldives', 'Canada'].map(n => ({type: 'country', name: n})),
  ...['Italian', 'Mexican', 'Japanese', 'Indian', 'Thai', 'Chinese', 'French', 'Mediterranean', 'Greek', 'Korean', 'Vietnamese', 'Spanish', 'Lebanese', 'Ethiopian', 'Peruvian'].map(n => ({type: 'cuisine', name: n, q: n + ' cuisine'})),
];

async function main() {
  const results = [];
  for (const item of items) {
    const searchName = (item as any).q || item.name;
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(searchName)}&language=en&format=json`;
    let success = false;
    let retries = 3;
    while (!success && retries > 0) {
      try {
        const res = await fetch(url, {
            headers: { 'User-Agent': 'datememe-seed-script/1.0 (test@example.com)' }
        });
        if (res.status === 429) {
            await new Promise(r => setTimeout(r, 2000));
            retries--;
            continue;
        }
        const data = await res.json();
        const match = data.search[0];

        if (match) {
          results.push(`  { type: '${item.type}', name: '${item.name.replace(/'/g, "\\'")}', qid: '${match.id}' }, // ${match.description || 'No description'}`);
        } else {
          results.push(`  // Not found: ${item.name}`);
        }
        success = true;
      } catch (e: any) {
        retries--;
        if (retries === 0) results.push(`  // Error: ${item.name} (${e.message})`);
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    await new Promise(r => setTimeout(r, 500)); 
  }

  console.log(results.join('\n'));
}

main();
