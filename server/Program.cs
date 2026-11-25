using Microsoft.AspNetCore.SignalR;
using Server.Chat;

var builder = WebApplication.CreateBuilder(args);

// Plataformas como Render indican en la variable PORT el puerto en el que deben escuchar.
var hostingPort = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(hostingPort))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{hostingPort}");
}

// Una línea por entrada de log; el formato por defecto ocupa dos y se lee peor en el panel de Render.
builder.Logging.AddSimpleConsole(options => options.SingleLine = true);

builder.Services.AddSingleton<IConnectedUserRegistry, InMemoryConnectedUserRegistry>();
builder.Services.AddSingleton<IChatHistory, InMemoryChatHistory>();

// Singleton para que el contador de llamadas de cada conexión se conserve entre llamadas.
builder.Services.AddSingleton<HubRateLimitFilter>();

builder.Services.AddSignalR(options =>
{
    options.AddFilter<HubRateLimitFilter>();

    if (builder.Environment.IsDevelopment())
    {
        options.EnableDetailedErrors = true;

        // Si el navegador se queda parado en un breakpoint deja de enviar pings y, por defecto,
        // el servidor lo desconecta a los 30 segundos. En desarrollo damos margen para depurar.
        options.ClientTimeoutInterval = TimeSpan.FromMinutes(10);
    }
});

var app = builder.Build();

// En producción el frontend compilado se publica dentro de wwwroot y lo sirve este mismo servidor.
// En desarrollo wwwroot no existe y el frontend lo sirve Vite.
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapHub<ChatHub>(ChatHub.Route);

// Cualquier ruta que no sea un archivo ni el Hub devuelve la aplicación Vue.
app.MapFallbackToFile("index.html");

app.Run();
