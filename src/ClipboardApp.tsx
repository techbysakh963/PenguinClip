import { useState, useCallback, useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useClipboardHistory } from './hooks/useClipboardHistory'
import { setTenorApiKey, isGifEnabled } from './services/gifService'
import { TabBar, TabBarRef } from './components/TabBar'
import { DragHandle } from './components/DragHandle'
import { EmojiPicker } from './components/EmojiPicker'
import { GifPicker } from './components/GifPicker'
import { KaomojiPicker } from './components/KaomojiPicker'
import { SymbolPicker } from './components/SymbolPicker'
import { calculateSecondaryOpacity, calculateTertiaryOpacity } from './utils/themeUtils'
import { useSystemThemePreference } from './utils/systemTheme'
import { useRenderingEnv } from './hooks/useRenderingEnv'
import type { ActiveTab, UserSettings } from './types/clipboard'
import { ClipboardTab } from './components/ClipboardTab'
import { NotificationBanner } from './components/NotificationBanner'
import { ToastViewport } from './components/ToastViewport'
import { useToasts } from './hooks/useToasts'
import { applyAppearance, loadAppearance, type AppearanceTokens } from './utils/appearanceTokens'
import { applyStoredTheme, applyTheme } from './utils/applyTheme'

// Real window-level acrylic. The window is now tauri `transparent: true` and the
// <body> goes transparent under [data-fx='glass'], so the shell becomes real
// translucent acrylic wherever the rendering env reports transparency is safe
// (i.e. not NVIDIA/AppImage, unless force-enabled via PENGUINCLIP_FORCE_TRANSPARENCY).
// NVIDIA/AppImage still fall back to the premium-opaque shell.
const WINDOW_ACRYLIC_ENABLED = true

const DEFAULT_SETTINGS: UserSettings = {
  theme_mode: 'system',
  dark_background_opacity: 1,
  light_background_opacity: 1,
  enable_smart_actions: true,
  enable_ui_polish: true,
  enable_dynamic_tray_icon: true,
  max_history_size: 50,
  auto_delete_interval: 0,
  auto_delete_unit: 'hours',
  excluded_patterns: [],
  custom_kaomojis: [],
  ui_scale: 1,
  tenor_api_key: '',
}

/**
 * Maps theme mode setting to actual dark mode state.
 * For 'system' mode, this hook delegates system theme detection
 * to useSystemThemePreference().
 */
function useThemeMode(themeMode: 'system' | 'dark' | 'light'): boolean {
  const systemPrefersDark = useSystemThemePreference()

  if (themeMode === 'dark') return true
  if (themeMode === 'light') return false
  return systemPrefersDark // 'system' mode
}

/**
 * Applies background opacity CSS variables based on user settings
 * Opacity: 0.0 = fully transparent, 1.0 = fully opaque
 */
function applyBackgroundOpacity(settings: UserSettings) {
  const root = document.documentElement

  // The gradient end is slightly less opaque than start for a subtle effect
  // Using a small offset (0.03) to create a gentle gradient
  const darkStart = settings.dark_background_opacity
  const darkEnd = darkStart >= 1 ? 1 : Math.max(0, darkStart - 0.03)
  const lightStart = settings.light_background_opacity
  const lightEnd = lightStart >= 1 ? 1 : Math.max(0, lightStart - 0.05)

  root.style.setProperty('--win11-dark-bg-alpha-start', darkStart.toString())
  root.style.setProperty('--win11-dark-bg-alpha-end', darkEnd.toString())
  root.style.setProperty('--win11-light-bg-alpha-start', lightStart.toString())
  root.style.setProperty('--win11-light-bg-alpha-end', lightEnd.toString())
}

/**
 * Updates the document's dark class based on theme
 */
function applyThemeClass(isDark: boolean) {
  if (isDark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

/**
 * Applies the clipboard text size. Rather than zooming the whole webview (which
 * also scaled icons, padding, and chrome), this only scales the copied-text in
 * history items via the --clip-text-scale CSS variable.
 */
function applyUIScale(scale: number) {
  document.documentElement.style.setProperty('--clip-text-scale', String(scale || 1))
}

/**
 * Main Clipboard App Component
 */
function ClipboardApp() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('clipboard')
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [settingsLoaded, setSettingsLoaded] = useState(false)
  const [loadStatus, setLoadStatus] = useState<string | null>(null)

  const isDark = useThemeMode(settings.theme_mode)
  const renderingEnv = useRenderingEnv()
  const opacity = renderingEnv.transparency_disabled
    ? 1
    : isDark
      ? settings.dark_background_opacity
      : settings.light_background_opacity
  const secondaryOpacity = calculateSecondaryOpacity(opacity)
  const tertiaryOpacity = calculateTertiaryOpacity(opacity)

  const {
    history,
    isLoading,
    error,
    clearError,
    clearHistory,
    deleteItem,
    togglePin,
    toggleFavorite,
    pasteItem,
  } = useClipboardHistory()

  // Transient confirmation toasts for actions that keep the window open
  // (pin/favourite/delete/clear). Paste deliberately stays silent because the
  // window hides immediately after.
  const { toasts, push } = useToasts()

  const handleTogglePin = useCallback(
    (id: string) => {
      const wasPinned = history.find((i) => i.id === id)?.pinned
      togglePin(id)
      push(wasPinned ? 'Unpinned' : 'Pinned', 'pin')
    },
    [history, togglePin, push]
  )

  const handleToggleFavorite = useCallback(
    (id: string) => {
      const wasFavorited = history.find((i) => i.id === id)?.favorited
      toggleFavorite(id)
      push(wasFavorited ? 'Removed from favorites' : 'Added to favorites', 'star')
    },
    [history, toggleFavorite, push]
  )

  const handleDeleteItem = useCallback(
    (id: string) => {
      deleteItem(id)
      push('Removed', 'trash')
    },
    [deleteItem, push]
  )

  const handleClearHistory = useCallback(() => {
    clearHistory()
    push('History cleared', 'trash')
  }, [clearHistory, push])

  // Refs for focus management
  const tabBarRef = useRef<TabBarRef>(null)
  const contentContainerRef = useRef<HTMLDivElement>(null)

  // Load initial settings and set up listener for changes
  useEffect(() => {
    // Load initial settings
    invoke<UserSettings>('get_user_settings')
      .then((loadedSettings) => {
        setSettings(loadedSettings)
        applyBackgroundOpacity(loadedSettings)
        applyUIScale(loadedSettings.ui_scale)
        setTenorApiKey(loadedSettings.tenor_api_key || null)
        setSettingsLoaded(true)
      })
      .catch((err) => {
        console.error('Failed to load user settings:', err)
        applyBackgroundOpacity(DEFAULT_SETTINGS)
        applyUIScale(DEFAULT_SETTINGS.ui_scale)
        setTenorApiKey(null)
        setSettingsLoaded(true)
      })

    // Listen for settings changes from the settings window
    const unlistenPromise = listen<UserSettings>('app-settings-changed', (event) => {
      const newSettings = event.payload
      setSettings(newSettings)
      applyBackgroundOpacity(newSettings)
      applyUIScale(newSettings.ui_scale)
      setTenorApiKey(newSettings.tenor_api_key || null)
    })

    // Listen for switch-tab events from Rust (e.g., when Super+. is pressed)
    const unlistenSwitchTab = listen<string>('switch-tab', (event) => {
      const tabName = event.payload as ActiveTab
      if (['clipboard', 'favorites', 'emoji', 'gifs', 'kaomoji', 'symbols'].includes(tabName)) {
        setActiveTab(tabName)
      }
    })

    return () => {
      unlistenPromise.then((unlisten) => unlisten())
      unlistenSwitchTab.then((unlisten) => unlisten())
    }
  }, [])

  // Surface any history load problem (e.g. corruption recovery) once on startup.
  useEffect(() => {
    invoke<string | null>('get_history_load_status')
      .then((status) => {
        if (status) setLoadStatus(status)
      })
      .catch((err) => console.error('Failed to fetch history load status:', err))
  }, [])

  // Apply theme class when isDark changes
  useEffect(() => {
    applyThemeClass(isDark)
  }, [isDark])

  // Apply user appearance tokens (accent / glass / roundness) on load, and keep
  // them in sync live when changed from the Settings window.
  useEffect(() => {
    applyAppearance(loadAppearance())
    applyStoredTheme()
    const unlistenAppearance = listen<AppearanceTokens>('appearance-changed', (event) => {
      applyAppearance(event.payload)
    })
    const unlistenTheme = listen<string>('theme-changed', (event) => {
      applyTheme(event.payload)
    })
    return () => {
      unlistenAppearance.then((fn) => fn())
      unlistenTheme.then((fn) => fn())
    }
  }, [])

  // Pick the rendering path for the adaptive glass shell. Real window acrylic
  // additionally requires the main window to be OS-transparent
  // (tauri.conf `transparent: true`) plus a transparent <body>; until that is
  // enabled and verified on a transparent compositor, every machine uses the
  // premium-opaque shell. The CSS keys off :root[data-fx], so flipping
  // WINDOW_ACRYLIC_ENABLED on is all that's needed once tested.
  useEffect(() => {
    const glass = WINDOW_ACRYLIC_ENABLED && !renderingEnv.transparency_disabled
    document.documentElement.dataset.fx = glass ? 'glass' : 'opaque'
  }, [renderingEnv.transparency_disabled])

  // Keep the shell's glass tint in sync with the Background-Opacity setting so
  // the existing slider still controls window translucency on transparent DEs.
  useEffect(() => {
    const rgb = isDark ? '32, 32, 32' : '243, 243, 243'
    const alpha = isDark ? settings.dark_background_opacity : settings.light_background_opacity
    document.documentElement.style.setProperty('--shell-glass-bg', `rgba(${rgb}, ${alpha})`)
  }, [isDark, settings.dark_background_opacity, settings.light_background_opacity])

  // Handle ESC key to close/hide window
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        try {
          await getCurrentWindow().hide()
        } catch (err) {
          console.error('Failed to hide window:', err)
        }
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown)
    return () => globalThis.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Use refs to store current values for the focus handler (to avoid re-registering listener)
  const activeTabRef = useRef(activeTab)

  // Keep refs in sync
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  // Handle window-shown event for focus management (registered once)
  useEffect(() => {
    const focusFirstItem = () => {
      // Small delay to ensure the window is fully rendered and focused
      setTimeout(() => {
        const currentTab = activeTabRef.current

        if (currentTab !== 'clipboard') {
          // Focus the first tab button if on other tabs
          // Clipboard tab focus is handled inside ClipboardTab component
          tabBarRef.current?.focusFirstTab()
        }
      }, 100)
    }

    // Listen to window-shown event (emitted from Rust when window is toggled visible)
    const unlistenWindowShown = listen('window-shown', focusFirstItem)

    return () => {
      unlistenWindowShown.then((unlisten) => unlisten())
    }
  }, []) // Empty dependency array - listener is registered once

  // Handle tab change
  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab)
  }, [])

  const handleMouseEnter = () => {
    invoke('set_mouse_state', { inside: true }).catch(console.error)
  }

  const handleMouseLeave = () => {
    invoke('set_mouse_state', { inside: false }).catch(console.error)
  }

  // Render content based on active tab
  const renderContent = () => {
    switch (activeTab) {
      case 'clipboard':
        return (
          <ClipboardTab
            history={history}
            isLoading={isLoading}
            isDark={isDark}
            tertiaryOpacity={tertiaryOpacity}
            secondaryOpacity={secondaryOpacity}
            clearHistory={handleClearHistory}
            deleteItem={handleDeleteItem}
            togglePin={handleTogglePin}
            toggleFavorite={handleToggleFavorite}
            onPaste={pasteItem}
            settings={settings}
            tabBarRef={tabBarRef}
          />
        )

      case 'favorites':
        return (
          <ClipboardTab
            history={history.filter((item) => item.favorited)}
            isLoading={isLoading}
            isDark={isDark}
            tertiaryOpacity={tertiaryOpacity}
            secondaryOpacity={secondaryOpacity}
            clearHistory={handleClearHistory}
            deleteItem={handleDeleteItem}
            togglePin={handleTogglePin}
            toggleFavorite={handleToggleFavorite}
            onPaste={pasteItem}
            settings={settings}
            tabBarRef={tabBarRef}
          />
        )

      case 'emoji':
        return <EmojiPicker isDark={isDark} opacity={secondaryOpacity} />

      case 'gifs':
        if (!isGifEnabled()) {
          return (
            <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-3">
              <p className={clsx('text-sm font-medium', isDark ? 'text-gray-300' : 'text-gray-600')}>
                GIF Integration is disabled
              </p>
              <p className={clsx('text-xs', isDark ? 'text-gray-500' : 'text-gray-400')}>
                To enable, open Settings and enter your Tenor API key.
              </p>
            </div>
          )
        }
        return <GifPicker isDark={isDark} opacity={secondaryOpacity} />

      case 'kaomoji':
        return (
          <KaomojiPicker
            isDark={isDark}
            opacity={secondaryOpacity}
            customKaomojis={settings.custom_kaomojis}
          />
        )

      case 'symbols':
        return <SymbolPicker isDark={isDark} opacity={secondaryOpacity} />

      default:
        return null
    }
  }

  // Don't render until settings are loaded to prevent FOUC
  if (!settingsLoaded) {
    return null
  }

  return (
    <div
      className={clsx(
        'app-shell relative h-screen w-screen overflow-hidden flex flex-col select-none',
        isDark ? 'text-win11-text-primary' : 'text-win11Light-text-primary'
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Drag Handle */}
      <DragHandle isDark={isDark} />

      {/* Tab bar */}
      <TabBar
        ref={tabBarRef}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isDark={isDark}
        tertiaryOpacity={tertiaryOpacity}
      />

      {/* Startup diagnostics (e.g. history corruption recovery) */}
      {loadStatus && (
        <NotificationBanner
          message={loadStatus}
          isDark={isDark}
          onDismiss={() => setLoadStatus(null)}
        />
      )}

      {/* Runtime errors (paste/delete/pin failures) — otherwise silent */}
      {error && <NotificationBanner message={error} isDark={isDark} onDismiss={clearError} />}

      {/* Scrollable content area */}
      <div
        ref={contentContainerRef}
        className={clsx(
          'flex-1',
          // Only use scrollbar for non-emoji/gif/kaomoji tabs, they have their own virtualized scrolling or containers
          activeTab === 'emoji' ||
            activeTab === 'gifs' ||
            activeTab === 'kaomoji' ||
            activeTab === 'symbols'
            ? 'overflow-hidden'
            : 'overflow-y-auto scrollbar-win11'
        )}
      >
        {renderContent()}
      </div>

      {/* Transient action confirmations */}
      <ToastViewport toasts={toasts} isDark={isDark} />
    </div>
  )
}

export default ClipboardApp
