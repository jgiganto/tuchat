namespace Server.Chat;

/// <summary>Conserva los mensajes recientes de cada sala.</summary>
public interface IChatHistory
{
    void Add(ChatMessage message);

    /// <returns>Los últimos mensajes de la sala, del más antiguo al más reciente.</returns>
    IReadOnlyList<ChatMessage> GetRecentMessages(string room);
}
