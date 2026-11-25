<script setup>
import { ref, watch, nextTick } from 'vue'
import { useChat } from './useChat'
import { TextLimits } from '../realtime/realtimeContract'

const props = defineProps({
  hub: { type: Object, required: true },
  userName: { type: String, required: true },
})

const {
  initialRoom,
  currentRoom,
  currentRoomMessages,
  typingUserName,
  errorMessage,
  joinRoom,
  sendMessage,
  notifyTyping,
} = useChat(props.hub)

const roomInput = ref(initialRoom)
const messageInput = ref('')
const messageList = ref(null)

// La validación del texto vive en el servidor (RealtimeHub). No se repite aquí para que,
// al enviar un mensaje vacío, se vea cómo llega una HubException al cliente.
async function submitMessage() {
  const wasSent = await sendMessage(messageInput.value)
  if (wasSent) messageInput.value = ''
}

watch(
  () => currentRoomMessages.value.length,
  async () => {
    await nextTick()
    messageList.value?.scrollTo({ top: messageList.value.scrollHeight, behavior: 'smooth' })
  },
)

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString()
}
</script>

<template>
  <section class="card">
    <form class="row" @submit.prevent="joinRoom(roomInput)">
      <label>
        Sala
        <input v-model="roomInput" :maxlength="TextLimits.RoomName" />
      </label>
      <button class="secondary" :disabled="roomInput.trim() === currentRoom">Cambiar de sala</button>
      <span class="muted">Sala actual: <b>{{ currentRoom }}</b></span>
    </form>

    <ul ref="messageList" class="message-list">
      <li v-for="message in currentRoomMessages" :key="message.id" :class="{ system: message.isSystem }">
        <span class="timestamp">{{ formatTime(message.sentAt) }}</span>
        <i v-if="message.isSystem">{{ message.text }}</i>
        <template v-else>
          <b :class="{ own: message.userName === userName }">{{ message.userName }}:</b>
          {{ message.text }}
        </template>
      </li>
    </ul>

    <p class="typing-indicator">
      <template v-if="typingUserName">{{ typingUserName }} está escribiendo...</template>
    </p>

    <form class="row" @submit.prevent="submitMessage">
      <input
        v-model="messageInput"
        class="grow"
        placeholder="Escribe un mensaje"
        :maxlength="TextLimits.Message"
        @input="notifyTyping"
      />
      <button>Enviar</button>
    </form>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
  </section>
</template>

<style scoped>
.message-list {
  list-style: none;
  height: 340px;
  margin: 10px 0 0;
  padding: 8px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
}
.message-list li {
  padding: 3px 0;
}
.system {
  color: var(--color-muted);
}
.timestamp {
  margin-right: 6px;
  font-size: 0.75rem;
  color: var(--color-muted);
  font-variant-numeric: tabular-nums;
}
.own {
  color: var(--color-accent);
}
.typing-indicator {
  height: 1.3em;
  margin: 4px 0;
  font-size: 0.8rem;
  color: var(--color-muted);
}
</style>
