export default function Logo({ size }: { size?: number }) {
  let finalSize = size
  if (finalSize === undefined) {
    finalSize = 30
  }
  return <img src="/branding/logo" alt="" width={finalSize} height={finalSize} style={{ objectFit: 'contain' }} />
}
