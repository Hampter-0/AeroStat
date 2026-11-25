'use client'

import { useEffect, useRef, useState } from 'react'

const HEX = /^#[0-9a-fA-F]{6}$/

interface Hsv {
  h: number
  s: number
  v: number
}

function hexToHsv(hex: string): Hsv {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta !== 0) {
    if (max === r) {
      h = ((g - b) / delta) % 6
    } else if (max === g) {
      h = (b - r) / delta + 2
    } else {
      h = (r - g) / delta + 4
    }
    h = h * 60
    if (h < 0) {
      h = h + 360
    }
  }
  let s = 0
  if (max !== 0) {
    s = delta / max
  }
  return { h: h, s: s, v: max }
}

function hsvToHex(color: Hsv): string {
  const c = color.v * color.s
  const x = c * (1 - Math.abs(((color.h / 60) % 2) - 1))
  const m = color.v - c
  let rgb = [c, x, 0]
  if (color.h >= 60 && color.h < 120) {
    rgb = [x, c, 0]
  } else if (color.h >= 120 && color.h < 180) {
    rgb = [0, c, x]
  } else if (color.h >= 180 && color.h < 240) {
    rgb = [0, x, c]
  } else if (color.h >= 240 && color.h < 300) {
    rgb = [x, 0, c]
  } else if (color.h >= 300) {
    rgb = [c, 0, x]
  }
  const parts = rgb.map(function (part) {
    const value = Math.round((part + m) * 255)
    return value.toString(16).padStart(2, '0')
  })
  return '#' + parts.join('')
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export default function ColorPicker({
  value,
  fallback,
  onChange,
  label,
}: {
  value: string
  fallback: string
  onChange: (hex: string) => void
  label: string
}) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  let shown = fallback
  if (HEX.test(value)) {
    shown = value.toLowerCase()
  }
  const [hsv, setHsv] = useState<Hsv>(hexToHsv(shown))
  const [lastShown, setLastShown] = useState(shown)
  if (shown !== lastShown) {
    setLastShown(shown)
    if (hsvToHex(hsv) !== shown) {
      setHsv(hexToHsv(shown))
    }
  }

  useEffect(
    function () {
      if (!open) {
        return
      }
      function onDown(event: MouseEvent) {
        if (boxRef.current && !boxRef.current.contains(event.target as Node)) {
          setOpen(false)
        }
      }
      function onKey(event: KeyboardEvent) {
        if (event.key === 'Escape') {
          setOpen(false)
        }
      }
      document.addEventListener('mousedown', onDown)
      document.addEventListener('keydown', onKey)
      return function () {
        document.removeEventListener('mousedown', onDown)
        document.removeEventListener('keydown', onKey)
      }
    },
    [open]
  )

  function update(next: Hsv) {
    setHsv(next)
    onChange(hsvToHex(next))
  }

  function dragArea(event: React.PointerEvent<HTMLDivElement>) {
    if (event.type === 'pointermove' && event.buttons === 0) {
      return
    }
    if (event.type === 'pointerdown') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    const box = event.currentTarget.getBoundingClientRect()
    update({
      h: hsv.h,
      s: clamp((event.clientX - box.left) / box.width),
      v: clamp(1 - (event.clientY - box.top) / box.height),
    })
  }

  function dragHue(event: React.PointerEvent<HTMLDivElement>) {
    if (event.type === 'pointermove' && event.buttons === 0) {
      return
    }
    if (event.type === 'pointerdown') {
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    const box = event.currentTarget.getBoundingClientRect()
    update({ h: clamp((event.clientX - box.left) / box.width) * 359.9, s: hsv.s, v: hsv.v })
  }

  function areaKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    const step = 0.02
    let next: Hsv | null = null
    if (event.key === 'ArrowLeft') {
      next = { h: hsv.h, s: clamp(hsv.s - step), v: hsv.v }
    } else if (event.key === 'ArrowRight') {
      next = { h: hsv.h, s: clamp(hsv.s + step), v: hsv.v }
    } else if (event.key === 'ArrowUp') {
      next = { h: hsv.h, s: hsv.s, v: clamp(hsv.v + step) }
    } else if (event.key === 'ArrowDown') {
      next = { h: hsv.h, s: hsv.s, v: clamp(hsv.v - step) }
    }
    if (next) {
      event.preventDefault()
      update(next)
    }
  }

  function hueKeys(event: React.KeyboardEvent<HTMLDivElement>) {
    let next: number | null = null
    if (event.key === 'ArrowLeft') {
      next = Math.max(0, hsv.h - 3)
    } else if (event.key === 'ArrowRight') {
      next = Math.min(359.9, hsv.h + 3)
    }
    if (next !== null) {
      event.preventDefault()
      update({ h: next, s: hsv.s, v: hsv.v })
    }
  }

  function toggle() {
    setOpen(!open)
  }

  const areaStyle = { '--hue': 'hsl(' + Math.round(hsv.h) + ', 100%, 50%)' } as React.CSSProperties
  const thumbStyle = { left: hsv.s * 100 + '%', top: (1 - hsv.v) * 100 + '%', background: shown } as React.CSSProperties
  const hueThumbStyle = { left: (hsv.h / 360) * 100 + '%', background: 'hsl(' + Math.round(hsv.h) + ', 100%, 50%)' } as React.CSSProperties

  return (
    <div className="color-picker" ref={boxRef}>
      <button
        type="button"
        className="color-swatch"
        style={{ background: shown }}
        onClick={toggle}
        aria-label={label}
        aria-expanded={open}
      />
      {open && (
        <div className="color-popover">
          <div
            className="color-area"
            style={areaStyle}
            onPointerDown={dragArea}
            onPointerMove={dragArea}
            onKeyDown={areaKeys}
            tabIndex={0}
            role="slider"
            aria-label="Saturation and brightness"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsv.s * 100)}
            aria-valuetext={shown}
          >
            <span className="color-thumb" style={thumbStyle} />
          </div>
          <div
            className="color-hue"
            onPointerDown={dragHue}
            onPointerMove={dragHue}
            onKeyDown={hueKeys}
            tabIndex={0}
            role="slider"
            aria-label="Hue"
            aria-valuemin={0}
            aria-valuemax={360}
            aria-valuenow={Math.round(hsv.h)}
          >
            <span className="color-thumb" style={hueThumbStyle} />
          </div>
        </div>
      )}
    </div>
  )
}
