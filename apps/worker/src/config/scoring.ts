/**
 * PROVISIONAL SCORING CONFIGURATION (POC MVP)
 * 
 * These parameters govern the exact-overlap vs. axis-similarity math in the matching engine.
 * They are currently set to safe MVP defaults and should be tuned once we have real user behavior data
 * or a properly stratified synthetic calibration suite.
 */

export const SCORING_CONFIG = {
  // Maximum points for the two scoring layers (Total = 100)
  MAX_EXACT_POINTS: 80,
  MAX_AXIS_POINTS: 20,

  // EXACT OVERLAP SHINKAGE
  // The value of `k` in the shrinkage formula: n / (n + k).
  // A higher `k` demands more shared categories before giving full exact points.
  // 3 means 1 shared category retains 25% of its potential points.
  SHRINKAGE_K: 3,

  // AXIS DAMPING
  // The divisor for axis confidence: min(1, min(listsA, listsB) / DIVISOR).
  // 5 means a user needs 5 completed lists to be fully trusted on axis vectors.
  AXIS_CONFIDENCE_DIVISOR: 5,

  // RARITY WEIGHTING
  // The baseline percentage share (as a decimal) where rarity weight W = 1.
  // 0.01 means a 1% share or less gets maximum weight.
  RARITY_BASELINE: 0.01,

  // DISCOVERABILITY FLOOR
  // The minimum total score required to save a CompatibilityScore row if they share 0 items.
  // Lowered to 5 temporarily for POC MVP to prevent empty discover feeds for new users.
  // This is a stand-in for a proper fallback feed.
  AXIS_ONLY_FLOOR: 5,
}
