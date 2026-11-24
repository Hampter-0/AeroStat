'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/app/manage/actions'
import { createService, updateService } from '@/app/manage/(panel)/services/actions'
import { useResultToast } from '@/components/manage/toast/Toasts'
import DockerTarget from '@/components/manage/services/DockerTarget'
import type { DockerHostsResponse } from '@/lib/docker'
import {
  checkTypeGroups,
  checkTypeInfo,
  DNS_RECORD_TYPES,
  INTERVAL_UNITS,
  splitInterval,
  type ManageGroup,
  type ManageService,
} from '@/lib/services'
import { useFormSubmit } from '@/lib/use-form-submit'

const initialState: FormState = { error: null, success: null }

export default function ServiceForm({
  groups,
  service,
  defaultGroupId,
  certificateText,
  dockerHosts,
}: {
  groups: ManageGroup[]
  service: ManageService | null
  defaultGroupId: string
  certificateText: string | null
  dockerHosts: DockerHostsResponse | null
}) {
  let action = createService
  if (service) {
    action = updateService
  }
  const [state, formAction, pending] = useActionState(action, initialState)
  useResultToast(state)
  const { formRef, onSubmit } = useFormSubmit(formAction, state)

  let name = ''
  let url = ''
  let groupId = defaultGroupId
  let statuses = '200'
  let interval = 300
  let startType = 'http'
  let keyword = ''
  let keywordMode = 'present'
  let recordType = 'A'
  let dnsExpected = ''
  let certDays = '14'
  if (service) {
    name = service.name
    url = service.url
    groupId = ''
    if (service.group_id) {
      groupId = service.group_id
    }
    statuses = service.expected_status.join(', ')
    interval = service.check_interval_seconds
    startType = service.check_type
    if (service.keyword) {
      keyword = service.keyword
    }
    if (service.keyword_absent) {
      keywordMode = 'absent'
    }
    if (service.dns_record_type) {
      recordType = service.dns_record_type
    }
    if (service.dns_expected) {
      dnsExpected = service.dns_expected
    }
    certDays = ''
    if (service.cert_warn_days) {
      certDays = String(service.cert_warn_days)
    }
  }

  const [checkType, setCheckType] = useState(startType)

  function changeType(event: React.ChangeEvent<HTMLSelectElement>) {
    setCheckType(event.target.value)
  }

  const intervalParts = splitInterval(interval)

  let buttonText = 'Add service'
  if (service) {
    buttonText = 'Save changes'
  }
  if (pending) {
    buttonText = 'Saving…'
  }

  const typeInfo = checkTypeInfo(checkType)
  let targetType = 'text'
  if (checkType === 'http') {
    targetType = 'url'
  }
  let targetValue = url
  let dockerHostId: number | null = null
  if (service && service.check_type === 'docker') {
    dockerHostId = service.docker_host_id
  }
  if (service && service.check_type !== checkType) {
    targetValue = ''
  }

  let certificateHint = 'Leave empty to turn it off. Only for https:// addresses, checked every few hours.'
  if (certificateText) {
    certificateHint = 'The certificate is valid until ' + certificateText + '. Leave empty to turn the warning off.'
  }

  const intervalField = (
    <label>
      <span>Check every</span>
      <div className="interval-field">
        <input
          name="interval_amount"
          type="number"
          min={1}
          step={1}
          required
          defaultValue={intervalParts.amount}
          aria-label="Interval amount"
        />
        <select name="interval_unit" defaultValue={intervalParts.unit} aria-label="Interval unit">
          {INTERVAL_UNITS.map(function (unit) {
            return (
              <option value={unit.value} key={unit.value}>
                {unit.label}
              </option>
            )
          })}
        </select>
      </div>
      <small className="field-hint">Between 30 seconds and 24 hours.</small>
    </label>
  )

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} className="manage-form">
      {service && <input type="hidden" name="id" value={service.id} />}
      <div className="form-row">
        <label>
          <span>Name</span>
          <input name="name" defaultValue={name} required maxLength={100} placeholder="e.g. Website" />
        </label>
        <label>
          <span>Group</span>
          <select name="group_id" defaultValue={groupId}>
            <option value="">No group (shown under Other)</option>
            {groups.map(function (group) {
              return (
                <option value={group.id} key={group.id}>
                  {group.name}
                </option>
              )
            })}
          </select>
        </label>
      </div>
      <div className="form-row">
        <label>
          <span>Check type</span>
          <select name="check_type" value={checkType} onChange={changeType}>
            {checkTypeGroups().map(function (group) {
              return (
                <optgroup label={group.name} key={group.name}>
                  {group.types.map(function (type) {
                    return (
                      <option value={type.value} key={type.value}>
                        {type.label}
                      </option>
                    )
                  })}
                </optgroup>
              )
            })}
          </select>
        </label>
        {checkType === 'dns' && (
          <label>
            <span>Record type</span>
            <select name="dns_record_type" defaultValue={recordType}>
              {DNS_RECORD_TYPES.map(function (type) {
                return (
                  <option value={type} key={type}>
                    {type}
                  </option>
                )
              })}
            </select>
          </label>
        )}
        {checkType !== 'dns' && intervalField}
      </div>
      {checkType === 'docker' && (
        <DockerTarget
          key={'docker-' + checkType}
          hosts={dockerHosts}
          hostId={dockerHostId}
          container={targetValue}
        />
      )}
      {checkType !== 'docker' && (
        <label>
          <span>{typeInfo.target}</span>
          <input
            key={'target-' + checkType}
            name="url"
            type={targetType}
            defaultValue={targetValue}
            required
            placeholder={typeInfo.placeholder}
          />
          <small className="field-hint">{typeInfo.hint}</small>
        </label>
      )}
      {checkType === 'http' && (
        <>
          <div className="form-row">
            <label>
              <span>Expected status codes</span>
              <input name="expected_status" defaultValue={statuses} required placeholder="200, 204" />
              <small className="field-hint">Separate with commas. Any other code counts as down.</small>
            </label>
            <label>
              <span>Warn before the certificate runs out</span>
              <div className="interval-field">
                <input
                  name="cert_warn_days"
                  type="number"
                  min={1}
                  max={90}
                  step={1}
                  defaultValue={certDays}
                  placeholder="Off"
                  aria-label="Days before the certificate runs out"
                />
                <span className="interval-suffix">days before</span>
              </div>
              <small className="field-hint">{certificateHint}</small>
            </label>
          </div>
          <div className="form-row">
            <label>
              <span>Keyword (optional)</span>
              <input name="keyword" defaultValue={keyword} maxLength={200} placeholder="e.g. Welcome" />
              <small className="field-hint">Looked for in the page, ignoring upper and lower case.</small>
            </label>
            <label>
              <span>The keyword</span>
              <select name="keyword_mode" defaultValue={keywordMode}>
                <option value="present">Must be on the page</option>
                <option value="absent">Must not be on the page</option>
              </select>
              <small className="field-hint">For example, down when the page says “Error”.</small>
            </label>
          </div>
        </>
      )}
      {checkType === 'dns' && (
        <div className="form-row">
          <label>
            <span>Expected value (optional)</span>
            <input name="dns_expected" defaultValue={dnsExpected} maxLength={255} placeholder="203.0.113.10" />
            <small className="field-hint">Down when no record has this value. Empty means any record is fine.</small>
          </label>
          {intervalField}
        </div>
      )}
      <div className="form-actions">
        <button type="submit" className="button-primary" disabled={pending}>
          {buttonText}
        </button>
      </div>
    </form>
  )
}
