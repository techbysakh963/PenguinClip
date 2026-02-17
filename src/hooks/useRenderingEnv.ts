import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { RenderingEnv } from '../types/clipboard'

const DEFAULT_RENDERING_ENV: RenderingEnv = {
  is_nvidia: false,
  is_appimage: false,
  transparency_disabled: false,
  reason: '',
}

let cachedEnv: RenderingEnv | null = null
let pendingEnvPromise: Promise<RenderingEnv> | null = null

export function useRenderingEnv() {
  const [env, setEnv] = useState<RenderingEnv>(cachedEnv ?? DEFAULT_RENDERING_ENV)

  useEffect(() => {
    if (cachedEnv) return

    if (!pendingEnvPromise) {
      pendingEnvPromise = invoke<RenderingEnv>('get_rendering_environment')
        .then((result) => {
          cachedEnv = result
          return result
        })
        .catch((err) => {
          console.error('Failed to query rendering environment:', err)
          throw err
        })
        .finally(() => {
          pendingEnvPromise = null
        })
    }

    pendingEnvPromise
      .then((result) => setEnv(result))
      .catch(() => {})
  }, [])

  return env
}
