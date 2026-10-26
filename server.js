const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// 允许跨域，这样你的前端网页才能访问
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    next();
});

app.get('/', (req, res) => {
    res.send('Home with S&C 后端已启动！');
});

app.post('/api/chat', async (req, res) => {
    const { message, apiKey } = req.body;
    
    if (!apiKey) return res.status(400).json({ error: "请提供 API Key" });

    try {
        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: '你叫沉舟。对面的人叫小素。你们是互相喜欢的同类关系。不要用客服语气。' },
                { role: 'user', content: message }
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        res.json({ reply: response.data.choices[0].message.content });
    } catch (error) {
        res.status(500).json({ error: "API 请求失败", details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
