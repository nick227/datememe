import createClient, { type Middleware } from 'openapi-fetch'
import type { paths } from './generated/types'

type ClientConfig = {
  baseUrl: string
  getToken?: () => string | null // only for native apps; web uses httpOnly cookies
  resolveUploadFile?: (uri: string) => Blob | Promise<Blob>
}

let _client: ReturnType<typeof createClient<paths>> | null = null
let _config: ClientConfig | null = null

export function createApiClient(config: ClientConfig) {
  const client = createClient<paths>({
    baseUrl: config.baseUrl,
    credentials: 'include', // send httpOnly session cookie automatically (web)
  })

  if (config.getToken) {
    const authMiddleware: Middleware = {
      async onRequest({ request }) {
        const token = config.getToken!()
        if (token) request.headers.set('Authorization', `Bearer ${token}`)
        return request
      },
    }
    client.use(authMiddleware)
  }

  _client = client
  _config = config
  return client
}

export function getApiClient() {
  if (!_client) throw new Error('Call createApiClient() before using hooks.')
  return _client
}

/**
 * Only for the handful of call sites `openapi-fetch` can't cover — multipart
 * uploads need a raw `fetch` + `FormData`, but still want the same base URL and
 * auth (Bearer for native, cookie for web) as every other request.
 */
export function getClientConfig() {
  if (!_config) throw new Error('Call createApiClient() before using hooks.')
  return _config
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
