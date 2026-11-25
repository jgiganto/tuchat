namespace Server.Chat;

/// <summary>Mensaje escrito por un usuario en una sala.</summary>
public sealed record ChatMessage(string Room, string UserName, string Text, DateTimeOffset SentAt);
