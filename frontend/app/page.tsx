export default async function Home() {
  const request = await fetch("http://localhost:3004/health")
  const response = await request.text()

  return (
    <main>
      <h1>AeroStat</h1>

      <p>Backend API: {process.env.API_URL}</p>

      <p>Health: {response}</p>
    </main>
  )
}