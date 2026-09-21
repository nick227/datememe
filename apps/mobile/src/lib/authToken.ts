import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

const TOKEN_KEY = 'datememe.authToken'

// In-memory cache so createApiClient's getToken() can be synchronous — openapi-fetch's
// middleware isn't async-friendly here, and SecureStore reads are async.
let cachedToken: string | null = null

export async function loadToken() {
  if (Platform.OS === 'web') {
    cachedToken = localStorage.getItem(TOKEN_KEY)
  } else {
    cachedToken = await SecureStore.getItemAsync(TOKEN_KEY)
  }
  return cachedToken
}

export function getToken() {
  return cachedToken
}

export async function setToken(token: string) {
  cachedToken = token
  if (Platform.OS === 'web') {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token)
  }
}

export async function clearToken() {
  cachedToken = null
  if (Platform.OS === 'web') {
    localStorage.removeItem(TOKEN_KEY)
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  }
}
