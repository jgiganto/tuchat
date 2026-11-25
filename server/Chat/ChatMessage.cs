namespace Server.Chat;

/// <summary>Mensaje escrito por un usuario en una sala.</summary>
/// <param name="Id">Identificador único; el cliente lo usa para no mostrar dos veces el mismo mensaje.</param>
public sealed record ChatMessage(Guid Id, string Room, string UserName, string Text, DateTimeOffset SentAt);
