// Recuerda el usuario, la última sala y si había una conexión abierta, para que al recargar
// la página se vuelva a conectar solo. Los mensajes no se guardan aquí: los devuelve el
// servidor al entrar en la sala.
//
// Se usa sessionStorage y no localStorage porque es independiente en cada pestaña: así se puede
// probar con dos pestañas y dos usuarios distintos. Sobrevive a una recarga, pero no a cerrar la pestaña.

const STORAGE_KEY = 'signalr-poc-session'

/** @returns {{ userName?: string, room?: string, shouldReconnect?: boolean }} */
export function loadSavedSession() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) ?? {}
  } catch {
    return {}
  }
}

/** Guarda solo los campos indicados y conserva el resto. */
export function updateSavedSession(changes) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSavedSession(), ...changes }))
  } catch {
    // El almacenamiento puede no estar disponible (navegación privada estricta, cuota llena...).
    // La aplicación funciona igual; simplemente no recordará nada al recargar.
  }
}
