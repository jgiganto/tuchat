import { ref, computed, readonly, onBeforeUnmount } from 'vue'
import * as signalR from '@microsoft/signalr'

export const ConnectionState = Object.freeze({
  Disconnected: 'Disconnected',
  Connecting: 'Connecting',
  Connected: 'Connected',
  Reconnecting: 'Reconnecting',
})

// Esperas entre reintentos tras perder la conexión. Después del último se da por cerrada.
const RECONNECT_DELAYS_MS = [0, 2000, 5000, 10000]

// Por defecto el cliente corta si pasa 30 s sin recibir nada del servidor. En desarrollo lo
// ampliamos para poder quedarnos parados en un breakpoint del backend sin perder la conexión.
const DEVELOPMENT_SERVER_TIMEOUT_MS = 10 * 60 * 1000

/**
 * Gestiona una única conexión con un Hub de SignalR y expone su estado de forma reactiva.
 *
 * Las suscripciones a eventos se guardan aparte de la conexión porque esta se crea de nuevo
 * en cada connect(): así un componente puede suscribirse antes de conectar, o mantenerse
 * suscrito entre una desconexión y la siguiente conexión.
 */
export function useHubConnection(hubUrl) {
  const state = ref(ConnectionState.Disconnected)
  const lastError = ref('')
  const isConnected = computed(() => state.value === ConnectionState.Connected)

  const subscriptions = new Set()
  const reconnectedListeners = new Set()
  let connection = null

  // Usuario de la última conexión pedida. Sirve para volver a conectar sin que el usuario
  // pulse nada; se borra cuando se desconecta voluntariamente.
  let userNameToReconnect = null

  async function connect(userName) {
    userNameToReconnect = userName
    await closeConnection()

    connection = buildConnection(hubUrl, userName)
    subscriptions.forEach(({ eventName, listener }) => connection.on(eventName, listener))
    listenToConnectionLifecycle(connection)

    state.value = ConnectionState.Connecting
    lastError.value = ''
    try {
      await connection.start()
      state.value = ConnectionState.Connected
    } catch (error) {
      connection = null
      state.value = ConnectionState.Disconnected
      lastError.value = error.message
    }
  }

  async function disconnect() {
    userNameToReconnect = null
    await closeConnection()
  }

  async function closeConnection() {
    if (!connection) return

    const closingConnection = connection
    connection = null
    await closingConnection.stop()
  }

  function invoke(methodName, ...args) {
    if (!isConnected.value) {
      return Promise.reject(new Error('No hay conexión con el servidor'))
    }
    return connection.invoke(methodName, ...args)
  }

  /** Escucha un evento enviado por el servidor. Devuelve una función para dejar de escucharlo. */
  function on(eventName, handler) {
    // Si un handler devuelve algo, SignalR lo envía al servidor como respuesta ("client results")
    // y registra un error porque el servidor no la espera. Lo envolvemos para descartar el valor.
    const listener = (...args) => {
      handler(...args)
    }
    const subscription = { eventName, listener }

    subscriptions.add(subscription)
    connection?.on(eventName, listener)

    return () => {
      subscriptions.delete(subscription)
      connection?.off(eventName, listener)
    }
  }

  /** Se ejecuta cada vez que la reconexión automática tiene éxito. Devuelve una función para cancelarlo. */
  function onReconnected(listener) {
    reconnectedListeners.add(listener)
    return () => reconnectedListeners.delete(listener)
  }

  function listenToConnectionLifecycle(hubConnection) {
    hubConnection.onreconnecting(() => {
      state.value = ConnectionState.Reconnecting
    })
    hubConnection.onreconnected(() => {
      state.value = ConnectionState.Connected
      reconnectedListeners.forEach((listener) => listener())
    })
    hubConnection.onclose((error) => {
      state.value = ConnectionState.Disconnected
      if (error) lastError.value = error.message
    })
  }

  // En el móvil, al bloquear la pantalla o cambiar de app, el navegador suspende la pestaña y la
  // conexión se pierde. Si para entonces la reconexión automática ya se ha rendido, volvemos a
  // conectar en cuanto la página vuelve a estar visible.
  function reconnectIfPageVisible() {
    const pageIsVisible = document.visibilityState === 'visible'
    const connectionWasLost = state.value === ConnectionState.Disconnected && userNameToReconnect

    if (pageIsVisible && connectionWasLost) connect(userNameToReconnect)
  }

  document.addEventListener('visibilitychange', reconnectIfPageVisible)

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', reconnectIfPageVisible)
    closeConnection()
  })

  return {
    state: readonly(state),
    lastError: readonly(lastError),
    isConnected,
    connect,
    disconnect,
    invoke,
    on,
    onReconnected,
  }
}

/** Suscribe un handler a un evento del servidor mientras el componente que lo llama esté montado. */
export function useHubEvent(hub, eventName, handler) {
  const unsubscribe = hub.on(eventName, handler)
  onBeforeUnmount(unsubscribe)
}

function buildConnection(hubUrl, userName) {
  const connection = new signalR.HubConnectionBuilder()
    .withUrl(`${hubUrl}?user=${encodeURIComponent(userName)}`)
    .withAutomaticReconnect(RECONNECT_DELAYS_MS)
    .configureLogging(signalR.LogLevel.Information)
    .build()

  if (import.meta.env.DEV) {
    connection.serverTimeoutInMilliseconds = DEVELOPMENT_SERVER_TIMEOUT_MS
  }
  return connection
}
