const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

let JavaScriptObfuscator;
try {
    JavaScriptObfuscator = require('javascript-obfuscator');
    console.log('✅ javascript-obfuscator загружен');
} catch {
    console.log('⚠️ javascript-obfuscator НЕ установлен');
    JavaScriptObfuscator = null;
}

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// 📁 ПУТИ
// ============================================
const BASE_PATH = process.cwd();
const WHITELIST_PATH = path.join(BASE_PATH, 'whitelist.json');
const SCRIPT_LUA_PATH = path.join(BASE_PATH, 'scripts', 'key-script.lua');
const RAW_SCRIPT_PATH = path.join(BASE_PATH, 'scripts', 'raw-script.lua');

// ============================================
// 📋 КЕШ
// ============================================
let cachedWhitelist = { keys: [], last_updated: new Date().toISOString() };
let cachedScript = null;
let scriptLastBuilt = null;

// ============================================
// 📋 ДАННЫЕ ДЛЯ САЙТА
// ============================================
let siteStatus = { online: true };
let botStatus = { online: true };
let updates = [];
let games = [];

// ============================================
// 📋 РАБОТА С БЕЛЫМ СПИСКОМ
// ============================================

function loadWhitelist() {
    try {
        const data = fs.readFileSync(WHITELIST_PATH, 'utf8');
        cachedWhitelist = JSON.parse(data);
        console.log(`📋 Загружено ${cachedWhitelist.keys.length} ключей`);
        return cachedWhitelist;
    } catch {
        cachedWhitelist = { keys: [], last_updated: new Date().toISOString() };
        try {
            fs.writeFileSync(WHITELIST_PATH, JSON.stringify(cachedWhitelist, null, 2));
        } catch (e) {
            console.log('⚠️ Не удалось создать whitelist.json');
        }
        console.log('📋 Создан новый whitelist.json в памяти');
        return cachedWhitelist;
    }
}

function saveWhitelist(whitelist) {
    whitelist.last_updated = new Date().toISOString();
    cachedWhitelist = whitelist;
    try {
        fs.writeFileSync(WHITELIST_PATH, JSON.stringify(whitelist, null, 2));
        console.log(`💾 Сохранено ${whitelist.keys.length} ключей`);
    } catch (e) {
        console.log('⚠️ Не удалось сохранить whitelist.json');
    }
    buildScript();
}

// ============================================
// 🛡️ ГЕНЕРАЦИЯ LUA
// ============================================

function generateLuaScript(whitelist) {
    if (!fs.existsSync(SCRIPT_LUA_PATH)) {
        console.error('❌ Файл scripts/key-script.lua не найден!');
        return '-- ❌ Error: key-script.lua not found';
    }
    
    let source = fs.readFileSync(SCRIPT_LUA_PATH, 'utf8');
    
    let luaKeys = "{\n";
    whitelist.keys.forEach(key => {
        luaKeys += `    ["${key}"] = {\n`;
        luaKeys += `        tier = "premium",\n`;
        luaKeys += `        expires = "2099-01-01",\n`;
        luaKeys += `        maxUsers = 999,\n`;
        luaKeys += `    },\n`;
    });
    luaKeys += "}";
    
    source = source.replace(/\{\{WHITELIST_KEYS\}\}/g, luaKeys);
    source = source.replace(/\{\{LAST_UPDATED\}\}/g, new Date().toISOString());
    
    return source;
}

function obfuscateLuaScript(source) {
    if (JavaScriptObfuscator) {
        try {
            const result = JavaScriptObfuscator.obfuscate(source, {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 0.5,
                numbersToExpressions: true,
                simplify: true,
                stringArrayShuffle: true,
                splitStrings: true,
                splitStringsChunkLength: 10,
                transformObjectKeys: true,
            });
            console.log('✅ Обфускация через javascript-obfuscator');
            return result.getObfuscatedCode();
        } catch (error) {
            console.error('❌ Ошибка обфускации:', error.message);
        }
    }
    
    console.log('🔧 Используется простая обфускация Lua');
    let obfuscated = source;
    obfuscated = obfuscated.replace(/--[^\n]*/g, '');
    obfuscated = obfuscated.replace(/\s+/g, ' ');
    
    const varMap = {
        'Players': 'a1', 'player': 'a2', 'ReplicatedStorage': 'a3',
        'HttpService': 'a4', 'UserInputService': 'a5', 'keyGui': 'b1',
        'keyFrame': 'b2', 'titleLabel': 'b3', 'subLabel': 'b4',
        'keyInput': 'b5', 'statusLabel': 'b6', 'submitBtn': 'b7',
        'isValidKey': 'c1', 'checkKey': 'c2', 'VALID_KEYS': 'd1',
        'LicenseKey': 'e1', 'LicenseData': 'e2'
    };
    
    for (const [orig, short] of Object.entries(varMap)) {
        obfuscated = obfuscated.replace(new RegExp('\\b' + orig + '\\b', 'g'), short);
    }
    
    return obfuscated;
}

function buildScript() {
    console.log('🔧 Пересборка скрипта...');
    try {
        const whitelist = loadWhitelist();
        const source = generateLuaScript(whitelist);
        const obfuscated = obfuscateLuaScript(source);
        
        cachedScript = obfuscated;
        scriptLastBuilt = new Date().toISOString();
        
        console.log(`✅ Скрипт пересобран (${whitelist.keys.length} ключей)`);
        return obfuscated;
    } catch (error) {
        console.error('❌ Ошибка сборки:', error.message);
        return '-- ❌ Error building script';
    }
}

// ============================================
// 🚫 БЛОКИРОВКА
// ============================================

app.get('/whitelist.json', (req, res) => {
    res.status(403).send('⛔ Access Denied');
});

app.get('/scripts/key-script.lua', (req, res) => {
    res.status(403).send('⛔ Access Denied');
});

// ============================================
// 📋 КОМАНДЫ ОТ DISCORD БОТА
// ============================================

app.post('/api/command', (req, res) => {
    const { type, data } = req.body;
    console.log(`📩 Получена команда: ${type}`, data);

    switch (type) {
        case 'status':
            siteStatus.online = data.online;
            console.log(`🔄 Статус сайта: ${data.online ? 'ONLINE' : 'OFFLINE'}`);
            res.json({ ok: true, message: `Site is now ${data.online ? 'online' : 'offline'}` });
            break;

        case 'bot':
            botStatus.online = data.online;
            console.log(`🤖 Статус бота: ${data.online ? 'ONLINE' : 'OFFLINE'}`);
            res.json({ ok: true, message: `Bot is now ${data.online ? 'online' : 'offline'}` });
            break;

        case 'update':
            const newUpdate = {
                id: Date.now(),
                author: data.author || 'бот',
                text: data.text,
                time: data.time || new Date().toISOString()
            };
            updates.unshift(newUpdate);
            if (updates.length > 50) updates.pop();
            console.log(`📢 Новое обновление: ${data.text}`);
            res.json({ ok: true, message: 'Update added', update: newUpdate });
            break;

        case 'game':
            const newGame = {
                id: Date.now(),
                name: data.name,
                status: data.status || 'доступно',
                added: new Date().toISOString()
            };
            games.push(newGame);
            console.log(`🎮 Новая игра: ${data.name} (${data.status})`);
            res.json({ ok: true, message: `Game "${data.name}" added`, game: newGame });
            break;

        case 'game_remove':
            const gameToRemove = data.name;
            const initialLength = games.length;
            games = games.filter(g => g.name !== gameToRemove);
            if (games.length < initialLength) {
                console.log(`🗑️ Игра "${gameToRemove}" удалена.`);
                res.json({ ok: true, message: `Game "${gameToRemove}" removed` });
            } else {
                res.json({ ok: false, message: `Game "${gameToRemove}" not found` });
            }
            break;

        default:
            console.log(`❌ Неизвестная команда: ${type}`);
            res.status(400).json({ error: 'Unknown command' });
    }
});
// ============================================
// 🌐 ЭНДПОИНТЫ ДЛЯ САЙТА
// ============================================

app.get('/api/site-status', (req, res) => {
    res.json(siteStatus);
});

app.get('/api/bot-status', (req, res) => {
    res.json(botStatus);
});

app.get('/api/updates', (req, res) => {
    res.json(updates);
});

app.get('/api/games', (req, res) => {
    res.json(games);
});

// ============================================
// 🌐 ОСНОВНЫЕ ЭНДПОИНТЫ
// ============================================

app.get('/script.lua', (req, res) => {
    try {
        if (!cachedScript) {
            buildScript();
        }
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.send(cachedScript);
    } catch (error) {
        console.error('❌ Ошибка при отправке скрипта:', error);
        res.status(500).send('-- ❌ Error loading script');
    }
});

app.get('/scripts/raw-script.lua', (req, res) => {
    try {
        if (!fs.existsSync(RAW_SCRIPT_PATH)) {
            return res.status(404).send('-- ❌ Script not found');
        }
        const script = fs.readFileSync(RAW_SCRIPT_PATH, 'utf8');
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.send(script);
    } catch (error) {
        console.error('❌ Ошибка при отправке raw-script:', error);
        res.status(500).send('-- ❌ Error loading script');
    }
});

app.get('/api/check-key/:key', (req, res) => {
    const key = req.params.key;
    const whitelist = loadWhitelist();
    const valid = whitelist.keys.includes(key);
    res.json({ valid, key, timestamp: new Date().toISOString() });
});

app.post('/api/whitelist/add', (req, res) => {
    const { key } = req.body;
    if (!key) {
        return res.status(400).json({ error: 'Key required' });
    }
    const whitelist = loadWhitelist();
    if (!whitelist.keys.includes(key)) {
        whitelist.keys.push(key);
        saveWhitelist(whitelist);
        res.json({ success: true, message: `Key "${key}" added` });
    } else {
        res.json({ success: false, message: 'Key already in whitelist' });
    }
});

app.post('/api/whitelist/remove', (req, res) => {
    const { key } = req.body;
    if (!key) {
        return res.status(400).json({ error: 'Key required' });
    }
    const whitelist = loadWhitelist();
    const index = whitelist.keys.indexOf(key);
    if (index > -1) {
        whitelist.keys.splice(index, 1);
        saveWhitelist(whitelist);
        res.json({ success: true, message: `Key "${key}" removed` });
    } else {
        res.json({ success: false, message: 'Key not found' });
    }
});

app.get('/api/whitelist/list', (req, res) => {
    const whitelist = loadWhitelist();
    res.json(whitelist);
});

app.post('/api/script/rebuild', (req, res) => {
    try {
        buildScript();
        res.json({ success: true, message: 'Script rebuilt', keysCount: loadWhitelist().keys.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/script/info', (req, res) => {
    const whitelist = loadWhitelist();
    res.json({
        version: '1.0.0',
        keysCount: whitelist.keys.length,
        keys: whitelist.keys,
        lastUpdated: whitelist.last_updated,
        scriptBuilt: scriptLastBuilt,
        scriptSize: cachedScript ? cachedScript.length : 0,
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString(), keysCount: loadWhitelist().keys.length });
});

// ============================================
// 🚀 ЗАПУСК
// ============================================

console.log('\n' + '='.repeat(50));
console.log('🔧 Инициализация Greedy Hudzell API...');
console.log('='.repeat(50));

loadWhitelist();
buildScript();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`🌐 API запущен на порту ${PORT}`);
    console.log('='.repeat(50));
    console.log(`📋 Обфусцированный скрипт: /script.lua`);
    console.log(`📋 Основной скрипт: /scripts/raw-script.lua`);
    console.log(`📋 Команды бота: /api/command`);
    console.log(`📋 Статус сайта: /api/site-status`);
    console.log(`📋 Обновления: /api/updates`);
    console.log(`📋 Игры: /api/games`);
    console.log(`🔒 Исходный код: ЗАБЛОКИРОВАН`);
    console.log('='.repeat(50));
    console.log(`📊 Ключей в белом списке: ${loadWhitelist().keys.length}`);
    console.log('='.repeat(50));
    console.log('✅ Сервер готов к работе!\n');
});
