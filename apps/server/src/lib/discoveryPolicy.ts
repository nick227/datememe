/**
 * Tunable Discover-matching constants, named and env-overridable rather than
 * inlined magic numbers — see DiscoveryService.
 */
export const DISCOVERY_POLICY = {
  /** "Near me" radius in km. V1 default; not meant to be the only value ever supported. */
  nearMeRadiusKm: Number(process.env.DISCOVERY_NEAR_ME_RADIUS_KM ?? 80),
}
