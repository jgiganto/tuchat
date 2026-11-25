namespace Server.Chat;

/// <summary>Métodos del chat que el servidor invoca en el navegador.</summary>
public interface IChatClient
{
    Task ReceiveChatMessage(ChatMessage message);

    Task ReceiveSystemMessage(SystemMessage message);

    Task ShowUserTyping(TypingNotification notification);

    Task UpdateOnlineUserCount(int onlineUserCount);
}
