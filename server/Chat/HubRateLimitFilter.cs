using System.Threading.RateLimiting;
using Microsoft.AspNetCore.SignalR;

namespace Server.Chat;

/// <summary>
/// Limita cuántas llamadas al Hub puede hacer cada conexión, para que un cliente no pueda
/// inundar la sala de mensajes.
/// </summary>
/// <remarks>
/// Un filtro de Hub envuelve cada llamada a un método del Hub, igual que un middleware envuelve
/// una petición HTTP. El rate limiting de ASP.NET Core no sirve aquí porque solo ve la petición
/// HTTP inicial; las llamadas posteriores viajan todas dentro del mismo WebSocket.
/// </remarks>
public sealed class HubRateLimitFilter : IHubFilter, IDisposable
{
    // Un "cubo de fichas" por conexión: cada llamada gasta una ficha y el cubo se rellena con el tiempo.
    // Permite ráfagas cortas de hasta 10 llamadas, con una media sostenida de 5 por segundo.
    private readonly PartitionedRateLimiter<string> _limiterByConnectionId =
        PartitionedRateLimiter.Create<string, string>(connectionId =>
            RateLimitPartition.GetTokenBucketLimiter(connectionId, _ => new TokenBucketRateLimiterOptions
            {
                TokenLimit = 10,
                TokensPerPeriod = 5,
                ReplenishmentPeriod = TimeSpan.FromSeconds(1),
                QueueLimit = 0,
                AutoReplenishment = true,
            }));

    public async ValueTask<object?> InvokeMethodAsync(
        HubInvocationContext invocationContext,
        Func<HubInvocationContext, ValueTask<object?>> next)
    {
        using var lease = _limiterByConnectionId.AttemptAcquire(invocationContext.Context.ConnectionId);

        if (!lease.IsAcquired)
            throw new HubException("Demasiados mensajes seguidos. Espera un momento.");

        return await next(invocationContext);
    }

    public void Dispose() => _limiterByConnectionId.Dispose();
}
