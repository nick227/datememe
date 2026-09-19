import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'datememe.authToken'

// In-memory cache so createApiClient's getToken() can be synchronous — openapi-fetch's
// middleware isn't async-friendly here, and SecureStore reads are async.
let cachedToken: string | null = null

export async function loadToken() {
  cachedToken = await SecureStore.getItemAsync(TOKEN_KEY)
  return cachedToken
}

export function getToken() {
  return cachedToken
}

export async function setToken(token: string) {
  cachedToken = token
  await SecureStore.setItemAsync(TOKEN_KEY, token)
}

export async function clearToken() {
  cachedToken = null
  await SecureStore.deleteItemAsync(TOKEN_KEY)
}
