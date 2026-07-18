import os
import requests
import discord
from discord.ext import commands
from dotenv import load_dotenv

# Загружаем переменные окружения из .env
load_dotenv()

# --- Настройки ---
DISCORD_TOKEN = os.getenv('DISCORD_TOKEN')
API_URL = os.getenv('API_URL', 'http://localhost:3000')  # URL твоего Node.js API

# --- Создаём бота с префиксом ! ---
intents = discord.Intents.default()
intents.message_content = True
bot = commands.Bot(command_prefix='!', intents=intents)

# --- Команда: !status online/offline ---
@bot.command(name='status')
async def set_status(ctx, state: str):
    """Включить/выключить сайт (online/offline)"""
    if state not in ['online', 'offline']:
        await ctx.send("❌ Используй: `!status online` или `!status offline`")
        return
    is_online = (state == 'online')
    try:
        response = requests.post(f"{API_URL}/api/command", json={
            "type": "status",
            "data": {"online": is_online}
        })
        if response.status_code == 200:
            await ctx.send(f"🟢 Сайт теперь {state}")
        else:
            await ctx.send("❌ Ошибка при обновлении статуса сайта")
    except Exception as e:
        await ctx.send(f"❌ Ошибка соединения с API: {e}")

# --- Команда: !bot online/offline ---
@bot.command(name='bot')
async def set_bot(ctx, state: str):
    """Изменить статус 'Бот на связи' (online/offline)"""
    if state not in ['online', 'offline']:
        await ctx.send("❌ Используй: `!bot online` или `!bot offline`")
        return
    is_online = (state == 'online')
    try:
        response = requests.post(f"{API_URL}/api/command", json={
            "type": "bot",
            "data": {"online": is_online}
        })
        if response.status_code == 200:
            await ctx.send(f"🤖 Статус бота изменён на {state}")
        else:
            await ctx.send("❌ Ошибка при обновлении статуса бота")
    except Exception as e:
        await ctx.send(f"❌ Ошибка соединения с API: {e}")

# --- Команда: !update "текст" ---
@bot.command(name='update')
async def add_update(ctx, *, text: str):
    """Добавить запись в ленту обновлений"""
    if not text:
        await ctx.send("❌ Укажи текст обновления: `!update \"Новое обновление\"`")
        return
    try:
        response = requests.post(f"{API_URL}/api/command", json={
            "type": "update",
            "data": {"author": ctx.author.display_name, "text": text}
        })
        if response.status_code == 200:
            await ctx.send(f"📢 Обновление добавлено: \"{text}\"")
        else:
            await ctx.send("❌ Ошибка при добавлении обновления")
    except Exception as e:
        await ctx.send(f"❌ Ошибка соединения с API: {e}")

# --- Команда: !game add "Название" "статус" ---
@bot.command(name='game')
async def add_game(ctx, action: str, name: str, status: str = "доступно"):
    """Добавить игру (используй: !game add "Название" "статус")"""
    if action.lower() != 'add':
        await ctx.send("❌ Используй: `!game add \"Название\" \"статус\"`")
        return
    try:
        response = requests.post(f"{API_URL}/api/command", json={
            "type": "game",
            "data": {"name": name, "status": status}
        })
        if response.status_code == 200:
            await ctx.send(f"🎮 Игра \"{name}\" добавлена со статусом \"{status}\"")
        else:
            await ctx.send("❌ Ошибка при добавлении игры")
    except Exception as e:
        await ctx.send(f"❌ Ошибка соединения с API: {e}")

# --- Команда: !key check <токен> ---
@bot.command(name='key')
async def check_key(ctx, action: str, token: str = None):
    """Проверить ключ через Work.ink API: !key check <токен>"""
    if action.lower() != 'check' or not token:
        await ctx.send("❌ Используй: `!key check <токен_ключа>`")
        return
    try:
        response = requests.get(f"https://work.ink/_api/v2/token/isValid/{token}")
        data = response.json()
        if data.get('valid'):
            await ctx.send(f"🔑 Ключ `{token}` ✅ действителен")
        else:
            await ctx.send(f"🔑 Ключ `{token}` ❌ недействителен")
    except Exception as e:
        await ctx.send(f"❌ Ошибка при проверке ключа: {e}")

# --- Запуск бота ---
if __name__ == "__main__":
    if not DISCORD_TOKEN:
        print("❌ Не задан DISCORD_TOKEN в .env файле")
    else:
        bot.run(DISCORD_TOKEN)
