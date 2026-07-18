const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

// Пытаемся загрузить обфускатор
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
// 📁 ПУТИ К ФАЙЛАМ
// ============================================
const WHITELIST_PATH = path.join(__dirname, '..', 'whitelist.json');
const SCRIPT_LUA_PATH = path.join(__dirname, '..', 'script.lua');

// ============================================
// 📋 РАБОТА С БЕЛЫМ СПИСКОМ
// ============================================

let cachedWhitelist = { keys: [], last_updated: new Date().toISOString() };
let cachedScript = null;
let scriptLastBuilt = null;

function loadWhitelist() {
    try {
        const data = fs.readFileSync(WHITELIST_PATH, 'utf8');
        cachedWhitelist = JSON.parse(data);
        return cachedWhitelist;
    } catch {
        cachedWhitelist = { keys: [], last_updated: new Date().toISOString() };
        fs.writeFileSync(WHITELIST_PATH, JSON.stringify(cachedWhitelist, null, 2));
        return cachedWhitelist;
    }
}

function saveWhitelist(whitelist) {
    whitelist.last_updated = new Date().toISOString();
    cachedWhitelist = whitelist;
    fs.writeFileSync(WHITELIST_PATH, JSON.stringify(whitelist, null, 2));
    buildScript();
}

// ============================================
// 🛡️ ГЕНЕРАЦИЯ И ОБФУСКАЦИЯ
// ============================================

function generateLuaScript(whitelist) {
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
    
    source = source.replace('{{WHITELIST_KEYS}}', luaKeys);
    source = source.replace('{{LAST_UPDATED}}', new Date().toISOString());
    
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
            return result.getObfuscatedCode();
        } catch (error) {
            console.error('❌ Ошибка обфускации:', error.message);
        }
    }
    
    // Простая обфускация
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
    const whitelist = loadWhitelist();
    const source = generateLuaScript(whitelist);
    const obfuscated = obfuscateLuaScript(source);
    
    cachedScript = obfuscated;
    scriptLastBuilt = new Date().toISOString();
    
    console.log(`✅ Скрипт пересобран (${whitelist.keys.length} ключей)`);
    return obfuscated;
}

// ============================================
// 🚫 БЛОКИРОВКА ДОСТУПА
// ============================================

app.get('/whitelist.json', (req, res) => {
    res.status(403).send('⛔ Access Denied');
});

app.get('/script-source.lua', (req, res) => {
    res.status(403).send('⛔ Access Denied');
});

// ============================================
// 🌐 ОСНОВНОЙ ЭНДПОИНТ — СЫРОЙ LUA КОД
// ============================================

app.get('/script.lua', (req, res) => {
    try {
        if (!cachedScript) {
            buildScript();
        }
        
        // Устанавливаем заголовки для сырого текста
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('X-Script-Version', scriptLastBuilt || 'unknown');
        res.setHeader('X-Content-Type-Options', 'nosniff');
        
        // Отправляем сырой Lua код
        res.send(cachedScript);
    } catch (error) {
        res.status(500).send('-- ❌ Error loading script');
    }
});

// ============================================
// 🔧 API ЭНДПОИНТЫ (для Discord бота)
// ============================================

app.get('/api/check-key/:key', (req, res) => {
    const key = req.params.key;
    const whitelist = loadWhitelist();
    const valid = whitelist.keys.includes(key);
    res.json({ valid, key, timestamp: new Date().toISOString() });
});

app.post('/api/whitelist/add', (req, res) => {
    const { key } = req.body;
    if (!key) return res.status(400).json({ error: 'Key required' });
    
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
    if (!key) return res.status(400).json({ error: 'Key required' });
    
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
    res.json(loadWhitelist());
});

app.post('/api/script/rebuild', (req, res) => {
    try {
        buildScript();
        res.json({ success: true, message: 'Script rebuilt' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// 🚀 ЗАПУСК
// ============================================

loadWhitelist();
buildScript();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🌐 API запущен на http://localhost:${PORT}`);
    console.log(`${'='.repeat(50)}`);
    console.log(`📋 RAW Lua скрипт: http://localhost:${PORT}/script.lua`);
    console.log(`🔒 Исходный код: ЗАБЛОКИРОВАН`);
    console.log(`🔒 whitelist.json: ЗАБЛОКИРОВАН`);
    console.log(`${'='.repeat(50)}`);
    console.log(`📊 Ключей в белом списке: ${loadWhitelist().keys.length}`);
    console.log(`${'='.repeat(50)}\n`);
});
