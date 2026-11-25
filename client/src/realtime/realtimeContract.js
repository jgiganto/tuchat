// Nombres compartidos con el servidor. Tienen que coincidir exactamente (sin distinguir
// mayúsculas) con los métodos de ChatHub y de IChatClient en el backend.
// Si un nombre no coincide no salta ningún error: el mensaje simplemente se pierde.

export const HUB_URL = '/hubs/chat'

// Cliente -> servidor: métodos públicos de ChatHub (se llaman con hub.invoke).
export const HubMethods = Object.freeze({
  JoinRoom: 'JoinRoom',
  LeaveRoom: 'LeaveRoom',
  SendChatMessage: 'SendChatMessage',
  NotifyTyping: 'NotifyTyping',
})

// Servidor -> cliente: métodos de IChatClient (se escuchan con hub.on).
export const ServerEvents = Object.freeze({
  ReceiveChatMessage: 'ReceiveChatMessage',
  ReceiveSystemMessage: 'ReceiveSystemMessage',
  ShowUserTyping: 'ShowUserTyping',
  UpdateOnlineUserCount: 'UpdateOnlineUserCount',
})

// Mismos límites que aplica ChatHub. Aquí solo sirven para que el usuario no pueda escribir de más;
// la validación real la hace el servidor.
export const TextLimits = Object.freeze({
  UserName: 30,
  RoomName: 30,
  Message: 500,
})
