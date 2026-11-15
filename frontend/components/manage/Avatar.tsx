export default function Avatar({
  userId,
  username,
  version,
  size,
}: {
  userId: number
  username: string
  version: number | null
  size: number
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) }

  if (version) {
    return (
      <img
        className="avatar"
        src={'/manage/avatar/' + userId + '?v=' + version}
        alt=""
        width={size}
        height={size}
        style={style}
      />
    )
  }

  return (
    <span className="avatar initials" style={style} aria-hidden="true">
      {username.charAt(0).toUpperCase()}
    </span>
  )
}
