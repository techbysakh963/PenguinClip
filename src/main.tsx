import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { getCurrentWindow, getAllWindows } from '@tauri-apps/api/window'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import ClipboardApp from './ClipboardApp'
import SettingsApp from './SettingsApp'
import { SetupApp } from './setup'
import './index.css'

/**
 * Main app wrapper that handles first-run check and launches setup window if needed
 */
function ClipboardAppWithSetup() {
  const [loading, setLoading] = useState(true)
  const [waitingForSetup, setWaitingForSetup] = useState(false)

  useEffect(() => {
    let unlistenSetup: (() => void) | undefined

    const init = async () => {
      unlistenSetup = await listen('setup_complete', () => {
        setWaitingForSetup(false)
      })

      try {
        const isFirst = await invoke<boolean>('is_first_run')
        if (isFirst) {
          setWaitingForSetup(true)

          const windows = await getAllWindows()
          const setupWin = windows.find((w) => w.label === 'setup')

          if (setupWin) {
            await setupWin.show()
            await setupWin.setFocus()
          } else {
            // Fallback: create setup window if it doesn't exist
            const newSetupWin = new WebviewWindow('setup')
            newSetupWin.once('tauri://created', () => {
              newSetupWin.show()
              newSetupWin.setFocus()
            })
          }
        }
        setLoading(false)
      } catch (err: unknown) {
        console.error('Failed to check first run:', err)
        setLoading(false)
      }
    }

    init()

    return () => {
      if (unlistenSetup) unlistenSetup()
    }
  }, [])

  if (loading || waitingForSetup) {
    return null
  }

  return <ClipboardApp />
}

/**
 * Root component that routes based on the current window's label
 */
export default function Root() {
  const [windowLabel] = useState<string>(() => getCurrentWindow().label)

  if (windowLabel === 'settings') {
    return <SettingsApp />
  }

  if (windowLabel === 'setup') {
    return <SetupApp />
  }

  return <ClipboardAppWithSetup />
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
