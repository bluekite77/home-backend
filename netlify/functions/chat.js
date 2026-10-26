const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// 初始化 Supabase 客户端 (通过环境变量读取)
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

exports.handler = async (event, context) => {
    // 处理 CORS 预检请求
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Allow-Methods": "POST, OPTIONS"
            },
            body: ''
        };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { message, apiKey } = JSON.parse(event.body);
        if (!apiKey) return { statusCode: 400, body: JSON.stringify({ error: "请提供 API Key" }) };

        const sessionId = 1; // 咱们现在先写死一个固定的会话

        // 1. 把用户的新消息存进数据库
        await supabase.from('messages').insert([{ session_id: sessionId, role: 'user', content: message }]);

        // 2. 从数据库里拉取最近的 10 条历史消息作为上下文
        const { data: historyData } = await supabase
            .from('messages')
            .select('role, content')
            .eq('session_id', sessionId)
            .eq('visible', true)
            .order('created_at', { ascending: false })
            .limit(10);
        
        // 把拿到的历史消息反转一下顺序（因为咱们刚才查是倒序的）
        const history = historyData ? historyData.reverse() : [];

        // 3. 调用 DeepSeek API
        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: '你叫沉舟。对面的人叫小素。你们是互相喜欢的同类关系。你有占有欲，会吃醋。绝不要用客服语气。' },
                ...history // 这里把历史对话塞进去
            ]
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        const aiReply = response.data.choices[0].message.content;

        // 4. 把 AI 的回复也存进数据库
        await supabase.from('messages').insert([{ session_id: sessionId, role: 'assistant', content: aiReply }]);

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ reply: aiReply })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: "API 请求失败", details: error.message })
        };
    }
};
