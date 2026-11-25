<script setup>
import { ref } from 'vue'
import { HUB_URL } from './realtime/realtimeContract'
import { useHubConnection } from './realtime/useHubConnection'
import ConnectionPanel from './realtime/ConnectionPanel.vue'
import ChatRoom from './chat/ChatRoom.vue'

// Una sola conexión para toda la aplicación. Cada componente recibe el hub
// y se suscribe únicamente a los eventos que le interesan.
const hub = useHubConnection(HUB_URL)
const { isConnected } = hub

const userName = ref(`usuario${Math.floor(Math.random() * 1000)}`)
</script>

<template>
  <header>
    <h1>SignalR PoC <small>Vue 3 + ASP.NET Core</small></h1>
  </header>

  <ConnectionPanel v-model:user-name="userName" :hub="hub" />

  <main v-if="isConnected">
    <ChatRoom :hub="hub" :user-name="userName" />
  </main>
</template>

<style scoped>
h1 {
  margin: 0;
  font-size: 1.4rem;
}
h1 small {
  font-size: 0.9rem;
  font-weight: 400;
  color: var(--color-muted);
}
</style>
