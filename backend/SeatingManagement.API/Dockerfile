# Fase de Build
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build-env
WORKDIR /App

# Copiar os ficheiros do projeto e restaurar as dependências
COPY . ./
RUN dotnet restore

# Fazer o Build da aplicação
RUN dotnet publish -c Release -o out

# Fase de Runtime (Imagem mais leve para correr na nuvem)
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /App
COPY --from=build-env /App/out .

# Dizer ao Render qual a porta a utilizar
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

# Comando para arrancar a API
ENTRYPOINT ["dotnet", "SeatingManagement.API.dll"]