import { createApiClient } from '@project/sdk'
import { getToken } from './authToken'

// EXPO_PUBLIC_-prefixed env vars are inlined at build time by Expo — see .env.example.
const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001'

export function initApiClient() {
  createApiClient({
    baseUrl: API_URL,
    getToken, // native app: Bearer token from SecureStore, not a cookie jar
  })
}
