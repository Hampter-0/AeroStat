'use client'

import { useEffect, useState } from 'react'
import { listContainers } from '@/app/manage/(panel)/docker-actions'
import type { DockerContainer, DockerHostsResponse } from '@/lib/docker'

export default function DockerTarget({
  hosts,
  hostId,
  container,
}: {
  hosts: DockerHostsResponse | null
  hostId: number | null
  container: string
}) {
  let startHost = ''
  if (hostId !== null) {
    startHost = String(hostId)
  }
  const [host, setHost] = useState(startHost)
  const [containers, setContainers] = useState<DockerContainer[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [typing, setTyping] = useState(false)
  const [chosen, setChosen] = useState(container)

  useEffect(
    function () {
      let active = true
      let id: number | null = null
      if (host !== '') {
        id = Number(host)
      }
      listContainers(id).then(function (result) {
        if (!active) {
          return
        }
        setLoading(false)
        if (result.list) {
          setContainers(result.list.containers)
          setError(null)
        } else {
          setContainers(null)
          setError(result.error)
        }
      })
      return function () {
        active = false
      }
    },
    [host]
  )

  function changeHost(event: React.ChangeEvent<HTMLSelectElement>) {
    setLoading(true)
    setHost(event.target.value)
  }

  function changeContainer(event: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) {
    setChosen(event.target.value)
  }

  function startTyping() {
    setTyping(true)
  }

  const showList = !typing && containers !== null && containers.length > 0
  let options: DockerContainer[] = []
  if (containers) {
    options = containers
  }
  const known = options.some(function (item) {
    return item.name === chosen
  })

  let hint = 'Up when the container runs and is not unhealthy.'
  if (loading) {
    hint = 'Looking for containers…'
  } else if (error) {
    hint = error + ' Type the container name, or see the docs on how to connect Docker.'
  } else if (containers !== null && containers.length === 0) {
    hint = 'Docker answered, but there are no containers. Type the name of the container.'
  }

  return (
    <div className="form-row">
      <label>
        <span>Docker host</span>
        <select name="docker_host_id" value={host} onChange={changeHost}>
          <option value="">This server</option>
          {hosts &&
            hosts.hosts.map(function (item) {
              return (
                <option value={String(item.id)} key={item.id}>
                  {item.name}
                </option>
              )
            })}
        </select>
      </label>
      <label>
        <span>Container</span>
        {showList && (
          <select name="url" value={chosen} onChange={changeContainer} required>
            <option value="" disabled>
              Pick a container
            </option>
            {!known && chosen && <option value={chosen}>{chosen}</option>}
            {options.map(function (item) {
              return (
                <option value={item.name} key={item.name}>
                  {item.name} ({item.state})
                </option>
              )
            })}
          </select>
        )}
        {!showList && <input name="url" value={chosen} onChange={changeContainer} required placeholder="my-app" />}
        <small className="field-hint">
          {hint}
          {showList && (
            <>
              {' '}
              <button type="button" className="link-button docker-type-name" onClick={startTyping}>
                Type a name instead
              </button>
            </>
          )}
        </small>
      </label>
    </div>
  )
}
