'use client'

import { useState } from 'react'
import { Copy, ExternalLink } from '@/components/icons'
import { useToast } from '@/components/manage/toast/Toasts'

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

function CopyField({ label, value }: { label: string; value: string }) {
  const showToast = useToast()

  async function copy() {
    let copied = false
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(value)
        copied = true
      } catch {
        copied = false
      }
    }
    if (!copied) {
      copied = copyWithSelection(value)
    }
    if (copied) {
      showToast(label + ' copied')
    } else {
      showToast('Could not copy. Select the text and copy it yourself.', 'error')
    }
  }

  return (
    <div className="copy-field">
      <span className="copy-field-label">{label}</span>
      <div className="copy-field-row">
        <code>{value}</code>
        <button type="button" className="copy-field-button" onClick={copy} aria-label={'Copy ' + label} title={'Copy ' + label}>
          <Copy />
        </button>
      </div>
    </div>
  )
}

export default function BadgeCard({ serviceId, serviceName, baseUrl }: { serviceId: string; serviceName: string; baseUrl: string }) {
  const [label, setLabel] = useState('')

  function changeLabel(event: React.ChangeEvent<HTMLInputElement>) {
    setLabel(event.target.value.slice(0, 40))
  }

  const query = 'service=' + encodeURIComponent(serviceId)
  let badgeQuery = query
  if (label.trim() !== '') {
    badgeQuery = query + '&label=' + encodeURIComponent(label.trim())
  }
  const badgePath = '/api/badge?' + badgeQuery
  const badgeUrl = baseUrl + badgePath
  const statusUrl = baseUrl + '/api/status?' + query
  let alt = serviceName
  if (label.trim() !== '') {
    alt = label.trim()
  }
  const markdown = '![' + alt + '](' + badgeUrl + ')'
  const html = '<img src="' + badgeUrl + '" alt="' + alt.replace(/"/g, '&quot;') + '">'

  return (
    <section className="manage-panel badge-card">
      <h2>Badge &amp; API</h2>
      <p className="card-status">
        Show the status of {serviceName} in a README or on your own site, or read it from code.
      </p>

      <div className="badge-preview">
        <img src={badgePath} alt={alt + ' status badge'} height={20} />
        <label>
          <span>Label</span>
          <input value={label} onChange={changeLabel} placeholder={serviceName} maxLength={40} />
        </label>
      </div>

      <div className="copy-fields">
        <CopyField label="ID" value={serviceId} />
        <CopyField label="Markdown" value={markdown} />
        <CopyField label="HTML" value={html} />
        <CopyField label="Badge URL" value={badgeUrl} />
        <CopyField label="Status API" value={statusUrl} />
      </div>

      <a href={'/api/status?' + query} target="_blank" rel="noreferrer" className="link-button badge-api-link">
        Open the status API <ExternalLink />
      </a>
    </section>
  )
}
