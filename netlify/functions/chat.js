const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

// 强制读取环境变量，如果读不到，就打印出来
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

exports.handler = async (event, context) => {
    // 无论如何，先给前端发个通行证，防止报 CORS 错
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        // 检查钥匙到底有没有拿到
        if (!supabaseUrl || !supabaseKey) {
            throw new Error(`环境变量没读出来！URL: ${supabaseUrl}, Key: ${supabaseKey ? '有' : '空'}`);
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { message, apiKey } = JSON.parse(event.body);

        // 1. 存你的消息
        const { error: insertError } = await supabase.from('messages').insert([
            { session_id: 1, role: 'user', content: message }
        ]);
        if (insertError) throw new Error("存消息失败: " + insertError.message);

        // 2. 查历史
        const { data: history, error: selectError } = await supabase
            .from('messages').select('role, content').eq('session_id', 1)
            .order('created_at', { ascending: false }).limit(10);
        if (selectError) throw new Error("查历史失败: " + selectError.message);

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

        // 4. 存AI的回复
        await supabase.from('messages').insert([
            { session_id: 1, role: 'assistant', content: aiReply }
        ]);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ reply: aiReply })
        };

    } catch (error) {
        // 如果上面任何一步崩了，直接把真话吐给前端
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ reply: "哎呀，小机报错了：" + error.message })
        };
    }
};
