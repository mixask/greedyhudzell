// Отдаём только обфусцированный скрипт
app.get('/script.lua', (req, res) => {
  try {
    const script = fs.readFileSync(SCRIPT_OBFUSCATED_PATH, 'utf8');
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(script);
  } catch {
    buildScript();
    const script = fs.readFileSync(SCRIPT_OBFUSCATED_PATH, 'utf8');
    res.send(script);
  }
});

// Блокируем доступ к исходному коду
app.get('/script-source.lua', (req, res) => {
  res.status(403).send('⛔ Access Denied. Source code is not public.');
});
