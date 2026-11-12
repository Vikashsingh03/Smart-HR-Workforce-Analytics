# SmartHR API — ASP.NET Core 8, Docker image for Render (free tier).
# Build context is the repo root (SmartHR.sln lives there).
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY SmartHR.sln ./
COPY src/SmartHR.Api/SmartHR.Api.csproj src/SmartHR.Api/
COPY src/SmartHR.Core/SmartHR.Core.csproj src/SmartHR.Core/
COPY src/SmartHR.Ingestion/SmartHR.Ingestion.csproj src/SmartHR.Ingestion/
RUN dotnet restore SmartHR.sln
COPY . ./
RUN dotnet publish src/SmartHR.Api/SmartHR.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./
# Pre-loaded demo database (1,470 employees, built from the IBM HR sample).
# The API reads it via ConnectionStrings__Sqlite (see render.yaml).
COPY smarthr.db ./
ENV ASPNETCORE_ENVIRONMENT=Production
ENTRYPOINT ["dotnet", "SmartHR.Api.dll"]
