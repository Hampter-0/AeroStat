'use client'

import { useRouter } from 'next/navigation'

export default function UptimeServiceSelect({
  services,
  selected,
}: {
  services: { id: string; name: string }[]
  selected: string
}) {
  const router = useRouter()

  function change(event: React.ChangeEvent<HTMLSelectElement>) {
    router.push('/uptime?service=' + encodeURIComponent(event.target.value), { scroll: false })
  }

  return (
    <select className="chart-select uptime-select" value={selected} onChange={change} aria-label="Service">
      {services.map(function (service) {
        return (
          <option value={service.id} key={service.id}>
            {service.name}
          </option>
        )
      })}
    </select>
  )
}
