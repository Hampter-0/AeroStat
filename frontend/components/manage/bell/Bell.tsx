'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { bellClear, bellCount, bellList, bellMute, bellRead, bellRemove } from '@/app/manage/(panel)/bell-actions'
import { Bell as BellIcon, BellOff, MoreHorizontal, X } from '@/components/icons'
import { useConfirm } from '@/components/manage/confirm/Confirm'
import { BELL_FILTERS, MUTE_CHOICES, type BellItem, type BellSummary } from '@/lib/bell'
import { currentTimeMs, formatAgo, formatTime } from '@/lib/time'

const POLL_MS = 30000

export default function Bell({ timezone }: { timezone: string }) {
  const router = useRouter()
  const confirm = useConfirm()
  const rootRef = useRef<HTMLDivElement>(null)
  const [summary, setSummary] = useState<BellSummary | null>(null)
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [filter, setFilter] = useState('all')
  const [items, setItems] = useState<BellItem[]>([])
  const [nextBefore, setNextBefore] = useState<number | null>(null)
  const [loadedFilter, setLoadedFilter] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [now, setNow] = useState(0)

  const refreshCount = useCallback(function () {
    bellCount().then(function (result) {
      if (result) {
        setSummary(result)
      }
    })
  }, [])

  useEffect(
    function () {
      refreshCount()
      const timer = window.setInterval(function () {
        if (document.visibilityState === 'visible') {
          refreshCount()
        }
      }, POLL_MS)
      function onVisible() {
        if (document.visibilityState === 'visible') {
          refreshCount()
        }
      }
      document.addEventListener('visibilitychange', onVisible)
      return function () {
        window.clearInterval(timer)
        document.removeEventListener('visibilitychange', onVisible)
      }
    },
    [refreshCount]
  )

  useEffect(
    function () {
      if (!open) {
        return
      }
      let cancelled = false
      bellList(filter, null).then(function (page) {
        if (cancelled) {
          return
        }
        setLoadedFilter(filter)
        setNow(currentTimeMs())
        if (page) {
          setItems(page.items)
          setNextBefore(page.next_before)
          setSummary({ unread: page.unread, unread_important: page.unread_important, muted_until: page.muted_until })
        }
      })
      return function () {
        cancelled = true
      }
    },
    [open, filter]
  )

  useEffect(
    function () {
      if (!open) {
        return
      }
      function onPointerDown(event: PointerEvent) {
        const target = event.target as Element
        if (target.closest && target.closest('.confirm-overlay, .confirm-dialog')) {
          return
        }
        if (rootRef.current && !rootRef.current.contains(target)) {
          setOpen(false)
          setMenuOpen(false)
        }
      }
      function onKeyDown(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          if (menuOpen) {
            setMenuOpen(false)
            return
          }
          setOpen(false)
        }
      }
      document.addEventListener('pointerdown', onPointerDown)
      document.addEventListener('keydown', onKeyDown)
      return function () {
        document.removeEventListener('pointerdown', onPointerDown)
        document.removeEventListener('keydown', onKeyDown)
      }
    },
    [open, menuOpen]
  )

  function toggle() {
    setOpen(!open)
    setMenuOpen(false)
    setLoadedFilter(null)
  }

  function toggleMenu() {
    setMenuOpen(!menuOpen)
  }

  function loadMore() {
    if (nextBefore === null) {
      return
    }
    setLoadingMore(true)
    bellList(filter, nextBefore).then(function (page) {
      setLoadingMore(false)
      if (page) {
        setItems(items.concat(page.items))
        setNextBefore(page.next_before)
      }
    })
  }

  function markRead(ids: number[] | null) {
    const next = []
    for (const item of items) {
      if (ids === null || ids.includes(item.id)) {
        next.push({ ...item, read: true })
      } else {
        next.push(item)
      }
    }
    if (filter === 'unread') {
      const kept = []
      for (const item of next) {
        if (!item.read) {
          kept.push(item)
        }
      }
      setItems(kept)
    } else {
      setItems(next)
    }
    bellRead(ids).then(function (result) {
      if (result) {
        setSummary(result)
      }
    })
  }

  function openItem(item: BellItem) {
    if (!item.read) {
      markRead([item.id])
    }
    if (item.path) {
      setOpen(false)
      router.push(item.path)
    }
  }

  function removeItem(item: BellItem) {
    const kept = []
    for (const other of items) {
      if (other.id !== item.id) {
        kept.push(other)
      }
    }
    setItems(kept)
    bellRemove(item.id).then(function () {
      refreshCount()
    })
  }

  function clearAll() {
    setMenuOpen(false)
    confirm({
      title: 'Clear all notifications?',
      message: 'They are removed from your bell. Others keep theirs.',
      confirmText: 'Clear all',
      danger: true,
    }).then(function (ok) {
      if (!ok) {
        return
      }
      setItems([])
      setNextBefore(null)
      bellClear().then(function (result) {
        if (result) {
          setSummary(result)
        }
      })
    })
  }

  function mute(hours: number | null) {
    setMenuOpen(false)
    let until: string | null = null
    if (hours !== null) {
      until = new Date(currentTimeMs() + hours * 3600000).toISOString()
    }
    bellMute(until).then(function (result) {
      if (result) {
        setSummary(result)
      }
    })
  }

  let loading = false
  if (open && loadedFilter !== filter) {
    loading = true
  }

  let unread = 0
  let important = 0
  let mutedUntil: string | null = null
  if (summary) {
    unread = summary.unread
    important = summary.unread_important
    mutedUntil = summary.muted_until
  }
  const muted = mutedUntil !== null

  let badgeText = String(unread)
  if (unread > 99) {
    badgeText = '99+'
  }
  let badgeClass = 'bell-badge'
  if (important > 0) {
    badgeClass = 'bell-badge important'
  }

  let buttonClass = 'bell-button'
  if (open) {
    buttonClass = 'bell-button active'
  }

  let label = 'Notifications'
  if (unread === 1) {
    label = 'Notifications, 1 unread'
  } else if (unread > 1) {
    label = 'Notifications, ' + unread + ' unread'
  }
  if (muted) {
    label = label + ', muted'
  }

  let mutedText = ''
  if (mutedUntil) {
    mutedText = 'Muted until ' + formatTime(mutedUntil, timezone)
  }

  let emptyText = 'Nothing here yet. You will see outages, incidents and other changes here.'
  if (filter === 'unread') {
    emptyText = 'You are all caught up.'
  }
  if (filter === 'important') {
    emptyText = 'No important notifications.'
  }

  return (
    <div className="bell" ref={rootRef}>
      {open && (
        <section className="bell-panel" aria-label="Notifications">
          <header className="bell-head">
            <div>
              <h2>Notifications</h2>
              {muted && <small className="bell-muted-note">{mutedText}</small>}
            </div>
            <div className="bell-head-actions">
              <button type="button" className="bell-icon-button" aria-label="More options" aria-expanded={menuOpen} onClick={toggleMenu}>
                <MoreHorizontal />
              </button>
              <button type="button" className="bell-icon-button" aria-label="Close notifications" onClick={toggle}>
                <X size={16} />
              </button>
              {menuOpen && (
                <div className="bell-menu" role="menu">
                  <span className="bell-menu-title">Mute the count</span>
                  {MUTE_CHOICES.map(function (choice) {
                    return (
                      <button
                        type="button"
                        role="menuitem"
                        key={choice.hours}
                        onClick={function () {
                          mute(choice.hours)
                        }}
                      >
                        For {choice.label}
                      </button>
                    )
                  })}
                  {muted && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={function () {
                        mute(null)
                      }}
                    >
                      Unmute
                    </button>
                  )}
                  <span className="bell-menu-divider" />
                  <button type="button" role="menuitem" className="danger" onClick={clearAll} disabled={items.length === 0}>
                    Clear all
                  </button>
                  <Link
                    href="/manage/profile#notifications"
                    role="menuitem"
                    onClick={function () {
                      setOpen(false)
                    }}
                  >
                    Notification settings
                  </Link>
                </div>
              )}
            </div>
          </header>

          <div className="bell-tabs" role="tablist">
            {BELL_FILTERS.map(function (tab) {
              let className = 'bell-tab'
              if (tab.id === filter) {
                className = 'bell-tab active'
              }
              let count = ''
              if (tab.id === 'unread' && unread > 0) {
                count = String(unread)
              }
              if (tab.id === 'important' && important > 0) {
                count = String(important)
              }
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab.id === filter}
                  className={className}
                  key={tab.id}
                  onClick={function () {
                    setFilter(tab.id)
                  }}
                >
                  {tab.label}
                  {count && <span className="bell-tab-count">{count}</span>}
                </button>
              )
            })}
          </div>

          <ol className="bell-list">
            {items.map(function (item) {
              let className = 'bell-item tone-' + item.tone
              if (!item.read) {
                className = className + ' unread'
              }
              return (
                <li className={className} key={item.id}>
                  <button
                    type="button"
                    className="bell-item-main"
                    onClick={function () {
                      openItem(item)
                    }}
                  >
                    <span className="bell-dot" aria-hidden="true" />
                    <span className="bell-item-text">
                      <strong>
                        {item.title}
                        {item.important && <span className="bell-important">Important</span>}
                      </strong>
                      {item.body && <span className="bell-item-body">{item.body}</span>}
                      <time dateTime={item.created_at}>{formatAgo(now - new Date(item.created_at).getTime())}</time>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="bell-item-remove"
                    aria-label="Remove notification"
                    onClick={function () {
                      removeItem(item)
                    }}
                  >
                    <X size={14} />
                  </button>
                </li>
              )
            })}
            {!loading && items.length === 0 && <li className="bell-empty">{emptyText}</li>}
            {loading && items.length === 0 && <li className="bell-empty">Loading…</li>}
          </ol>

          <footer className="bell-foot">
            {nextBefore !== null && (
              <button type="button" className="link-button" onClick={loadMore} disabled={loadingMore}>
                Show older
              </button>
            )}
            <button
              type="button"
              className="link-button"
              onClick={function () {
                markRead(null)
              }}
              disabled={unread === 0}
            >
              Mark all as read
            </button>
          </footer>
        </section>
      )}

      <button type="button" className={buttonClass} aria-label={label} aria-expanded={open} aria-haspopup="dialog" onClick={toggle}>
        {muted && <BellOff size={20} />}
        {!muted && <BellIcon size={20} />}
        {!muted && unread > 0 && <span className={badgeClass}>{badgeText}</span>}
      </button>
    </div>
  )
}
