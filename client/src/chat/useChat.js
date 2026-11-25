import { ref, computed, onBeforeUnmount } from 'vue'
import { useHubEvent } from '../realtime/useHubConnection'
import { HubMethods, ServerEvents } from '../realtime/realtimeContract'
import { loadSavedSession, updateSavedSession } from '../session/savedSession'

const DEFAULT_ROOM = 'general'

// Como mucho se envía un aviso de "escribiendo" cada este tiempo, para no saturar el servidor.
const TYPING_NOTIFICATION_THROTTLE_MS = 800
// Tiempo que se muestra el indicador si no llegan más avisos.
const TYPING_INDICATOR_DURATION_MS = 1500

/**
 * Estado y acciones del chat. Se apoya en una conexión ya establecida: el componente que lo
 * usa solo se monta estando conectado, y se vuelve a montar tras cada reconexión, de modo que
 * al entrar de nuevo en la sala recupera los mensajes recientes desde el servidor.
 */
export function useChat(hub) {
  const initialRoom = loadSavedSession().room ?? DEFAULT_ROOM

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

  async function joinRoom(room) {
    const roomName = room.trim()
    if (roomName === currentRoom.value) return

    await runReportingErrors(async () => {
      if (currentRoom.value) await hub.invoke(HubMethods.LeaveRoom, currentRoom.value)

      const recentMessages = await hub.invoke(HubMethods.JoinRoom, roomName)
      addMissingMessages(recentMessages)

      currentRoom.value = roomName
      updateSavedSession({ room: roomName })
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

  // El historial que devuelve el servidor puede incluir mensajes que ya tenemos: los que llegaron
  // en directo mientras entrábamos o los de una visita anterior a la sala. Añadimos solo los que
  // faltan y dejamos la lista en orden cronológico.
  function addMissingMessages(recentMessages) {
    const knownIds = new Set(messages.value.map((message) => message.id))
    const missingMessages = recentMessages
      .filter((message) => !knownIds.has(message.id))
      .map((message) => ({ ...message, isSystem: false }))

    messages.value = [...missingMessages, ...messages.value].sort(bySentAt)
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

  joinRoom(initialRoom)

  return {
    initialRoom,
    currentRoom,
    currentRoomMessages,
    typingUserName,
    errorMessage,
    joinRoom,
    sendMessage,
    notifyTyping,
  }
}

function bySentAt(first, second) {
  return new Date(first.sentAt) - new Date(second.sentAt)
}

// Una HubException llega como "An unexpected error occurred invoking 'X' on the server.
// HubException: <mensaje>". Nos quedamos solo con el mensaje escrito en el servidor.
function toReadableHubError(error) {
  return error.message.split('HubException: ').pop()
}
