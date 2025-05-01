const { Client } = require('whatsapp-web.js');
const axios = require('axios');
const fs = require('fs');

// إعداد العميل
const client = new Client();

// تخزين سياق الحديث
const conversations = {};
const CONVERSATION_FILE = 'conversations.json';

// تحميل المحادثات من ملف JSON إذا كان موجودًا
if (fs.existsSync(CONVERSATION_FILE)) {
    const data = fs.readFileSync(CONVERSATION_FILE);
    Object.assign(conversations, JSON.parse(data));
}

// دالة لحفظ المحادثات
function saveConversations() {
    fs.writeFileSync(CONVERSATION_FILE, JSON.stringify(conversations, null, 2));
}

// إعداد Hugging Face API
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY; // سيتم إضافته في متغيرات البيئة
const HUGGINGFACE_API_URL = 'https://api-inference.huggingface.co/models/facebook/blenderbot-400M-distill';

client.on('qr', (qr) => {
    console.log('امسح رمز QR:', qr);
});

client.on('ready', () => {
    console.log('البوت جاهز!');
});

client.on('message', async (msg) => {
    try {
        const userId = msg.from;
        const userMessage = msg.body;

        // تهيئة سياق المحادثة للمستخدم إذا لم يكن موجودًا
        if (!conversations[userId]) {
            conversations[userId] = [];
        }

        // إضافة رسالة المستخدم إلى السياق
        conversations[userId].push({ role: 'user', content: userMessage });

        // الحفاظ على آخر 5 رسائل فقط لتقليل استهلاك الموارد
        if (conversations[userId].length > 5) {
            conversations[userId].shift();
        }

        // إنشاء نص السياق لإرساله إلى Hugging Face
        const context = conversations[userId].map(msg => `${msg.role}: ${msg.content}`).join('\n');

        // إرسال الطلب إلى Hugging Face
        const response = await axios.post(HUGGINGFACE_API_URL, {
            inputs: context
        }, {
            headers: {
                Authorization: `Bearer ${HUGGINGFACE_API_KEY}`
            }
        });

        let reply = response.data[0]?.generated_text || 'عذرًا، لم أفهم. حاول مرة أخرى.';
        // تنظيف الرد إذا كان يحتوي على نص غير مرغوب
        reply = reply.split('\n').pop().trim();

        // إضافة رد البوت إلى السياق
        conversations[userId].push({ role: 'bot', content: reply });

        // حفظ المحادثات
        saveConversations();

        // إرسال الرد إلى المستخدم
        msg.reply(reply);
    } catch (error) {
        console.error('خطأ:', error.message);
        msg.reply('عذرًا، حدث خطأ. حاول مرة أخرى لاحقًا.');
    }
});

client.initialize();

