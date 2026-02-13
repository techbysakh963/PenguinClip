/**
 * GIF Service
 * Handles fetching GIFs from Tenor API v1
 *
 * SECURITY NOTE: GIF integration is an optional feature that communicates
 * with Google's Tenor API. Search queries and your IP address are visible
 * to Tenor/Google. This feature is disabled by default and requires the
 * user to provide their own API key.
 *
 * To enable: Settings > GIF Integration > Enter your Tenor API key
 * Get a key at: https://developers.google.com/tenor/guides/quickstart
 */
import type { Gif } from '../types/gif'

// SECURITY: No hardcoded API key. Users must provide their own.
// This prevents credential leakage and ensures users consciously opt-in
// to external API communication.
let _tenorApiKey: string | null = null
const TENOR_API_BASE = 'https://g.tenor.com/v1'
const DEFAULT_LIMIT = 30

/**
 * Set the Tenor API key. Must be called before any GIF fetching.
 * The key is stored in memory only and not persisted by this module.
 */
export function setTenorApiKey(key: string | null) {
  _tenorApiKey = key && key.trim() ? key.trim() : null
}

/**
 * Check if GIF integration is configured (API key provided)
 */
export function isGifEnabled(): boolean {
  return _tenorApiKey !== null && _tenorApiKey.length > 0
}

function getApiKey(): string {
  if (!_tenorApiKey) {
    throw new Error(
      'GIF integration is not configured. Please provide a Tenor API key in Settings.',
    )
  }
  return _tenorApiKey
}

interface TenorV1MediaFormat {
  url: string
  dims: [number, number]
  size: number
}

interface TenorV1Media {
  gif?: TenorV1MediaFormat
  mediumgif?: TenorV1MediaFormat
  tinygif?: TenorV1MediaFormat
  nanogif?: TenorV1MediaFormat
}

interface TenorV1Result {
  id: string
  title: string
  media: TenorV1Media[]
  content_description?: string
  itemurl: string
  url: string
  tags: string[]
  created: number
}

interface TenorV1Response {
  results: TenorV1Result[]
  next: string
}

function transformTenorResult(result: TenorV1Result): Gif {
  // v1 API has media as an array, get the first item
  const mediaFormats = result.media[0]
  if (!mediaFormats) {
    throw new Error(`Missing media for GIF: ${result.id}`)
  }

  // Use nanogif for preview (smallest size for grid)
  const preview = mediaFormats.nanogif || mediaFormats.tinygif
  // Use tinygif for full display (good balance of quality and size)
  const full = mediaFormats.tinygif || mediaFormats.mediumgif || mediaFormats.gif

  if (!preview || !full) {
    throw new Error(`Missing media formats for GIF: ${result.id}`)
  }

  return {
    id: result.id,
    title: result.content_description || result.title || 'GIF',
    previewUrl: preview.url,
    fullUrl: full.url,
    width: preview.dims[0],
    height: preview.dims[1],
  }
}

/**
 * Fetch trending GIFs from Tenor
 */
export async function fetchTrendingGifs(limit: number = DEFAULT_LIMIT): Promise<Gif[]> {
  const params = new URLSearchParams({
    key: getApiKey(),
    limit: String(limit),
    media_filter: 'minimal',
  })

  const response = await fetch(`${TENOR_API_BASE}/trending?${params}`)

  if (!response.ok) {
    throw new Error(`Tenor API error: ${response.status} ${response.statusText}`)
  }

  const data: TenorV1Response = await response.json()

  return data.results
    .map((result) => {
      try {
        return transformTenorResult(result)
      } catch {
        console.warn(`Skipping malformed GIF result: ${result.id}`)
        return null
      }
    })
    .filter((gif): gif is Gif => gif !== null)
}

/**
 * Search GIFs by query
 */
export async function searchGifs(query: string, limit: number = DEFAULT_LIMIT): Promise<Gif[]> {
  if (!query.trim()) {
    return fetchTrendingGifs(limit)
  }

  const params = new URLSearchParams({
    key: getApiKey(),
    q: query.trim(),
    limit: String(limit),
    media_filter: 'minimal',
  })

  const response = await fetch(`${TENOR_API_BASE}/search?${params}`)

  if (!response.ok) {
    throw new Error(`Tenor API error: ${response.status} ${response.statusText}`)
  }

  const data: TenorV1Response = await response.json()

  return data.results
    .map((result) => {
      try {
        return transformTenorResult(result)
      } catch {
        console.warn(`Skipping malformed GIF result: ${result.id}`)
        return null
      }
    })
    .filter((gif): gif is Gif => gif !== null)
}
