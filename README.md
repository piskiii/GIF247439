# GIF247439

Jednoduchá Node.js aplikace postavená na Expressu.

## Co aplikace umí

- `GET /` vrací textovou odpověď `Hello from Azure App Service!`
- `GET /health` vrací JSON `{"status":"ok"}`

## Požadavky

- Node.js 18 nebo novější
- npm

## Instalace

```bash
npm install
```

## Spuštění

```bash
npm start
```

Ve výchozím nastavení běží aplikace na portu `3000`. Port lze změnit přes proměnnou prostředí `PORT`.

## Ověření

```bash
curl http://localhost:3000/
curl http://localhost:3000/health
```