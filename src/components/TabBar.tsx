import { clsx } from 'clsx'
import { ClipboardList, Smile, Image } from 'lucide-react'
import type { ActiveTab } from '../types/clipboard'

interface TabBarProps {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
}

/**
 * Windows 11 style tab bar for switching between Clipboard, GIFs, and Emoji
 */
export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const tabs: { id: ActiveTab; label: string; icon: typeof ClipboardList }[] = [
    { id: 'clipboard', label: 'Clipboard', icon: ClipboardList },
    { id: 'gifs', label: 'GIFs', icon: Image },
    { id: 'emoji', label: 'Emoji', icon: Smile },
  ]

  return (
    <div className="flex items-center gap-1 p-2 border-b dark:border-win11-border-subtle border-win11Light-border">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={clsx(
              'flex items-center justify-center gap-2 px-4 py-2 rounded-md',
              'text-sm font-medium transition-all duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-win11-bg-accent',
              isActive
                ? [
                    'dark:bg-win11-bg-tertiary bg-win11Light-bg-tertiary',
                    'dark:text-win11-text-primary text-win11Light-text-primary',
                  ]
                : [
                    'dark:text-win11-text-secondary text-win11Light-text-secondary',
                    'hover:dark:bg-win11-bg-card-hover hover:bg-win11Light-bg-card-hover',
                  ]
            )}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}
