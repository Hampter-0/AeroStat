export default function UptimeBars({ down }: { down: boolean }) {
  // Placeholder: flat 60-day bar reflecting current status. Real
  // per-day history (daily rollups, cached in Redis) is a later step.
  var barClassName = 'bar'
  if (down) {
    barClassName = 'bar down'
  }

  const days = []
  var i = 0
  while (i < 60) {
    days.push(i)
    i = i + 1
  }

  return (
    <div className="uptime-bars" aria-label="60 day uptime history">
      {days.map(function (day) {
        return <span key={day} className={barClassName} />
      })}
    </div>
  )
}