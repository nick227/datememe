/** Great-circle distance in km — used for the "Near me" Discover filter. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export type AgeBucket = '20s' | '30s' | '40s' | '50plus'
export type DateRange = { gte: Date; lte: Date }

/** Birthdate range for an age bucket, computed from today. A *browse shortcut* only — see ageRangeForPreference for the eligibility baseline it narrows. */
export function ageBucketToBirthdateRange(bucket: AgeBucket, now = new Date()): DateRange {
  const yearsAgo = (years: number) => new Date(now.getFullYear() - years, now.getMonth(), now.getDate())
  switch (bucket) {
    case '20s':
      return { gte: yearsAgo(30), lte: yearsAgo(20) }
    case '30s':
      return { gte: yearsAgo(40), lte: yearsAgo(30) }
    case '40s':
      return { gte: yearsAgo(50), lte: yearsAgo(40) }
    case '50plus':
      return { gte: yearsAgo(120), lte: yearsAgo(50) }
  }
}

/** Birthdate range implied by a min/max *age* preference (the baseline eligibility system age buckets narrow, not replace). */
export function ageRangeForPreference(minAge: number, maxAge: number, now = new Date()): DateRange {
  const yearsAgo = (years: number) => new Date(now.getFullYear() - years, now.getMonth(), now.getDate())
  // Someone turning `maxAge+1` today is the oldest still-eligible birthdate (gte);
  // someone who turned `minAge` today is the youngest still-eligible (lte).
  return { gte: yearsAgo(maxAge + 1), lte: yearsAgo(minAge) }
}

/** The tighter of two date ranges — how an age-bucket browse shortcut narrows (never widens) the baseline preference range. */
export function intersectDateRange(a: DateRange, b: DateRange): DateRange {
  return { gte: a.gte > b.gte ? a.gte : b.gte, lte: a.lte < b.lte ? a.lte : b.lte }
}
