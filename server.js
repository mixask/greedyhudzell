const express = require('express');
const app = express();
app.use(express.json());

app.get('/api/status', (req, res) => {
    res.json({ 
        status: "online", 
        version: "2.4.1", 
        game: "Parkour Legacy + Universal",
        users: 12400 
    });
});

app.post('/api/key/verify', (req, res) => {
    const { key } = req.body;
    if (key && key.startsWith('GH-')) {
        res.json({ valid: true, expires: "23 hours" });
    } else {
        res.json({ valid: false });
    }
});

app.listen(3000, () => {
    console.log('🚀 API running on http://localhost:3000 (subdomain: api.greedyhudzell.com)');
});