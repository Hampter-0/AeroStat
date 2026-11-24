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
    return <p className="manage-empty">There is nothing you can get notifications about yet. You need access to services, incidents or maintenance.</p>
  }

  let emailNote = 'Email goes to ' + settings.email + '.'
  if (!settings.email) {
    emailNote = 'For email, add an address under Email first.'
  }
  if (!settings.email_configured) {
    emailNote = 'Email is not set up on this server yet, but you can already choose what you want.'
  }
  const note = 'Panel shows a pop-up at the bottom right while you use the panel. ' + emailNote

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      <p className="panel-intro">{note}</p>
      <label className="check-row hint-row notices-toggle">
        <input type="checkbox" name="panel_enabled" defaultChecked={settings.panel_enabled} />
        <span>
          <strong>Show notifications in the panel</strong>
          <small>New notifications pop up at the bottom right. When it is off, nothing is saved for you. Email keeps working.</small>
        </span>
      </label>
      {groups.map(function (group) {
        return (
          <fieldset className="notification-group notify-table" key={group.title}>
            <legend>{group.title}</legend>
            <div className="notify-row notify-head" aria-hidden="true">
              <span />
              <span>Panel</span>
              <span>Email</span>
            </div>
            {group.events.map(function (event) {
              return (
                <div className="notify-row" key={event.id}>
                  <span className="notify-text">
                    <strong>{event.label}</strong>
                    <small>{event.hint}</small>
                  </span>
                  <label className="check-row notify-check">
                    <input
                      type="checkbox"
                      name="panel_events"
                      value={event.id}
                      defaultChecked={settings.panel_events.includes(event.id)}
                      aria-label={event.label + ' in the panel'}
                    />
                  </label>
                  <label className="check-row notify-check">
                    <input
                      type="checkbox"
                      name="events"
                      value={event.id}
                      defaultChecked={settings.events.includes(event.id)}
                      aria-label={event.label + ' by email'}
                    />
                  </label>
                </div>
              )
            })}
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
