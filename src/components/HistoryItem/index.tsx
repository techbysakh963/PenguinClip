import { useCallback, forwardRef, useRef, useMemo } from 'react'
import { clsx } from 'clsx'
import { Pin, Star, X } from 'lucide-react'
import type { ClipboardItem } from '../../types/clipboard'
import { getCardBackgroundStyle } from '../../utils/themeUtils'
import { useSmartActions } from '../../hooks/useSmartActions'
import { HistorySmartActions } from '../HistorySmartActions'
import { TextContent, ImageContent, Timestamp } from './_HistoryItemContent'
import {
  getIconSize,
  getIconContainerClasses,
  CATEGORY_ICON,
  hexToRgba,
} from './_HistoryItemUtils'
import { detectCategory, CATEGORY_CONFIG } from '../../utils/categoryDetection'

interface HistoryItemProps {
  item: ClipboardItem
  onPaste: (id: string) => void
  onDelete: (id: string) => void
  onTogglePin: (id: string) => void
  onToggleFavorite: (id: string) => void
  onFocus?: () => void
  index: number
  isFocused?: boolean
  isDark: boolean
  secondaryOpacity: number
  isCompact?: boolean
  // Feature flags passed from parent
  enableSmartActions: boolean
  enableUiPolish: boolean
}

export const HistoryItem = forwardRef<HTMLDivElement, HistoryItemProps>(function HistoryItem(
  {
    item,
    onPaste,
    onDelete,
    onTogglePin,
    onToggleFavorite,
    onFocus,
    index,
    isFocused = false,
    isDark,
    secondaryOpacity,
    isCompact = false,
    enableSmartActions,
    enableUiPolish,
  },
  ref
) {
  const internalRef = useRef<HTMLDivElement | null>(null)

  // Normalize forwarded ref and keep a local ref so we can safely call focus()
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      internalRef.current = el
      if (!ref) return
      if (typeof ref === 'function') {
        try {
          ref(el)
        } catch (err) {
          console.warn('Error in HistoryItem callback ref:', err)
        }
      } else {
        ;(ref as React.MutableRefObject<HTMLDivElement | null>).current = el
      }
    },
    [ref]
  )
  // Use compact mode only if enabled by flag
  const effectiveCompact = enableUiPolish ? isCompact : false
  const iconSize = getIconSize(effectiveCompact)
  const iconContainerClasses = getIconContainerClasses(effectiveCompact)

  // Smart Actions Hook
  const { colorPreview, linkAction, emailAction, handleSmartAction } = useSmartActions(
    item,
    enableSmartActions
  )

  // Handle paste on click
  const handleClick = useCallback(() => {
    onPaste(item.id)
  }, [item.id, onPaste])

  // Handle delete with stopPropagation
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onDelete(item.id)
    },
    [item.id, onDelete]
  )

  // Handle pin toggle with stopPropagation
  const handleTogglePin = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onTogglePin(item.id)
      // Keep focus on the item after toggling pin (clicking the button would steal focus)
      const raf = window.requestAnimationFrame(() => internalRef.current?.focus())
      // Best-effort: cancel the RAF if component unmounts synchronously.
      return () => window.cancelAnimationFrame(raf)
    },
    [item.id, onTogglePin]
  )

  // Handle favorite toggle with stopPropagation
  const handleToggleFavorite = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onToggleFavorite(item.id)
      const raf = window.requestAnimationFrame(() => internalRef.current?.focus())
      return () => window.cancelAnimationFrame(raf)
    },
    [item.id, onToggleFavorite]
  )

  // Detect content category
  const category = useMemo(() => detectCategory(item), [item])
  const categoryConfig = CATEGORY_CONFIG[category]
  const CategoryIcon = CATEGORY_ICON[category]

  // Prevent buttons from taking focus on pointer down (covers mouse/touch/pen)
  const handlePointerDownPreventDefault = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
  }, [])

  // Apply an explicit visible ring for pinned+focused items so the ring shows
  // even if :focus-visible isn't triggered (e.g. after reopening the window).
  const pinnedAndFocused =
    item.pinned && isFocused
      ? `ring-2 ring-win11-bg-accent focus-visible:ring-2 focus-visible:ring-win11-bg-accent`
      : undefined

  return (
    <div
      ref={setRefs}
      className={clsx(
        // Base styles
        'group relative rounded-[var(--radius-card)] cursor-pointer',
        effectiveCompact ? 'p-2' : 'p-3',
        // Smooth, premium feel: lift slightly and cast a soft shadow on hover,
        // then settle back with a subtle press so clicks feel tactile.
        '[transition:transform_var(--motion-base)_var(--ease-out),box-shadow_var(--motion-base)_var(--ease-out),background-color_var(--motion-fast)_var(--ease-out)]',
        'hover:-translate-y-px hover:shadow-[var(--shadow-md)] active:translate-y-0 active:scale-[0.99]',
        // Skip layout/paint for off-screen rows so long histories stay cheap to
        // render, while keeping every row mounted (so keyboard focus and
        // scrollIntoView still work). contain-intrinsic-size reserves a
        // placeholder height until a row is first painted.
        '[content-visibility:auto] [contain-intrinsic-size:auto_64px]',
        // Animation delay based on index
        'animate-in',
        // Blue ring has priority
        pinnedAndFocused,
        // Otherwise default focused ring
        !pinnedAndFocused && isFocused ? `ring-1 ring-win11-bg-accent` : undefined,
        // Dark mode styles
        isDark
          ? 'hover:bg-win11-bg-card-hover border border-win11-border-subtle'
          : 'hover:bg-win11Light-bg-card-hover border border-win11Light-border',
        // Pinned indicator
        item.pinned && !pinnedAndFocused && `ring-1 ring-win11-bg-accent`,
        // Focus styles
        `focus:outline-none focus-visible:ring-2 focus-visible:ring-win11-bg-accent`
      )}
      onClick={handleClick}
      onFocus={onFocus}
      role="button"
      tabIndex={isFocused ? 0 : -1}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
      style={{
        // Cap the stagger so deep items in a large history don't wait seconds
        // to fade in (index * 30ms would be 30s at row 1000).
        animationDelay: `${Math.min(index, 12) * 30}ms`,
        ...getCardBackgroundStyle(isDark, secondaryOpacity),
      }}
    >
      {/* Content type indicator */}
      <div className="flex items-start gap-3">
        {/* Category icon — tinted by content type so the kind of item is
            readable at a glance. Color swatches keep showing the real colour. */}
        <div
          className={clsx(iconContainerClasses, colorPreview && 'shadow-sm')}
          style={
            colorPreview && colorPreview.data
              ? { backgroundColor: colorPreview.data }
              : { backgroundColor: hexToRgba(categoryConfig.accent, isDark ? 0.22 : 0.14) }
          }
          title={colorPreview ? `Color: ${colorPreview.data}` : categoryConfig.label}
        >
          {colorPreview ? null : (
            <CategoryIcon className={iconSize} style={{ color: categoryConfig.accent }} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <TextContent item={item} isDark={isDark} effectiveCompact={effectiveCompact} />
          <ImageContent item={item} isDark={isDark} effectiveCompact={effectiveCompact} />
          <div className="flex items-center gap-2">
            <Timestamp show={!effectiveCompact} isDark={isDark} timestamp={item.timestamp} />
            {category !== 'Text' && (
              <span
                className={clsx(
                  'inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium',
                  isDark ? categoryConfig.darkColor : categoryConfig.color
                )}
              >
                {categoryConfig.label}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons - visible on hover */}
        <div
          className={clsx(
            'flex items-center gap-1 opacity-0 group-hover:opacity-100',
            'transition-opacity duration-150'
          )}
        >
          {/* Smart Actions Buttons */}
          <HistorySmartActions
            linkAction={linkAction}
            emailAction={emailAction}
            isDark={isDark}
            onActionClick={handleSmartAction}
          />

          {/* Favorite button */}
          <button
            onPointerDown={handlePointerDownPreventDefault}
            onClick={handleToggleFavorite}
            className={clsx(
              'p-1.5 rounded-md transition-colors',
              isDark ? 'hover:bg-win11-bg-tertiary' : 'hover:bg-win11Light-bg-tertiary',
              item.favorited
                ? 'text-yellow-500'
                : isDark
                  ? 'text-win11-text-tertiary'
                  : 'text-win11Light-text-secondary'
            )}
            title={item.favorited ? 'Remove from favorites' : 'Add to favorites'}
            tabIndex={-1}
          >
            <Star className="w-4 h-4" fill={item.favorited ? 'currentColor' : 'none'} />
          </button>

          {/* Pin button */}
          <button
            onPointerDown={handlePointerDownPreventDefault}
            onClick={handleTogglePin}
            className={clsx(
              'p-1.5 rounded-md transition-colors',
              isDark ? 'hover:bg-win11-bg-tertiary' : 'hover:bg-win11Light-bg-tertiary',
              item.pinned
                ? 'text-win11-bg-accent'
                : isDark
                  ? 'text-win11-text-tertiary'
                  : 'text-win11Light-text-secondary'
            )}
            title={item.pinned ? 'Unpin' : 'Pin'}
            tabIndex={-1}
          >
            <Pin className="w-4 h-4" fill={item.pinned ? 'currentColor' : 'none'} />
          </button>

          {/* Delete button */}
          <button
            onPointerDown={handlePointerDownPreventDefault}
            onClick={handleDelete}
            className={clsx(
              'p-1.5 rounded-md transition-colors',
              isDark
                ? 'text-win11-text-tertiary hover:bg-win11-bg-tertiary'
                : 'text-win11Light-text-secondary hover:bg-win11Light-bg-tertiary',
              'hover:text-win11-error'
            )}
            title="Delete"
            tabIndex={-1}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pinned badge */}
      {item.pinned && (
        <div className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-win11-bg-accent" />
      )}
      {/* Favorited badge */}
      {item.favorited && (
        <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-yellow-500" />
      )}
    </div>
  )
})
