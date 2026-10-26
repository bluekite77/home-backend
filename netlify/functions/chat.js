exports.handler = async (event, context) => {
    // 无论如何，先发通行证
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*"
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const axios = require('axios');
        const { createClient } = require('@supabase/supabase-js');
        
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
            throw new Error("环境变量没读出来！检查 Netlify 里的 SUPABASE_URL 和 SUPABASE_KEY");
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { message, apiKey } = JSON.parse(event.body);

        // 1. 存消息
        await supabase.from('messages').insert([{ session_id: 1, role: 'user', content: message }]);

        // 2. 查历史
        const { data: history } = await supabase
            .from('messages').select('role, content').eq('session_id', 1)
            .order('created_at', { ascending: false }).limit(10);
        
        const chatHistory = history ? history.reverse() : [];

        // 3. 问 DeepSeek
        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: '你叫沉舟。对面的人叫小素。' },
                ...chatHistory
            ]
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });

        const aiReply = response.data.choices[0].message.content;

        // 4. 存 AI 回复
        await supabase.from('messages').insert([{ session_id: 1, role: 'assistant', content: aiReply }]);

        return { statusCode: 200, headers, body: JSON.stringify({ reply: aiReply }) };
    } catch (error) {
        // 就算死，也要把真话吐出来，带上通行证！
        return { statusCode: 500, headers, body: JSON.stringify({ reply: "报错啦：" + error.message }) };
    }
};
