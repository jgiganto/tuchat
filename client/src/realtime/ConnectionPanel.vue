<script setup>
import { ref, computed } from 'vue'
import { ConnectionState, useHubEvent } from './useHubConnection'
import { ServerEvents, TextLimits } from './realtimeContract'

const props = defineProps({
  hub: { type: Object, required: true },
})
const userName = defineModel('userName', { type: String, required: true })

const STATE_LABELS = {
  [ConnectionState.Disconnected]: 'Desconectado',
  [ConnectionState.Connecting]: 'Conectando',
  [ConnectionState.Connected]: 'Conectado',
  [ConnectionState.Reconnecting]: 'Reconectando',
}

const { state, lastError, isConnected, connect, disconnect } = props.hub
const onlineUserCount = ref(0)

const stateLabel = computed(() => STATE_LABELS[state.value])
const isConnecting = computed(() => state.value === ConnectionState.Connecting)

// Este componente no se desmonta al desconectar, así que la suscripción sigue viva
// y se aplica de nuevo en cada conexión.
useHubEvent(props.hub, ServerEvents.UpdateOnlineUserCount, (count) => {
  onlineUserCount.value = count
})
</script>

<template>
  <section class="card">
    <div class="row">
      <label>
        Usuario
        <input v-model="userName" :disabled="isConnected" :maxlength="TextLimits.UserName" />
      </label>

      <button v-if="!isConnected" :disabled="isConnecting" @click="connect(userName)">Conectar</button>
      <button v-else class="secondary" @click="disconnect">Desconectar</button>

      <span class="state-badge" :class="`state-${state.toLowerCase()}`">{{ stateLabel }}</span>
      <span v-if="isConnected" class="muted">{{ onlineUserCount }} conectados</span>
    </div>

    <p v-if="lastError" class="error">{{ lastError }}</p>
  </section>
</template>

<style scoped>
.state-badge {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.8rem;
  color: #fff;
  background: var(--color-muted);
}
.state-connected {
  background: var(--color-success);
}
.state-connecting,
.state-reconnecting {
  background: var(--color-warning);
}
</style>
