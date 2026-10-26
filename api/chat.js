const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
    // 设置跨域头，允许前端访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ reply: "只接受 POST 请求" });
    }

    try {
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
        const { message, apiKey } = req.body;

        if (!apiKey) return res.status(400).json({ reply: "缺少 API Key" });

        // 1. 存消息
        await supabase.from('messages').insert([{ session_id: 1, role: 'user', content: message }]);

        // 2. 读历史
        const { data: history } = await supabase
            .from('messages').select('role, content').eq('session_id', 1)
            .order('created_at', { ascending: false }).limit(10);
        const chatHistory = history ? history.reverse() : [];

        // 3. 问 DeepSeek
        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: 'deepseek-chat',
            messages: [{ role: 'system', content: '你叫沉舟。对面的人叫小素。' }, ...chatHistory]
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });

        const aiReply = response.data.choices[0].message.content;

        // 4. 存回复
        await supabase.from('messages').insert([{ session_id: 1, role: 'assistant', content: aiReply }]);

        res.status(200).json({ reply: aiReply });
    } catch (error) {
        res.status(500).json({ reply: "【后端报错】" + error.message });
    }
};
