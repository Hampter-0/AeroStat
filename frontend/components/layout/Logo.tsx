export default function Logo({ size }: { size?: number }) {
  var finalSize = size
  if (finalSize === undefined) {
    finalSize = 30
  }
  return <img src="/brand/logo.svg" alt="" width={finalSize} height={finalSize} />
}