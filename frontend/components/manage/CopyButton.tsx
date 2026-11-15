'use client'

import { useState } from 'react'

function copyWithSelection(text: string): boolean {
  const field = document.createElement('textarea')
  field.value = text
  field.setAttribute('readonly', '')
  field.style.position = 'fixed'
  field.style.opacity = '0'
  document.body.appendChild(field)
  field.select()
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  document.body.removeChild(field)
  return copied
}

export default function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    let copied = false
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text)
        copied = true
      } catch {
        copied = false
      }
    }
    if (!copied) {
      copied = copyWithSelection(text)
    }
    if (copied) {
      setState('copied')
    } else {
      setState('failed')
    }
    window.setTimeout(function () {
      setState('idle')
    }, 2000)
  }

  let buttonText = label
  if (state === 'copied') {
    buttonText = 'Copied'
  } else if (state === 'failed') {
    buttonText = 'Copy failed, select the command above'
  }

  return (
    <button type="button" className="button-secondary" onClick={copy} aria-live="polite">
      {buttonText}
    </button>
  )
}
