namespace Server.Chat;

/// <summary>Indica que un usuario está escribiendo en una sala.</summary>
public sealed record TypingNotification(string Room, string UserName);
