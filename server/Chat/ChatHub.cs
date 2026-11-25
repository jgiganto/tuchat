using Microsoft.AspNetCore.SignalR;

namespace Server.Chat;

/// <summary>
/// Hub del chat.
/// Los métodos públicos son los que el navegador puede llamar con connection.invoke(...).
/// Las llamadas en sentido contrario (servidor a navegador) se hacen con Clients.* y están
/// definidas en <see cref="IChatClient"/>.
/// </summary>
/// <remarks>
/// SignalR crea una instancia nueva del Hub por cada llamada, así que no puede guardar estado
/// en campos. Lo que tenga que sobrevivir entre llamadas va en servicios singleton, como el registro de usuarios.
/// </remarks>
public sealed class ChatHub(
    IConnectedUserRegistry connectedUsers,
    IChatHistory chatHistory,
    ILogger<ChatHub> logger) : Hub<IChatClient>
{
    public const string Route = "/hubs/chat";

    // La aplicación es pública: limitamos tamaños para que nadie pueda inundar la sala con textos enormes.
    // El cliente aplica los mismos límites en los campos de texto, pero quien manda es el servidor.
    private const int MaxUserNameLength = 30;
    private const int MaxRoomNameLength = 30;
    private const int MaxMessageLength = 500;

    private const string UserNameQueryParameter = "user";

    public override async Task OnConnectedAsync()
    {
        var userName = ReadUserNameFromQuery();
        connectedUsers.Add(Context.ConnectionId, userName);
        logger.LogInformation("Conectado {UserName} ({ConnectionId})", userName, Context.ConnectionId);

        await Clients.All.UpdateOnlineUserCount(connectedUsers.Count);
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        // No hace falta sacar la conexión de sus salas: SignalR la quita de todos los grupos al desconectarse.
        var userName = connectedUsers.Remove(Context.ConnectionId);
        logger.LogInformation("Desconectado {UserName} ({ConnectionId})", userName, Context.ConnectionId);

        await Clients.All.UpdateOnlineUserCount(connectedUsers.Count);
        await base.OnDisconnectedAsync(exception);
    }

    /// <returns>
    /// Los mensajes recientes de la sala. Lo que devuelve un método del Hub le llega al cliente
    /// como resultado de su connection.invoke(...), solo a él.
    /// </returns>
    public async Task<IReadOnlyList<ChatMessage>> JoinRoom(string room)
    {
        var roomName = RequireText(room, "El nombre de la sala", MaxRoomNameLength);

        await Groups.AddToGroupAsync(Context.ConnectionId, roomName);
        logger.LogInformation("{UserName} entra en la sala {Room}", CurrentUserName, roomName);
        await AnnounceInRoom(roomName, $"{CurrentUserName} se ha unido a la sala");

        // El historial se lee después de entrar en el grupo para no perder ningún mensaje enviado
        // justo en medio. Si alguno llega por las dos vías, el cliente lo descarta por su Id.
        return chatHistory.GetRecentMessages(roomName);
    }

    public async Task LeaveRoom(string room)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, room);
        logger.LogInformation("{UserName} sale de la sala {Room}", CurrentUserName, room);
        await AnnounceInRoom(room, $"{CurrentUserName} ha salido de la sala");
    }

    public Task SendChatMessage(string room, string text)
    {
        var roomName = RequireText(room, "El nombre de la sala", MaxRoomNameLength);
        var messageText = RequireText(text, "El mensaje", MaxMessageLength);
        var message = new ChatMessage(Guid.NewGuid(), roomName, CurrentUserName, messageText, DateTimeOffset.UtcNow);

        chatHistory.Add(message);

        // Se sustituyen los saltos de línea para que un mensaje no pueda fingir líneas falsas en el log.
        logger.LogInformation("[{Room}] {UserName}: {Text}", roomName, message.UserName, messageText.ReplaceLineEndings(" "));

        return Clients.Group(roomName).ReceiveChatMessage(message);
    }

    public Task NotifyTyping(string room) =>
        Clients.OthersInGroup(room).ShowUserTyping(new TypingNotification(room, CurrentUserName));

    private string CurrentUserName => connectedUsers.GetUserName(Context.ConnectionId);

    private Task AnnounceInRoom(string room, string text) =>
        Clients.Group(room).ReceiveSystemMessage(new SystemMessage(Guid.NewGuid(), room, text, DateTimeOffset.UtcNow));

    // El nombre llega en la URL de conexión. Si viene vacío se genera uno, y si es demasiado largo
    // se recorta: lanzar una excepción aquí cortaría la conexión sin un mensaje claro para el usuario.
    private string ReadUserNameFromQuery()
    {
        var userName = Context.GetHttpContext()?.Request.Query[UserNameQueryParameter].ToString().Trim();

        if (string.IsNullOrEmpty(userName))
            return $"anonimo-{Context.ConnectionId[..5]}";

        return userName.Length > MaxUserNameLength ? userName[..MaxUserNameLength] : userName;
    }

    // HubException es la única excepción cuyo mensaje llega al cliente. Cualquier otra se
    // sustituye por un error genérico para no exponer detalles internos del servidor.
    private static string RequireText(string? value, string fieldDescription, int maxLength)
    {
        var text = value?.Trim();

        if (string.IsNullOrEmpty(text))
            throw new HubException($"{fieldDescription} no puede estar vacío.");

        if (text.Length > maxLength)
            throw new HubException($"{fieldDescription} no puede superar los {maxLength} caracteres.");

        return text;
    }
}
