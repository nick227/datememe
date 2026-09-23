import type { ConfigContext, ExpoConfig } from 'expo/config'

// This is the only approved API for the QA binary. Changing it requires review.
const STAGING_API_URL = 'https://qa-server-staging.up.railway.app'

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT ?? 'development'
  if (!['development', 'staging', 'production'].includes(variant)) {
    throw new Error(`Unknown APP_VARIANT: ${variant}`)
  }
  if (process.env.EAS_BUILD_PROFILE &&
      (process.env.EAS_BUILD_PROFILE !== 'qa' || variant !== 'staging')) {
    throw new Error('Only the staging qa EAS build profile is configured in milestone 1')
  }

  const apiUrl = process.env.EXPO_PUBLIC_API_URL
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is required; see apps/mobile/.env.example')
  const parsed = new URL(apiUrl)
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('API URL must be an HTTP(S) URL without credentials, query, or fragment')
  }
  if (variant === 'staging' && apiUrl !== STAGING_API_URL) {
    throw new Error(`Staging builds must use exactly ${STAGING_API_URL}`)
  }
  if (variant === 'production' && parsed.protocol !== 'https:') {
    throw new Error('Production requires an HTTPS API URL')
  }

  const projectId = process.env.EAS_PROJECT_ID ?? config.extra?.eas?.projectId
  const owner = process.env.EXPO_OWNER ?? config.owner
  if (process.env.EAS_BUILD_PROFILE && (!projectId || !owner)) {
    throw new Error('Set EAS_PROJECT_ID and EXPO_OWNER before building QA')
  }
  if (projectId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) {
    throw new Error('EAS_PROJECT_ID must be the UUID of the organization-owned EAS project')
  }

  const suffix = variant === 'production' ? '' : variant === 'staging' ? '.staging' : '.dev'
  return {
    ...config,
    name: variant === 'staging' ? 'Datememe QA' : variant === 'development' ? 'Datememe Dev' : 'Datememe',
    slug: 'datememe',
    ...(owner ? { owner } : {}),
    android: { ...config.android, package: `com.datememe.app${suffix}`, versionCode: 1 },
    // Runtime consumes this validated value; there is no separate localhost fallback.
    extra: { ...config.extra, appVariant: variant, apiUrl: apiUrl.replace(/\/$/, ''), ...(projectId ? { eas: { projectId } } : {}) },
  }
}
