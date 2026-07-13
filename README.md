# Greedy Hudzell Website + Discord Bot

Современный сайт + Discord бот для Roblox скрипта.

## Структура
- `index.html` — Главный сайт
- `raw-script.lua` — Скрипт для Roblox
- `discord-bot/` — Discord бот
- `api/` — Backend API

## Установка

### Discord Bot
```bash
cd discord-bot
npm install discord.js dotenv
cp .env.example .env
# Добавь токен в .env
node index.js
```

### API
```bash
cd api
npm install express
node server.js
```

### Деплой
- Сайт: Vercel / Netlify
- API + Bot: Railway / Render / VPS
- Subdomains настраивай через Cloudflare или хостинг

## Команды бота
- `!verify` — Получить ключ
- `!status` — Статус скрипта
