import { createApiClient } from '@project/sdk'
import { getToken } from './authToken'
import Constants from 'expo-constants'
import { File } from 'expo-file-system'

// app.config.ts validates and embeds the endpoint for this artifact.
const API_URL = Constants.expoConfig?.extra?.apiUrl
if (typeof API_URL !== 'string' || !API_URL) {
  throw new Error('Missing API configuration; rebuild with EXPO_PUBLIC_API_URL set')
}

export function initApiClient() {
  createApiClient({
    baseUrl: API_URL,
    getToken, // native app: Bearer token from SecureStore, not a cookie jar
    resolveUploadFile: (uri) => new File(uri),
  })
}
