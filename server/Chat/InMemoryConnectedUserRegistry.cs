using System.Collections.Concurrent;

namespace Server.Chat;

/// <summary>
/// Registro de usuarios en memoria del proceso.
/// Solo es válido con una única instancia del servidor: con varias, cada una vería únicamente
/// sus propias conexiones y habría que guardar esto en un almacén compartido (por ejemplo Redis).
/// </summary>
public sealed class InMemoryConnectedUserRegistry : IConnectedUserRegistry
{
    private const string UnknownUserName = "desconocido";

    // El Hub atiende llamadas de muchos clientes a la vez, de ahí el diccionario concurrente.
    private readonly ConcurrentDictionary<string, string> _userNamesByConnectionId = new();

    public int Count => _userNamesByConnectionId.Count;

    public void Add(string connectionId, string userName) =>
        _userNamesByConnectionId[connectionId] = userName;

    public string? Remove(string connectionId) =>
        _userNamesByConnectionId.TryRemove(connectionId, out var userName) ? userName : null;

    public string GetUserName(string connectionId) =>
        _userNamesByConnectionId.GetValueOrDefault(connectionId, UnknownUserName);
}
