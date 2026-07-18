// ============================================
// 🚀 GREEDY HUDZELL — CLOUDFLARE WORKER
// ============================================

// Белый список ключей (хранится в переменной окружения)
// В панели Cloudflare добавь переменную WHITELIST_KEYS = ["key1","key2"]
const WHITELIST_KEYS = JSON.parse(WHITELIST_KEYS || '[]');

// Шаблон key-script.lua (загружается из assets)
// В корне проекта должен лежать файл key-script.lua

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ============================================
    // 📋 БЕЛЫЙ СПИСОК (из env)
    // ============================================
    const whitelist = {
      keys: JSON.parse(env.WHITELIST_KEYS || '[]'),
      last_updated: new Date().toISOString()
    };

    // ============================================
    // 🛡️ ГЕНЕРАЦИЯ LUA СКРИПТА
    // ============================================
    function generateLuaScript(keys) {
      let luaKeys = "{\n";
      keys.forEach(key => {
        luaKeys += `    ["${key}"] = {\n`;
        luaKeys += `        tier = "premium",\n`;
        luaKeys += `        expires = "2099-01-01",\n`;
        luaKeys += `        maxUsers = 999,\n`;
        luaKeys += `    },\n`;
      });
      luaKeys += "}";
      
      // Загружаем шаблон из assets
      // В Cloudflare нужно загрузить key-script.lua как статический файл
      // или захардкодить его здесь
      let source = `-- 🔐 Greedy Hudzell Key System\n-- 📅 ${new Date().toISOString()}\n\nlocal VALID_KEYS = ${luaKeys}\n\n-- ... (остальной код)`;
      
      return source;
    }

    // ============================================
    // 🌐 ОСНОВНЫЕ ЭНДПОИНТЫ
    // ============================================

    // --- 1. Сырой Lua скрипт ---
    if (path === '/script.lua') {
      const script = generateLuaScript(whitelist.keys);
      return new Response(script, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      });
    }

    // --- 2. Основной скрипт (raw-script.lua) ---
    if (path === '/scripts/raw-script.lua') {
      try {
        // Пытаемся загрузить из assets
        const script = await env.ASSETS.fetch(request);
        return new Response(script.body, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        });
      } catch {
        return new Response('-- ❌ Script not found', { status: 404 });
      }
    }

    // --- 3. Проверка ключа ---
    if (path.startsWith('/api/check-key/')) {
      const key = path.split('/').pop();
      const valid = whitelist.keys.includes(key);
      return new Response(JSON.stringify({ valid, key, timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // --- 4. Добавить ключ (только POST) ---
    if (path === '/api/whitelist/add' && request.method === 'POST') {
      // В Workers нельзя изменить env напрямую
      // Нужно использовать KV Storage или D1
      return new Response(JSON.stringify({ error: 'Use Discord bot to add keys' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // --- 5. Список ключей (только для бота) ---
    if (path === '/api/whitelist/list') {
      // Проверяем токен в заголовке
      const auth = request.headers.get('Authorization');
      if (auth !== `Bearer ${env.BOT_TOKEN}`) {
        return new Response('⛔ Unauthorized', { status: 403 });
      }
      return new Response(JSON.stringify(whitelist), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // --- 6. Информация о скрипте ---
    if (path === '/api/script/info') {
      return new Response(JSON.stringify({
        version: '1.0.0',
        keysCount: whitelist.keys.length,
        lastUpdated: whitelist.last_updated,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // --- 7. Блокировка доступа к whitelist.json ---
    if (path === '/whitelist.json') {
      return new Response('⛔ Access Denied', { status: 403 });
    }

    // --- 8. Блокировка доступа к исходному скрипту ---
    if (path === '/script-source.lua') {
      return new Response('⛔ Access Denied', { status: 403 });
    }

    // --- 9. Остальные запросы → статика ---
    return env.ASSETS.fetch(request);
  }
};
