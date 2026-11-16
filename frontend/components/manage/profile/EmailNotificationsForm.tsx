'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { saveEmailNotifications } from '@/app/manage/(panel)/profile/actions'
import { useResultToast } from '@/components/manage/toast/Toasts'
import type { MyNotifications } from '@/lib/email'
import { EVENT_GROUPS } from '@/lib/notifications'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function EmailNotificationsForm({ settings }: { settings: MyNotifications }) {
  const [state, formAction, pending] = useActionState(saveEmailNotifications, initialState)
  useResultToast(state)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)

  let saveText = 'Save'
  if (pending) {
    saveText = 'Saving…'
  }

  const groups = []
  for (const group of EVENT_GROUPS) {
    const events = []
    for (const event of group.events) {
      if (settings.available_events.includes(event.id)) {
        events.push(event)
      }
    }
    if (events.length > 0) {
      groups.push({ title: group.title, events: events })
    }
  }

  if (groups.length === 0) {
    return <p className="manage-empty">There is nothing you can get emails about yet. You need access to services, incidents or maintenance.</p>
  }

  let note = 'Emails go to ' + settings.email + '.'
  if (!settings.email) {
    note = 'Add an email address under Account first.'
  }
  if (!settings.email_configured) {
    note = 'Email is not set up on this server yet. Ask an admin to add the mail settings. You can already choose what you want.'
  }

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      <p className="panel-intro">{note}</p>
      {groups.map(function (group) {
        return (
          <fieldset className="notification-group" key={group.title}>
            <legend>{group.title}</legend>
            <div className="permission-grid">
              {group.events.map(function (event) {
                return (
                  <label className="check-row hint-row" key={event.id}>
                    <input type="checkbox" name="events" value={event.id} defaultChecked={settings.events.includes(event.id)} />
                    <span>
                      <strong>{event.label}</strong>
                      <small>{event.hint}</small>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )
      })}

      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={pending}>
          {saveText}
        </button>
      </div>
    </form>
  )
}
