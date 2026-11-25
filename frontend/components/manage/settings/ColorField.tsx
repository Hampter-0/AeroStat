'use client'

import { useState } from 'react'
import { Arrow } from '@/components/icons'
import ColorPicker from '@/components/manage/settings/ColorPicker'

const HEX = /^#[0-9a-fA-F]{6}$/

export default function ColorField({ value, fallback }: { value: string; fallback: string }) {
  const [text, setText] = useState(value)

  let preview = fallback
  if (HEX.test(text)) {
    preview = text
  }

  function onType(event: React.ChangeEvent<HTMLInputElement>) {
    setText(event.target.value)
  }

  function resetToDefault() {
    setText('')
  }

  const previewStyle = { '--preview': preview } as React.CSSProperties

  return (
    <div className="color-field">
      <div className="color-inputs">
        <ColorPicker value={text} fallback={fallback} onChange={setText} label="Pick accent color" />
        <input
          name="primary_color"
          value={text}
          onChange={onType}
          placeholder={fallback}
          pattern="#[0-9a-fA-F]{6}"
          maxLength={7}
          aria-label="Accent color hex code"
        />
        <button type="button" className="link-button" onClick={resetToDefault}>
          Use default
        </button>
      </div>
      <div className="color-preview" style={previewStyle}>
        <span className="color-preview-link">
          View details <Arrow />
        </span>
        <span className="color-preview-button">Button</span>
        <span className="color-preview-chip">Active</span>
      </div>
    </div>
  )
}
