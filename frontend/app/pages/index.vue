<script setup lang="ts">
const config = useRuntimeConfig()
</script>
<template>
  <main>
    <h1>{{ config.public.siteName }}</h1>
    <p>Backend API: {{ config.public.apiUrl }}</p>
  </main>
</template>
