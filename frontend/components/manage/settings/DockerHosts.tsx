'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { createDockerHost, deleteDockerHost, listContainers } from '@/app/manage/(panel)/docker-actions'
import { useConfirmedSubmit } from '@/components/manage/confirm/Confirm'
import { useResultToast } from '@/components/manage/toast/Toasts'
import type { DockerHostsResponse } from '@/lib/docker'

const initialState: FormState = { error: null, success: null }

function TestButton({ hostId }: { hostId: number | null }) {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)

  function test() {
    setTesting(true)
    listContainers(hostId).then(function (answer) {
      setTesting(false)
      if (answer.list) {
        let text = answer.list.containers.length + ' containers found'
        if (answer.list.containers.length === 1) {
          text = '1 container found'
        }
        setResult({ ok: true, text: text })
      } else {
        setResult({ ok: false, text: answer.error || 'Docker could not be reached' })
      }
    })
  }

  let label = 'Test'
  if (testing) {
    label = 'Testing…'
  }
  let resultClass = 'docker-test-result failed'
  if (result && result.ok) {
    resultClass = 'docker-test-result ok'
  }

  return (
    <div className="docker-test">
      <button type="button" className="button-secondary" onClick={test} disabled={testing}>
        {label}
      </button>
      {result && <span className={resultClass}>{result.text}</span>}
    </div>
  )
}

function DeleteHost({ id, name }: { id: number; name: string }) {
  const [state, formAction, pending] = useActionState(deleteDockerHost, initialState)
  useResultToast(state)

  const confirmDelete = useConfirmedSubmit(formAction, {
    title: 'Delete the Docker host "' + name + '"?',
    message: 'Docker checks can no longer use it.',
    confirmText: 'Delete',
    danger: true,
  })

  return (
    <form action={formAction} onSubmit={confirmDelete}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="link-button danger" disabled={pending}>
        Delete
      </button>
    </form>
  )
}

export default function DockerHosts({ data, canEdit }: { data: DockerHostsResponse; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(createDockerHost, initialState)
  useResultToast(state)

  let addText = 'Add host'
  if (pending) {
    addText = 'Adding…'
  }

  return (
    <section className="manage-panel">
      <h2>Docker hosts</h2>
      <p className="panel-intro">
        Docker checks ask Docker whether a container runs. This server uses the address below; add other servers that
        share Docker over HTTP, preferably through a socket proxy.
      </p>
      <div className="manage-list">
        <div className="manage-list-row docker-host-row">
          <div>
            <strong>This server</strong>
            <span>{data.default_address}</span>
          </div>
          <TestButton hostId={null} />
        </div>
        {data.hosts.map(function (host) {
          let usedText = 'Not used yet'
          if (host.services === 1) {
            usedText = 'Used by 1 service'
          } else if (host.services > 1) {
            usedText = 'Used by ' + host.services + ' services'
          }
          return (
            <div className="manage-list-row docker-host-row" key={host.id}>
              <div>
                <strong>{host.name}</strong>
                <span>
                  {host.address}, {usedText.toLowerCase()}
                </span>
              </div>
              <TestButton hostId={host.id} />
              {canEdit && <DeleteHost id={host.id} name={host.name} />}
            </div>
          )
        })}
      </div>
      {canEdit && (
        <form action={formAction} className="manage-form docker-host-form">
          <div className="form-row">
            <label>
              <span>Name</span>
              <input name="name" required maxLength={60} placeholder="e.g. Game node 1" />
            </label>
            <label>
              <span>Address</span>
              <input name="address" required placeholder="http://192.168.1.20:2375" />
            </label>
          </div>
          <small className="field-hint">
            http://, https:// or tcp:// with a port, or unix:// for a socket. Docker never needs to accept changes from
            AeroStat, it only reads.
          </small>
          <div className="form-actions">
            <button type="submit" className="button-primary" disabled={pending}>
              {addText}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
