namespace Server.Chat;

/// <summary>Aviso generado por el servidor en una sala, por ejemplo "fulano se ha unido".</summary>
public sealed record SystemMessage(Guid Id, string Room, string Text, DateTimeOffset SentAt);
