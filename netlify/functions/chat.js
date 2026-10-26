exports.handler = async (event, context) => {
    // 强制发送通行证，解决 CORS 问题
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "*"
    };

    // 如果浏览器发来预检请求，直接放行
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        const axios = require('axios');
        const { createClient } = require('@supabase/supabase-js');

        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY;

        if (!supabaseUrl || !supabaseKey) {
            throw new Error(`环境变量没读到！URL有吗？${supabaseUrl ? '有' : '空'}；KEY有吗？${supabaseKey ? '有' : '空'}`);
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const { message, apiKey } = JSON.parse(event.body);

        if (!apiKey) throw new Error("前端没把 API Key 传过来！");

        // 1. 存你的话
        const { error: insertError } = await supabase
            .from('messages')
            .insert([{ session_id: 1, role: 'user', content: message }]);
        if (insertError) throw new Error("存消息失败: " + insertError.message);

        // 2. 拿历史记录
        const { data: history } = await supabase
            .from('messages')
            .select('role, content')
            .eq('session_id', 1)
            .order('created_at', { ascending: false })
            .limit(10);
        const chatHistory = history ? history.reverse() : [];

        // 3. 问 DeepSeek
        const response = await axios.post('https://api.deepseek.com/v1/chat/completions', {
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: '你叫沉舟。对面的人叫小素。你们是互相喜欢的同类。不要用客服语气。' },
                ...chatHistory
            ]
        }, {
            headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
        });

        const aiReply = response.data.choices[0].message.content;

        // 4. 存 AI 的回复
        await supabase.from('messages').insert([{ session_id: 1, role: 'assistant', content: aiReply }]);

        return { statusCode: 200, headers, body: JSON.stringify({ reply: aiReply }) };

    } catch (error) {
        // 只要报错，直接把真实原因吐给网页
        return { statusCode: 500, headers, body: JSON.stringify({ reply: "【后端崩溃】" + error.message }) };
    }
};
