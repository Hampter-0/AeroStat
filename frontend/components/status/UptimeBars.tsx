export default function UptimeBars() {
  // Placeholder: flat 60-day bar. Real per-day history (daily rollups, cached in Redis) will be used here
  const days = []
  var i = 0
  while (i < 60) {
    days.push(i)
    i = i + 1
  }

  return (
    <div className="uptime-bars" aria-label="60 day uptime history">
      {days.map(function (day) {
        return <span key={day} className="bar" />
      })}
    </div>
  )
}