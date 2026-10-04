export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  runtimeConfig: {
    public: {
      siteName: process.env.SITE_NAME || 'Status Page',
      apiUrl: process.env.API_URL || 'http://localhost:3004',
    },
  },
})
