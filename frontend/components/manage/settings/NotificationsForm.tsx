'use client'

import { useActionState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { saveNotifications, sendTestNotification, sendTestSlow } from '@/app/manage/(panel)/settings/actions'
import { useResultToast } from '@/components/manage/toast/Toasts'
import { EVENT_GROUPS, type NotificationSettings } from '@/lib/notifications'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function NotificationsForm({ settings }: { settings: NotificationSettings }) {
  const [state, formAction, pending] = useActionState(saveNotifications, initialState)
  useResultToast(state)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)
  const [testState, testAction, testing] = useActionState(sendTestNotification, initialState)
  useResultToast(testState)
  const [slowState, slowAction, slowTesting] = useActionState(sendTestSlow, initialState)
  useResultToast(slowState)

  let webhookHint = 'Server settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.'
  let webhookPlaceholder = 'https://discord.com/api/webhooks/…'
  if (settings.discord_configured) {
    webhookHint = 'A webhook is saved (' + settings.discord_hint + '). Paste a new URL to replace it.'
    webhookPlaceholder = 'Saved, leave empty to keep it'
  }

  let addressText = 'Messages have no links yet. Set the status page address under Settings → General.'
  if (settings.public_url) {
    addressText = 'Messages link to ' + settings.public_url + '. Change it under Settings → General.'
  }

  let saveText = 'Save'
  if (pending) {
    saveText = 'Saving…'
  }
  let testText = 'Send test message'
  if (testing) {
    testText = 'Sending…'
  }
  let slowText = 'Send test'
  if (slowTesting) {
    slowText = 'Sending…'
  }

  return (
    <>
      <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
        <label>
          <span>Discord webhook URL</span>
          <input name="discord_webhook_url" type="password" autoComplete="off" placeholder={webhookPlaceholder} />
          <small className="field-hint">{webhookHint}</small>
        </label>
        {settings.discord_configured && (
          <label className="check-row hint-row">
            <input type="checkbox" name="remove_webhook" />
            <span>
              <strong>Remove the webhook</strong>
              <small>Stop sending messages to Discord.</small>
            </span>
          </label>
        )}
        <p className="field-hint notification-address">{addressText}</p>

        {EVENT_GROUPS.map(function (group) {
          const events = group.events.filter(function (event) {
            return settings.available_events.includes(event.id)
          })
          if (events.length === 0) {
            return null
          }
          return (
            <fieldset className="notification-group" key={group.title}>
              <legend>{group.title}</legend>
              <div className="permission-grid">
                {events.map(function (event) {
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

      {settings.discord_configured && (
        <form action={testAction} className="notification-test">
          <span>Check that messages arrive in your channel.</span>
          <button type="submit" className="button-secondary" disabled={testing}>
            {testText}
          </button>
        </form>
      )}

      <form action={slowAction} className="notification-test">
        <span>See how a slow response warning looks, on Discord, by email to you and in your panel.</span>
        <button type="submit" className="button-secondary" disabled={slowTesting}>
          {slowText}
        </button>
      </form>
    </>
  )
}
