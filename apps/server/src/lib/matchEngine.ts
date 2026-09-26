import { db } from '@project/db';

export async function computeCompatibility(profileIdA: string, profileIdB: string) {
  // 1. Fetch raw picks for both profiles
  const listsA = await db.list.findMany({
    where: { profileId: profileIdA },
    include: {
      category: true,
      items: { include: { entity: true } }
    }
  });

  const listsB = await db.list.findMany({
    where: { profileId: profileIdB },
    include: {
      category: true,
      items: { include: { entity: true } }
    }
  });

  // Extract all entity IDs and group by category
  const picksA = new Map<string, any>(); // entityId -> { entity, category }
  listsA.forEach(list => {
    list.items.forEach(item => {
      picksA.set(item.entityId, { entity: item.entity, category: list.category });
    });
  });

  const sharedFavorites: any[] = [];
  const sharedAxesMap = new Map<string, number>();
  
  listsB.forEach(list => {
    list.items.forEach(item => {
      if (picksA.has(item.entityId)) {
        const matchA = picksA.get(item.entityId)!;
        sharedFavorites.push({
          categoryShortLabel: matchA.category.shortLabel,
          entityName: item.entity.canonicalName,
          axes: (matchA.category.axes as string[]) || []
        });
        
        const axes = (matchA.category.axes as string[]) || [];
        for (const axis of axes) {
          sharedAxesMap.set(axis, (sharedAxesMap.get(axis) || 0) + 1);
        }
      }
    });
  });

  // 2. Generate weighted overlap summary / score
  const sharedItemsCount = sharedFavorites.length;
  
  // Basic scoring formula
  // E.g., each unique overlapping item gives some base score.
  // Overlapping heavily in one axis shouldn't infinitely increase score.
  // Let's cap the axis contribution.
  let score = 0;
  for (const [axis, count] of sharedAxesMap.entries()) {
    // Diminishing returns per axis
    score += Math.min(count, 3) * 15; // Max 45 points per shared axis
  }
  
  // Add base points for raw overlaps independent of axes
  score += sharedItemsCount * 5; 
  
  score = Math.min(Math.round(score), 100);

  // 3. Human-readable insights
  const insights: string[] = [];
  
  // Sort axes by frequency
  const sortedAxes = Array.from(sharedAxesMap.entries()).sort((a, b) => b[1] - a[1]);
  
  if (sortedAxes.length > 0) {
    const topAxis = sortedAxes[0][0];
    const capitalizedTopAxis = topAxis.charAt(0).toUpperCase() + topAxis.slice(1);
    insights.push(`Strongest overlap: ${capitalizedTopAxis}`);
    
    if (sortedAxes.length > 1) {
      const secondAxis = sortedAxes[1][0];
      const capitalizedSecondAxis = secondAxis.charAt(0).toUpperCase() + secondAxis.slice(1);
      insights.push(`Shared interests: ${capitalizedTopAxis}, ${capitalizedSecondAxis}`);
    }
  }

  if (sharedItemsCount >= 5) {
    const uniqueThemes = sortedAxes.length;
    insights.push(`${sharedItemsCount} shared picks across ${uniqueThemes} themes`);
  } else if (sharedItemsCount > 0) {
    insights.push(`You share ${sharedItemsCount} favorite${sharedItemsCount > 1 ? 's' : ''}`);
  } else {
    insights.push("Opposites attract! No exact shared picks yet.");
  }

  // Format shared favorites to match the expected schema
  const formattedSharedFavorites = sharedFavorites.map(sf => ({
    categoryShortLabel: sf.categoryShortLabel,
    entityName: sf.entityName,
  }));

  return {
    score,
    sharedItemsCount,
    sharedFavorites: formattedSharedFavorites,
    insights: insights.slice(0, 3) // max 3 insights
  };
}

export async function updateAllMatches() {
  const profiles = await db.profile.findMany({ select: { id: true } });
  let updatedCount = 0;
  
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const pA = profiles[i].id;
      const pB = profiles[j].id;
      
      const { score, sharedItemsCount, sharedFavorites, insights } = await computeCompatibility(pA, pB);
      
      const [idA, idB] = [pA, pB].sort();
      
      await db.compatibilityScore.upsert({
        where: { profileIdA_profileIdB: { profileIdA: idA, profileIdB: idB } },
        update: { score, sharedItemsCount, sharedFavorites, insights },
        create: { profileIdA: idA, profileIdB: idB, score, sharedItemsCount, sharedFavorites, insights },
      });
      updatedCount++;
    }
  }
  
  console.log(`Updated ${updatedCount} matches`);
}
