export const TOKEN_KEY = 'followupflow:access-token'

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

const configuredBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim()
const localHosts = ['localhost', '127.0.0.1', '::1']
const isLocal = typeof window !== 'undefined' && localHosts.includes(window.location.hostname)
const API_BASE = (configuredBase || (isLocal ? `${window.location.protocol}//${window.location.hostname}:5000/api` : `${window.location.origin}/api`)).replace(/\/+$/, '')

export class ApiError extends Error {
  status: number
  details?: Record<string, string>

  constructor(message: string, status: number, details?: Record<string, string>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken()
  const headers = new Headers(options.headers)

  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...options, headers })
  } catch {
    throw new ApiError('Cannot reach the FollowUpFlow API. Check that the backend is running.', 0)
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    throw new ApiError('The API returned an unexpected response. Check VITE_API_URL and the backend deployment.', response.status)
  }

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    const error = (payload as { error?: string; details?: Record<string, string> }).error
    throw new ApiError(error || `Request failed with status ${response.status}`, response.status,
      (payload as { details?: Record<string, string> }).details)
  }

  return payload as T
}

export const apiBaseUrl = API_BASE
