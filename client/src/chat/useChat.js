import { ref, computed, onBeforeUnmount } from 'vue'
import { useHubEvent } from '../realtime/useHubConnection'
import { HubMethods, ServerEvents } from '../realtime/realtimeContract'

export const DEFAULT_ROOM = 'general'

// Como mucho se envía un aviso de "escribiendo" cada este tiempo, para no saturar el servidor.
const TYPING_NOTIFICATION_THROTTLE_MS = 800
// Tiempo que se muestra el indicador si no llegan más avisos.
const TYPING_INDICATOR_DURATION_MS = 1500

/**
 * Estado y acciones del chat. Se apoya en una conexión ya establecida:
 * el componente que lo usa solo debe montarse estando conectado.
 */
export function useChat(hub) {
  const currentRoom = ref(null)
  const messages = ref([])
  const typingUserName = ref('')
  const errorMessage = ref('')

  // Se guardan los mensajes de todas las salas visitadas para conservar el historial al volver a una.
  const currentRoomMessages = computed(() =>
    messages.value.filter((message) => message.room === currentRoom.value),
  )

  let hideTypingIndicatorTimer
  let lastTypingNotificationAt = 0

  useHubEvent(hub, ServerEvents.ReceiveChatMessage, (message) => {
    messages.value.push({ ...message, isSystem: false })
  })

  useHubEvent(hub, ServerEvents.ReceiveSystemMessage, (message) => {
    messages.value.push({ ...message, isSystem: true })
  })

  useHubEvent(hub, ServerEvents.ShowUserTyping, ({ room, userName }) => {
    if (room === currentRoom.value) showTypingIndicator(userName)
  })

  // Al reconectar, el servidor asigna un ConnectionId nuevo que no pertenece a ningún grupo,
  // así que hay que volver a entrar en la sala para seguir recibiendo sus mensajes.
  const stopListeningReconnections = hub.onReconnected(() => {
    if (currentRoom.value) hub.invoke(HubMethods.JoinRoom, currentRoom.value)
  })
  onBeforeUnmount(stopListeningReconnections)

  async function joinRoom(room) {
    const roomName = room.trim()
    if (roomName === currentRoom.value) return

    await runReportingErrors(async () => {
      if (currentRoom.value) await hub.invoke(HubMethods.LeaveRoom, currentRoom.value)
      await hub.invoke(HubMethods.JoinRoom, roomName)
      currentRoom.value = roomName
    })
  }

  /** Devuelve true si el servidor aceptó el mensaje. */
  function sendMessage(text) {
    return runReportingErrors(() => hub.invoke(HubMethods.SendChatMessage, currentRoom.value, text))
  }

  function notifyTyping() {
    const now = Date.now()
    if (!currentRoom.value || now - lastTypingNotificationAt < TYPING_NOTIFICATION_THROTTLE_MS) return

    lastTypingNotificationAt = now
    // Es un aviso puramente visual: si se pierde no merece la pena mostrar un error.
    hub.invoke(HubMethods.NotifyTyping, currentRoom.value).catch(() => {})
  }

  function showTypingIndicator(userName) {
    typingUserName.value = userName
    clearTimeout(hideTypingIndicatorTimer)
    hideTypingIndicatorTimer = setTimeout(() => {
      typingUserName.value = ''
    }, TYPING_INDICATOR_DURATION_MS)
  }

  async function runReportingErrors(action) {
    errorMessage.value = ''
    try {
      await action()
      return true
    } catch (error) {
      errorMessage.value = toReadableHubError(error)
      return false
    }
  }

  onBeforeUnmount(() => clearTimeout(hideTypingIndicatorTimer))

  joinRoom(DEFAULT_ROOM)

  return {
    currentRoom,
    currentRoomMessages,
    typingUserName,
    errorMessage,
    joinRoom,
    sendMessage,
    notifyTyping,
  }
}

// Una HubException llega como "An unexpected error occurred invoking 'X' on the server.
// HubException: <mensaje>". Nos quedamos solo con el mensaje escrito en el servidor.
function toReadableHubError(error) {
  return error.message.split('HubException: ').pop()
}
