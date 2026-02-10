const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Замініть на ваш токен з BotFather
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || 'YOUR_BOT_TOKEN_HERE';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Зберігання користувачів (в продакшені краще використати БД)
let users = {};

// Розклад (знаменник)
const scheduleZnamennyk = {
  1: [ // Понеділок
    { number: '2', time: '10:05', subject: 'BigData', type: 'Лк' },
    { number: '3', time: '11:55', subject: 'BigData', type: 'Лб' }
  ],
  2: [ // Вівторок
    { number: '4', time: '13:25', subject: 'Кібербезпека в системах автоматизації', type: 'Лк' }
  ],
  3: [ // Середа
    { number: '1', time: '08:30', subject: 'Інноваційне підприємництво', type: 'Лк' },
    { number: '2', time: '10:05', subject: 'Інноваційне підприємництво', type: 'Пз' }
  ],
  4: [ // Четвер
    { number: '5', time: '14:55', subject: 'Кібербезпека в системах автоматизації', type: 'Лб' },
    { number: '~7', time: '18:00', subject: 'Сучасні технології виробництва', type: 'Лк' }
  ],
  5: [ // П'ятниця
    { number: '2', time: '10:05', subject: 'Сучасні технології виробництва', type: 'Лб' }
  ]
};

// Розклад (чисельник)
const scheduleChyselnyk = {
  1: [ // Понеділок
    { number: '1', time: '08:30', subject: 'Сучасні технології виробництва', type: 'Лб' },
    { number: '2', time: '10:05', subject: 'BigData', type: 'Лк' },
    { number: '3', time: '11:55', subject: 'BigData', type: 'Лб' }
  ],
  2: [ // Вівторок
    { number: '3', time: '11:55', subject: 'BigData', type: 'Лб' },
    { number: '4', time: '13:25', subject: 'Кібербезпека в системах автоматизації', type: 'Лк' },
    { number: '~7', time: '18:00', subject: 'Сучасні технології виробництва', type: 'Лк' }
  ],
  3: [ // Середа
    { number: '1', time: '08:30', subject: 'Інноваційне підприємництво', type: 'Лк' },
    { number: '2', time: '10:05', subject: 'Інноваційне підприємництво', type: 'Пз' }
  ],
  4: [ // Четвер
    { number: '5', time: '14:55', subject: 'Кібербезпека в системах автоматизації', type: 'Лб' }
  ],
  5: [] // П'ятниця - немає пар
};

// Визначення типу тижня
function getWeekType() {
  const znamennykWeeks = [
    { start: new Date('2025-02-09'), end: new Date('2025-02-15') },
    { start: new Date('2025-02-23'), end: new Date('2025-03-01') },
    { start: new Date('2025-03-09'), end: new Date('2025-03-15') },
    { start: new Date('2025-03-23'), end: new Date('2025-03-29') }
  ];
  
  const now = new Date();
  for (let week of znamennykWeeks) {
    if (now >= week.start && now <= week.end) {
      return 'znamennyk';
    }
  }
  return 'chyselnyk';
}

// Обробка команд бота
bot.onText(/\/start(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const params = match[1].trim();
  
  users[chatId] = {
    chatId: chatId,
    period: null,
    active: false
  };

  const keyboard = {
    inline_keyboard: [[
      { 
        text: '🌐 Перейти на сайт',
        url: `https://schedule-bk612.netlify.app/?chatId=${chatId}`
      }
    ]]
  };
  
  bot.sendMessage(chatId, 
    '🌸 Привіт! Я бот-помічник для розкладу БК-612!\n\n' +
    'Використовуй кнопки на сайті щоб налаштувати сповіщення, або введи команду:\n' +
    '/settings - Налаштування\n' +
    '/schedule - Подивитись розклад на сьогодні\n' +
    '/week - Подивитись який зараз тиждень' +
    'Натисни кнопку нижче, щоб налаштувати сповіщення на сайті:',
    { reply_markup: keyboard }
  );
});

bot.onText(/\/schedule/, (msg) => {
  const chatId = msg.chat.id;
  const weekType = getWeekType();
  const schedule = weekType === 'znamennyk' ? scheduleZnamennyk : scheduleChyselnyk;
  const dayOfWeek = new Date().getDay();
  
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    bot.sendMessage(chatId, '🌸 Сьогодні вихідний! Відпочивайте! 🌸');
    return;
  }
  
  const lessons = schedule[dayOfWeek] || [];
  
  if (lessons.length === 0) {
    bot.sendMessage(chatId, '🌸 Сьогодні пар немає! 🌸');
    return;
  }
  
  let message = `📚 Розклад на сьогодні (${weekType === 'znamennyk' ? 'ЗНАМЕННИК' : 'ЧИСЕЛЬНИК'}):\n\n`;
  lessons.forEach(lesson => {
    message += `${lesson.number}. ${lesson.time} - ${lesson.subject} [${lesson.type}]\n`;
  });
  
  bot.sendMessage(chatId, message);
});

bot.onText(/\/week/, (msg) => {
  const chatId = msg.chat.id;
  const weekType = getWeekType();
  bot.sendMessage(chatId, 
    `📅 Зараз тиждень: ${weekType === 'znamennyk' ? 'ЗНАМЕННИК 🟢' : 'ЧИСЕЛЬНИК 🔵'}`
  );
});

// API endpoint для активації з сайту
app.post('/api/activate', (req, res) => {
  const { chatId, period } = req.body;
  
  if (!chatId) {
    return res.status(400).json({ error: 'chatId is required' });
  }
  
  users[chatId] = {
    chatId: chatId,
    period: period || 'semester',
    active: true,
    startDate: new Date()
  };
  
  bot.sendMessage(chatId, 
    `✅ Сповіщення увімкнено!\n` +
    `Період: ${getPeriodName(period)}\n\n` +
    `Ти будеш отримувати нагадування за 5 хвилин до початку пари 🔔`
  );
  
  res.json({ success: true });
});

app.post('/api/deactivate', (req, res) => {
  const { chatId } = req.body;
  
  if (users[chatId]) {
    users[chatId].active = false;
    bot.sendMessage(chatId, '🔕 Сповіщення вимкнено');
  }
  
  res.json({ success: true });
});

function getPeriodName(period) {
  const names = {
    'week': 'Цей тиждень',
    '2weeks': '2 тижні',
    'month': 'Місяць',
    'semester': 'Весь семестр'
  };
  return names[period] || 'Весь семестр';
}

// Перевірка чи активний період
function isPeriodActive(user) {
  if (!user.period || user.period === 'semester') return true;
  
  const now = new Date();
  const startDate = new Date(user.startDate);
  const daysDiff = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
  
  switch (user.period) {
    case 'week': return daysDiff <= 7;
    case '2weeks': return daysDiff <= 14;
    case 'month': return daysDiff <= 30;
    default: return true;
  }
}

// Cron job - перевірка кожну хвилину
cron.schedule('* * * * *', () => {
  const now = new Date();
  const dayOfWeek = now.getDay();
  
  // Пропускаємо вихідні
  if (dayOfWeek === 0 || dayOfWeek === 6) return;
  
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const weekType = getWeekType();
  const schedule = weekType === 'znamennyk' ? scheduleZnamennyk : scheduleChyselnyk;
  const lessons = schedule[dayOfWeek] || [];
  
  lessons.forEach(lesson => {
    const [lessonHours, lessonMinutes] = lesson.time.split(':').map(Number);
    const lessonTime = lessonHours * 60 + lessonMinutes;
    const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
    
    // Сповіщення за 5 хвилин до пари
    if (lessonTime - currentTimeMinutes === 5) {
      Object.values(users).forEach(user => {
        if (user.active && isPeriodActive(user)) {
          bot.sendMessage(user.chatId, 
            `🔔 Нагадування!\n\n` +
            `Пара через 5 хвилин:\n` +
            `${lesson.number}. ${lesson.time}\n` +
            `${lesson.subject} [${lesson.type}]`
          );
        }
      });
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Bot is running...');

});

