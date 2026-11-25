# Imagen única: el backend ASP.NET Core sirve también el frontend Vue compilado.

# Etapa 1: compilar el frontend
FROM node:24-alpine AS client-build
WORKDIR /src/client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Etapa 2: publicar el backend
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS server-build
WORKDIR /src/server
COPY server/Server.csproj ./
RUN dotnet restore
COPY server/ ./
RUN dotnet publish --configuration Release --output /app/publish --no-restore

# Etapa 3: imagen final, solo con el runtime y lo publicado
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=server-build /app/publish ./
COPY --from=client-build /src/client/dist ./wwwroot

# Puerto por defecto de las imágenes de .NET. Si la plataforma define PORT, Program.cs usa ese.
EXPOSE 8080
ENTRYPOINT ["dotnet", "Server.dll"]
