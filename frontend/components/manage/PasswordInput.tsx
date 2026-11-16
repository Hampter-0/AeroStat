'use client'

import { useState, type Ref } from 'react'
import { Eye, EyeOff, Lock } from '@/components/icons'

export default function PasswordInput({
  name,
  autoComplete,
  placeholder,
  autoFocus,
  minLength,
  inputRef,
}: {
  name: string
  autoComplete: string
  placeholder: string
  autoFocus?: boolean
  minLength?: number
  inputRef?: Ref<HTMLInputElement>
}) {
  const [shown, setShown] = useState(false)

  function toggle() {
    setShown(!shown)
  }

  let type = 'password'
  let label = 'Show password'
  let icon = <Eye />
  if (shown) {
    type = 'text'
    label = 'Hide password'
    icon = <EyeOff />
  }

  return (
    <div className="input-with-icon has-toggle">
      <Lock />
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        autoFocus={autoFocus}
        minLength={minLength}
        ref={inputRef}
        required
      />
      <button type="button" className="password-toggle" onClick={toggle} aria-label={label} title={label}>
        {icon}
      </button>
    </div>
  )
}
