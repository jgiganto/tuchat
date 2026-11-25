using System.Collections.Concurrent;

namespace Server.Chat;

/// <summary>
/// Historial en memoria del proceso. Se pierde cuando el servidor se reinicia; en el plan
/// gratuito de Render eso ocurre en cada despliegue y cada vez que el servicio se duerme.
/// Para conservarlo de verdad haría falta otra implementación con base de datos.
/// </summary>
public sealed class InMemoryChatHistory : IChatHistory
{
    private const int MaxMessagesPerRoom = 50;

    // La aplicación es pública: sin un tope, alguien podría agotar la memoria creando salas sin fin.
    private const int MaxRooms = 100;

    private readonly ConcurrentDictionary<string, Queue<ChatMessage>> _messagesByRoom = new();

    public void Add(ChatMessage message)
    {
        var isNewRoom = !_messagesByRoom.ContainsKey(message.Room);
        if (isNewRoom && _messagesByRoom.Count >= MaxRooms) return;

        var roomMessages = _messagesByRoom.GetOrAdd(message.Room, _ => new Queue<ChatMessage>());

        // Queue no es segura para hilos. Bloqueamos solo la cola de esta sala para que
        // los mensajes de salas distintas no se esperen entre sí.
        lock (roomMessages)
        {
            roomMessages.Enqueue(message);

            if (roomMessages.Count > MaxMessagesPerRoom)
                roomMessages.Dequeue();
        }
    }

    public IReadOnlyList<ChatMessage> GetRecentMessages(string room)
    {
        if (!_messagesByRoom.TryGetValue(room, out var roomMessages))
            return [];

        lock (roomMessages)
        {
            return roomMessages.ToArray();
        }
    }
}
