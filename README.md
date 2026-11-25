# PoC SignalR: chat con Vue 3 + ASP.NET Core (.NET 10)

Chat en tiempo real por salas: mensajes, avisos de entrada y salida, indicador de "escribiendo"
y contador de usuarios conectados.

## Arrancar en local

```powershell
# Terminal 1: backend en http://localhost:5125
dotnet run --project server

# Terminal 2: frontend en http://localhost:5173
cd client
npm install      # detrás de un proxy corporativo: $env:NODE_USE_SYSTEM_CA='1'; npm install
npm run dev
```

Abre http://localhost:5173 en dos pestañas con usuarios distintos.

## Depurar

- **Backend (Visual Studio):** abrir `SignalR.sln`, perfil `http`, F5 (no Ctrl+F5).
- **Frontend (VS Code):** abrir la carpeta raíz del repositorio, Run and Debug, `Front: Vite + Edge`, F5.
- En `Development` los timeouts de SignalR están a 10 minutos en ambos lados para poder quedarse
  parado en un breakpoint sin que se caiga la conexión.

## Estructura

```
Dockerfile                        Imagen única: compila el front y lo publica dentro del back
server/
  Program.cs                      Servicios, ficheros estáticos, Hub y fallback de la SPA
  Chat/
    ChatHub.cs                    Ciclo de vida de la conexión y métodos del chat
    IChatClient.cs                Lo que el servidor envía al navegador
    ChatMessage.cs, SystemMessage.cs, TypingNotification.cs
    IConnectedUserRegistry.cs     Qué usuario hay detrás de cada conexión
    InMemoryConnectedUserRegistry.cs
    IChatHistory.cs               Últimos mensajes de cada sala
    InMemoryChatHistory.cs
    HubRateLimitFilter.cs         Máximo de llamadas por conexión
client/src/
  App.vue                         Crea la conexión y compone la pantalla
  realtime/
    realtimeContract.js           Nombres de métodos, eventos y límites compartidos con el servidor
    useHubConnection.js           Conexión, estado reactivo, suscripciones y reconexión
    ConnectionPanel.vue           Usuario, conectar/desconectar, estado
  chat/
    useChat.js                    Estado y acciones del chat
    ChatRoom.vue                  Vista del chat
  session/savedSession.js         Usuario, sala y conexión recordados al recargar
  styles/main.css                 Variables de color y estilos compartidos
```

Los componentes `.vue` solo pintan; el estado y la comunicación con el servidor están en los `use*.js`.

## Flujo

| Acción | Cliente | Servidor |
|---|---|---|
| Conectar | `useHubConnection.connect` | `ChatHub.OnConnectedAsync` |
| Entrar en sala | `useChat.joinRoom` (recibe el historial) | `ChatHub.JoinRoom` (Groups) devuelve los últimos mensajes |
| Enviar mensaje | `useChat.sendMessage` | `ChatHub.SendChatMessage` -> historial, log y `Clients.Group` |
| Escribiendo | `useChat.notifyTyping` | `ChatHub.NotifyTyping` -> `Clients.OthersInGroup` |
| Error controlado | mensaje vacío o demasiado largo | `HubException` en `ChatHub.RequireText` |
| Demasiadas llamadas | ráfaga de mensajes | `HubRateLimitFilter` |

## Estado al recargar la página

- **Servidor:** guarda en memoria los últimos 50 mensajes de cada sala (hasta 100 salas) y los devuelve
  al entrar en ella. Se pierden al reiniciar el servidor, que en el plan gratuito de Render ocurre en
  cada despliegue y cada vez que se duerme.
- **Navegador:** `sessionStorage` recuerda usuario, sala y si había conexión, y al recargar se reconecta
  solo. Es independiente en cada pestaña y se borra al cerrarla.

## Logs

Cada conexión, entrada o salida de sala y mensaje se escribe en el log en una línea, por ejemplo
`[general] usuario123: hola`. En Render se ven en la pestaña Logs del servicio.

## Despliegue en Render (plan gratuito)

1. Subir este repositorio a GitHub (puede ser privado).
2. En https://render.com: New > Web Service > conectar el repositorio.
3. Language: **Docker**, Instance type: **Free**. No hace falta configurar nada más:
   Render detecta el `Dockerfile` y define la variable `PORT`, que `Program.cs` ya respeta.
4. Cada `git push` a la rama configurada vuelve a desplegar.

El plan gratuito se duerme tras unos 15 minutos sin tráfico; la primera visita tarda en despertarlo.

Para probar la imagen en local: `docker build -t signalr-poc .` y `docker run -p 8080:8080 signalr-poc`.
Detrás de un proxy corporativo con inspección SSL, `npm ci` falla dentro del contenedor; en Render no ocurre.

## Limitaciones conocidas

- El registro de usuarios está en memoria: con varias instancias haría falta un backplane (Redis)
  o Azure SignalR Service. Basta con otra implementación de `IConnectedUserRegistry`.
- No hay autenticación: el nombre viaja en la query string y cualquiera puede elegir cualquier nombre.
- Un cliente puede enviar mensajes a una sala en la que no ha entrado; SignalR no permite consultar
  la pertenencia a grupos, así que habría que llevar ese control aparte.
