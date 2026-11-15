'use client'

import { useRef, type ReactNode } from 'react'
import { X } from '@/components/icons'

const TOKEN = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

function highlight(json: string): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  for (const match of json.matchAll(TOKEN)) {
    const index = match.index || 0
    if (index > last) {
      nodes.push(json.slice(last, index))
    }
    if (match[1] && match[2]) {
      nodes.push(<span className="json-key" key={index}>{match[1]}</span>)
      nodes.push(match[2])
    } else if (match[1]) {
      nodes.push(<span className="json-string" key={index}>{match[1]}</span>)
    } else if (match[3] === 'null') {
      nodes.push(<span className="json-null" key={index}>{match[3]}</span>)
    } else if (match[3]) {
      nodes.push(<span className="json-boolean" key={index}>{match[3]}</span>)
    } else {
      nodes.push(<span className="json-number" key={index}>{match[4]}</span>)
    }
    last = index + match[0].length
  }
  if (last < json.length) {
    nodes.push(json.slice(last))
  }
  return nodes
}

export default function ActivityDetails({ details, summary }: { details: unknown; summary: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  function open() {
    if (dialogRef.current) {
      dialogRef.current.showModal()
    }
  }

  function close() {
    if (dialogRef.current) {
      dialogRef.current.close()
    }
  }

  function closeOnBackdrop(event: React.MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      close()
    }
  }

  return (
    <>
      <button type="button" className="info-button" onClick={open} aria-label={'Details: ' + summary} title="Details">
        i
      </button>
      <dialog ref={dialogRef} className="activity-dialog" onClick={closeOnBackdrop} aria-label="Activity details">
        <div className="activity-dialog-head">
          <div>
            <h2>Activity details</h2>
            <p>{summary}</p>
          </div>
          <button type="button" className="icon-button" onClick={close} aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <pre className="json-view">{highlight(JSON.stringify(details, null, 2))}</pre>
      </dialog>
    </>
  )
}
