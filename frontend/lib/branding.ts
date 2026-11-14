let siteName: string = 'AeroStat'
if (process.env.SITE_NAME) {
  siteName = process.env.SITE_NAME
}

let accentColor: string = '#1678c2'
if (process.env.PRIMARY_COLOR) {
  accentColor = process.env.PRIMARY_COLOR
}

let contactUrl: string | null = null
if (process.env.CONTACT_URL) {
  contactUrl = process.env.CONTACT_URL
}

export { accentColor, contactUrl, siteName }
