namespace Server.Chat;

/// <summary>Sabe qué usuario hay detrás de cada conexión de SignalR.</summary>
/// <remarks>
/// Un mismo usuario con dos pestañas abiertas tiene dos conexiones distintas,
/// por eso la clave es el ConnectionId y no el nombre.
/// </remarks>
public interface IConnectedUserRegistry
{
    int Count { get; }

    void Add(string connectionId, string userName);

    /// <returns>El nombre del usuario que tenía la conexión, o null si no estaba registrada.</returns>
    string? Remove(string connectionId);

    string GetUserName(string connectionId);
}
