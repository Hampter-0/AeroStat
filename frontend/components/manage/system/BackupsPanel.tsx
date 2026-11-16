'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useRef, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { createBackup, deleteBackup } from '@/app/manage/(panel)/system/backup-actions'
import { Database, Upload } from '@/components/icons'
import { useConfirmedSubmit } from '@/components/manage/confirm/Confirm'
import SettingsForm from '@/components/manage/settings/SettingsForm'
import { useErrorToast, useResultToast, useToast } from '@/components/manage/toast/Toasts'
import { KIND_LABELS, type Backup, type BackupsView } from '@/lib/backups'
import { formatBytes } from '@/lib/system'
import { formatDateTimeShort } from '@/lib/time'

const initialState: FormState = { error: null, success: null }

function versionText(version: string): string {
  if (version === 'unknown') {
    return 'Unknown'
  }
  return 'v' + version
}

function DeleteBackup({ backup, label }: { backup: Backup; label: string }) {
  const [state, formAction, pending] = useActionState(deleteBackup, initialState)
  useResultToast(state)
  const onSubmit = useConfirmedSubmit(formAction, {
    title: 'Delete the backup from ' + label + '?',
    message: 'The file is removed from the server. This cannot be undone.',
    confirmText: 'Delete backup',
    danger: true,
  })

  return (
    <form action={formAction} onSubmit={onSubmit} className="backup-delete">
      <input type="hidden" name="id" value={backup.id} />
      <button type="submit" className="link-button danger" disabled={pending}>
        Delete
      </button>
    </form>
  )
}

export default function BackupsPanel({ data, timezone }: { data: BackupsView; timezone: string }) {
  const [state, formAction, pending] = useActionState(createBackup, initialState)
  useResultToast(state)
  const router = useRouter()
  const showToast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  useErrorToast(uploadError)

  function chooseFile() {
    if (fileRef.current) {
      fileRef.current.value = ''
      fileRef.current.click()
    }
  }

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files && event.target.files[0]
    if (!file) {
      return
    }
    setUploading(true)
    setUploadError(null)
    let message: string | null = null
    try {
      const res = await fetch('/manage/backups/upload', {
        method: 'POST',
        headers: { 'x-file-name': encodeURIComponent(file.name) },
        body: file,
      })
      if (!res.ok) {
        message = 'The upload failed (' + res.status + ')'
        try {
          const body = await res.json()
          if (body.error) {
            message = body.error
          }
        } catch {
          message = 'The upload failed (' + res.status + ')'
        }
      }
    } catch {
      message = 'The upload broke off. Check your connection and try again.'
    }
    setUploading(false)
    if (message) {
      setUploadError(message)
      return
    }
    showToast('Backup uploaded')
    router.refresh()
  }

  let uploadText = 'Upload a backup'
  if (uploading) {
    uploadText = 'Uploading…'
  }

  let buttonText = 'Make a backup now'
  if (pending) {
    buttonText = 'Making a backup…'
  }

  let countText = data.backups.length + ' backups, ' + formatBytes(data.total_bytes)
  if (data.backups.length === 1) {
    countText = '1 backup, ' + formatBytes(data.total_bytes)
  }

  let folder = 'the backup folder'
  if (data.dir) {
    folder = data.dir
  }

  return (
    <>
      {!data.tool && (
        <section className="update-notice warning">
          <div>
            <strong>pg_dump is not available</strong>
            <span>
              Backups need the PostgreSQL tools. They are in the Docker image; outside Docker, install the PostgreSQL client
              or set PG_DUMP_PATH, PG_RESTORE_PATH and PSQL_PATH.
            </span>
          </div>
        </section>
      )}

      <section className="manage-panel activity-panel">
        <div className="activity-bar backup-bar">
          <div>
            <h2>Backups</h2>
            <small className="table-count">{countText}</small>
          </div>
          <div className="backup-buttons">
            <input ref={fileRef} type="file" accept=".dump" className="sr-only" onChange={upload} tabIndex={-1} />
            <button type="button" className="button-secondary" onClick={chooseFile} disabled={uploading || !data.tool}>
              <Upload /> {uploadText}
            </button>
            <form action={formAction}>
              <button type="submit" className="button-primary" disabled={pending || !data.tool}>
                <Database /> {buttonText}
              </button>
            </form>
          </div>
        </div>
        {data.backups.length === 0 && <p className="manage-empty activity-empty">No backups yet.</p>}
        {data.backups.length > 0 && (
          <div className="activity-table-wrap">
            <table className="activity-table backups-table">
              <thead>
                <tr>
                  <th>Made</th>
                  <th>Type</th>
                  <th>Version</th>
                  <th>Size</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.backups.map(function (backup) {
                  const made = formatDateTimeShort(backup.created_at, timezone)
                  let by = 'Automatic'
                  if (backup.created_by) {
                    by = 'By ' + backup.created_by
                  }
                  if (backup.note) {
                    by = by + ' · ' + backup.note
                  }
                  let chipClass = 'chip'
                  if (backup.kind === 'manual') {
                    chipClass = 'chip admin'
                  } else if (backup.kind === 'update' || backup.kind === 'restore') {
                    chipClass = 'chip muted'
                  }
                  return (
                    <tr key={backup.id}>
                      <td>
                        <div className="backup-made">
                          <strong>{made}</strong>
                          <small>{by}</small>
                        </div>
                      </td>
                      <td>
                        <span className={chipClass}>{KIND_LABELS[backup.kind]}</span>
                      </td>
                      <td>
                        <code>{versionText(backup.version)}</code>
                      </td>
                      <td className="table-muted">{formatBytes(backup.size_bytes)}</td>
                      <td className="table-action">
                        <div className="backup-actions">
                          <a href={'/manage/backups/' + encodeURIComponent(backup.id) + '/download'} className="button-secondary" download>
                            Download
                          </a>
                          <DeleteBackup backup={backup} label={made} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="field-hint backup-hint">
          Keep a copy somewhere else too, with your <code>.env</code>: a backup on the same server is lost with the server. To
          move to another server, upload a backup there. Restoring is done from the server with <code>aerostat cli</code> →{' '}
          <code>restore</code>.
        </p>
      </section>

      <section className="manage-panel">
        <h2>Where they are</h2>
        {data.in_docker && (
          <div className="backup-location">
            <p>
              Inside the backend container in <code>{folder}</code>, which is the Docker volume <code>aerostat_backups</code> on
              the server. Find that folder on the server:
            </p>
            <pre>{"docker volume inspect aerostat_backups --format '{{ .Mountpoint }}'"}</pre>
            <p>
              It is usually <code>/var/lib/docker/volumes/aerostat_backups/_data</code>, readable as root. Copy them all to the
              folder you are in, next to <code>docker-compose.yml</code>:
            </p>
            <pre>docker compose cp backend:/data/backups ./aerostat-backups</pre>
            <p className="field-hint">
              Mapped the backups to a folder of your own in docker-compose.override.yml? Then they are in that folder.
            </p>
          </div>
        )}
        {!data.in_docker && (
          <div className="backup-location">
            <p>
              In <code>{folder}</code> on this server. Change it with <code>BACKUP_DIR</code> in <code>.env</code>.
            </p>
          </div>
        )}
      </section>

      <section className="manage-panel">
        <h2>Schedule</h2>
        <SettingsForm>
          <div className="form-row">
            <label>
              <span>Automatic backups</span>
              <select key={'backup_schedule-' + data.settings.schedule} name="backup_schedule" defaultValue={data.settings.schedule}>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
                <option value="off">Off</option>
              </select>
              <small className="field-hint">Made after 03:00 in the site&apos;s timezone.</small>
            </label>
            <label>
              <span>Automatic backups to keep</span>
              <input
                key={'backup_keep-' + data.settings.keep}
                name="backup_keep"
                type="number"
                min={1}
                max={365}
                defaultValue={data.settings.keep}
              />
              <small className="field-hint">Older ones are deleted. Manual backups stay until you delete them.</small>
            </label>
          </div>
          <label>
            <span>Backup before an update</span>
            <select
              key={'backup_before_update-' + String(data.settings.before_update)}
              name="backup_before_update"
              defaultValue={String(data.settings.before_update)}
            >
              <option value="true">On</option>
              <option value="false">Off</option>
            </select>
            <small className="field-hint">
              When a new version starts for the first time, it backs up the database before changing it. The last 3 are kept.
            </small>
          </label>
        </SettingsForm>
      </section>
    </>
  )
}
