const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Токен (на Railway він береться з змінних середовища)
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || '8356992046:AAGR7RF10nc1gUx431OsMsiHhz-qQHuzadI';
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

// Зберігання користувачів
// Примітка: При перезапуску сервера на Railway цей об'єкт очиститься.
// Для стабільної роботи краще підключити MongoDB або Redis, але для старту цього вистачить.
let users = {};

// --- 1. Оновлена структура розкладу з посиланнями ---
// Заповніть реальні посилання та паролі
const scheduleZnamennyk = {
  1: [ // Понеділок
    { 
      number: '2', time: '10:05', subject: 'BigData', type: 'Лк',
      link: 'https://meet.google.com/ins-srkc-wyy', meetingId: '', pass: ''
    },
    { 
      number: '3', time: '11:55', subject: 'BigData', type: 'Лб',
      link: 'https://meet.google.com/ipg-mmaj-hvn', meetingId: '', pass: ''
    }
  ],
  2: [ // Вівторок
    { 
      number: '4', time: '13:25', subject: 'Кібербезпека в системах автоматизації', type: 'Лк',
      link: '', meetingId: '341 249 2658', pass: '777-777' 
    }
  ],
  3: [ // Середа
    { number: '1', time: '08:30', subject: 'Інноваційне підприємництво', type: 'Лк', link: 'https://us05web.zoom.us/j/7842565658?pwd=UEl3aUN1ZUNnOGxWSis0b2M2cy85UT09', meetingId: '', pass: '' },
    { number: '2', time: '10:05', subject: 'Інноваційне підприємництво', type: 'Пз', link: 'https://us05web.zoom.us/j/7842565658?pwd=UEl3aUN1ZUNnOGxWSis0b2M2cy85UT09', meetingId: '', pass: '' }
  ],
  4: [ // Четвер
    { number: '5', time: '14:55', subject: 'Кібербезпека в системах автоматизації', type: 'Лб', link: '', meetingId: '341 249 2658', pass: '777-777' },
    { number: '~7', time: '18:00', subject: 'Сучасні технології виробництва', type: 'Лк', link: 'https://us05web.zoom.us/j/81099898775?pwd=lJYUYCaUkywPSSN6uHTdLzLseZW6tH.1', meetingId: '810 9989 8775', pass: '111' }
  ],
  5: [ // П'ятниця
    { number: '2', time: '10:05', subject: 'Сучасні технології виробництва', type: 'Лб', link: 'https://us02web.zoom.us/j/83727277825', meetingId: '', pass: '2026' }
  ]
};

const scheduleChyselnyk = {
  1: [ // Понеділок
    { number: '1', time: '08:30', subject: 'Сучасні технології виробництва', type: 'Лб', link: 'https://us02web.zoom.us/j/83727277825', meetingId: '', pass: '2026' },
    { number: '2', time: '10:05', subject: 'BigData', type: 'Лк', link: 'https://meet.google.com/ins-srkc-wyy', meetingId: '', pass: '' },
    { number: '3', time: '11:55', subject: 'BigData', type: 'Лб', link: 'https://meet.google.com/ipg-mmaj-hvn', meetingId: '', pass: '' }
  ],
  2: [ // Вівторок
    { number: '3', time: '11:55', subject: 'BigData', type: 'Лб', link: 'https://meet.google.com/ipg-mmaj-hvn', meetingId: '', pass: '' },
    { number: '4', time: '13:25', subject: 'Кібербезпека в системах автоматизації', type: 'Лк', link: '', meetingId: '341 249 2658', pass: '777-777' },
    { number: '~7', time: '18:00', subject: 'Сучасні технології виробництва', type: 'Лк', link: 'https://us05web.zoom.us/j/82923069384?pwd=uC64fLc8wX8N76lRHRRDP7cdxbK4z6.1', meetingId: '829 2306 9384', pass: '111' }
  ],
  3: [ // Середа
    { number: '1', time: '08:30', subject: 'Інноваційне підприємництво', type: 'Лк', link: 'https://us05web.zoom.us/j/7842565658?pwd=UEl3aUN1ZUNnOGxWSis0b2M2cy85UT09', meetingId: '', pass: '' },
    { number: '2', time: '10:05', subject: 'Інноваційне підприємництво', type: 'Пз', link: 'https://us05web.zoom.us/j/7842565658?pwd=UEl3aUN1ZUNnOGxWSis0b2M2cy85UT09', meetingId: '', pass: '' }
  ],
  4: [ // Четвер
    { number: '5', time: '14:55', subject: 'Кібербезпека в системах автоматизації', type: 'Лб', link: '', meetingId: '341 249 2658', pass: '777-777' }
  ],
  5: [] // П'ятниця
};

// --- Допоміжна функція часу (Київ) ---
function getKyivTime() {
    return new Date(new Date().toLocaleString("en-US", {timeZone: "Europe/Kiev"}));
}

// --- 2. Виправлена логіка тижнів ---
function getWeekType() {
  // Встановлюємо дату початку семестру (або будь-який понеділок, який точно є Чисельником)
  // Припустимо, що 2 лютого 2025 був Чисельник (1-й тиждень)
  const semesterStart = new Date('2025-02-02T00:00:00'); 
  const now = getKyivTime();
  
  // Різниця в часі в мілісекундах
  const diffTime = Math.abs(now - semesterStart);
  // Переводимо в дні
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  // Рахуємо номер тижня
  const weekNumber = Math.ceil(diffDays / 7);

  // Якщо тиждень непарний (1, 3, 5) -> Чисельник
  // Якщо тиждень парний (2, 4, 6) -> Знаменник
  // Ви можете змінити return місцями, якщо все одно не сходиться
  return (weekNumber % 2 === 0) ? 'znamennyk' : 'chyselnyk';
}

// Функція формування красивого повідомлення
function formatLessonMessage(lesson, header = '') {
    let msg = header ? `${header}\n\n` : '';
    msg += `🕒 <b>${lesson.time}</b> | Пара №${lesson.number}\n`;
    msg += `📚 <b>${lesson.subject}</b> [${lesson.type}]\n`;
    
    if (lesson.link) {
        msg += `\n🔗 <a href="${lesson.link}">ПРИЄДНАТИСЬ ДО ПАРИ</a>`;
    }
    
    if (lesson.meetingId) {
        msg += `\n🆔 ID: <code>${lesson.meetingId}</code>`;
    }
    if (lesson.pass) {
        msg += `\n🔑 Pass: <code>${lesson.pass}</code>`;
    }
    
    return msg;
}

// --- Обробка команд ---

bot.onText(/\/start(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  
  // Ініціалізуємо користувача, якщо його немає
  if (!users[chatId]) {
      users[chatId] = { chatId: chatId, active: true, period: 'semester' };
  }

  const keyboard = {
    inline_keyboard: [[
      { text: '🌐 Перейти на сайт', url: `https://schedule-bk612.netlify.app/?chatId=${chatId}` }
    ]]
  };
  
  bot.sendMessage(chatId, 
    '🌸 Привіт! Я бот-помічник для розкладу БК-612!\n\n' +
    'Список команд:\n' +
    '/schedule - Розклад на сьогодні\n' +
    '/week - Який зараз тиждень\n' +
    '/settings - Налаштування сповіщень\n' +
    '/today_notification - Тест: показати сповіщення за сьогодні\n\n' +
    'Натисни кнопку нижче для налаштування через сайт:',
    { reply_markup: keyboard }
  );
});

// --- 3. Реалізація команди /settings ---
bot.onText(/\/settings/, (msg) => {
    const chatId = msg.chat.id;
    const user = users[chatId] || { active: false };
    
    const status = user.active ? '✅ УВІМКНЕНО' : '🔕 ВИМКНЕНО';
    
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [{ text: user.active ? '🔕 Вимкнути' : '🔔 Увімкнути', callback_data: 'toggle_notify' }]
            ]
        }
    };
    
    bot.sendMessage(chatId, `Налаштування сповіщень:\nСтатус: ${status}`, opts);
});

// Обробка кнопок налаштувань
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    
    if (query.data === 'toggle_notify') {
        if (!users[chatId]) users[chatId] = { chatId, active: false };
        
        users[chatId].active = !users[chatId].active;
        const newStatus = users[chatId].active ? '✅ УВІМКНЕНО' : '🔕 ВИМКНЕНО';
        
        // Оновлюємо повідомлення
        bot.editMessageText(`Налаштування сповіщень:\nСтатус: ${newStatus}`, {
            chat_id: chatId,
            message_id: query.message.message_id,
            reply_markup: {
                inline_keyboard: [
                    [{ text: users[chatId].active ? '🔕 Вимкнути' : '🔔 Увімкнути', callback_data: 'toggle_notify' }]
                ]
            }
        });
    }
});

bot.onText(/\/schedule/, (msg) => {
  const chatId = msg.chat.id;
  const weekType = getWeekType();
  const schedule = weekType === 'znamennyk' ? scheduleZnamennyk : scheduleChyselnyk;
  const now = getKyivTime();
  const dayOfWeek = now.getDay();
  
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    bot.sendMessage(chatId, '🌸 Сьогодні вихідний! Відпочивайте! 🌸');
    return;
  }
  
  const lessons = schedule[dayOfWeek] || [];
  
  if (lessons.length === 0) {
    bot.sendMessage(chatId, '🌸 Сьогодні пар немає! 🌸');
    return;
  }
  
  let message = `📚 <b>Розклад на сьогодні</b>\n(${weekType === 'znamennyk' ? 'ЗНАМЕННИК' : 'ЧИСЕЛЬНИК'})\n\n`;
  lessons.forEach(lesson => {
    message += `${lesson.number}. ${lesson.time} - ${lesson.subject} [${lesson.type}]\n`;
    if(lesson.link) message += `   🔗 <a href="${lesson.link}">Посилання</a>\n`;
  });
  
  bot.sendMessage(chatId, message, { parse_mode: 'HTML', disable_web_page_preview: true });
});

bot.onText(/\/week/, (msg) => {
  const weekType = getWeekType();
  bot.sendMessage(msg.chat.id, 
    `📅 Зараз тиждень: <b>${weekType === 'znamennyk' ? 'ЗНАМЕННИК 🟢' : 'ЧИСЕЛЬНИК 🔵'}</b>`,
    { parse_mode: 'HTML' }
  );
});

// --- 4. Тестова команда /today_notification ---
bot.onText(/\/today_notification/, (msg) => {
    const chatId = msg.chat.id;
    const weekType = getWeekType();
    const schedule = weekType === 'znamennyk' ? scheduleZnamennyk : scheduleChyselnyk;
    const now = getKyivTime();
    const dayOfWeek = now.getDay(); // 0-Sun, 1-Mon...

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return bot.sendMessage(chatId, 'Сьогодні вихідний, пар немає для тесту.');
    }

    const lessons = schedule[dayOfWeek] || [];
    if (lessons.length === 0) {
        return bot.sendMessage(chatId, 'Сьогодні пар немає.');
    }

    bot.sendMessage(chatId, '🛠 <b>Тестовий режим:</b> Ось як будуть виглядати сповіщення сьогодні:', {parse_mode: 'HTML'});

    lessons.forEach(lesson => {
        const message = formatLessonMessage(lesson, '🔔 <b>Нагадування (ТЕСТ)!</b>');
        bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    });
});

// API endpoint для сайту
app.post('/api/activate', (req, res) => {
  const { chatId, period } = req.body;
  if (!chatId) return res.status(400).json({ error: 'chatId required' });
  
  users[chatId] = {
    chatId: chatId,
    period: period || 'semester',
    active: true,
    startDate: new Date()
  };
  
  bot.sendMessage(chatId, '✅ Сповіщення активовано через сайт!');
  res.json({ success: true });
});

// --- CRON JOB ---
cron.schedule('* * * * *', () => {
  const now = getKyivTime(); // Використовуємо час Києва
  const dayOfWeek = now.getDay();
  
  if (dayOfWeek === 0 || dayOfWeek === 6) return;
  
  const weekType = getWeekType();
  const schedule = weekType === 'znamennyk' ? scheduleZnamennyk : scheduleChyselnyk;
  const lessons = schedule[dayOfWeek] || [];
  
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeTotal = currentHours * 60 + currentMinutes;

  lessons.forEach(lesson => {
    const [lh, lm] = lesson.time.split(':').map(Number);
    const lessonTimeTotal = lh * 60 + lm;
    
    // Перевірка: за 5 хвилин до пари
    if (lessonTimeTotal - currentTimeTotal === 5) {
      Object.values(users).forEach(user => {
        if (user.active) {
            // Тут можна додати перевірку isPeriodActive(user), якщо потрібно
            const msg = formatLessonMessage(lesson, '🔔 <b>Пара через 5 хвилин!</b>');
            bot.sendMessage(user.chatId, msg, { parse_mode: 'HTML' });
        }
      });
    }
  });
});


// Головна сторінка для перевірки сервера
app.get('/', (req, res) => {
  res.send('✅ Сервер розкладу БК-612 працює! Бот активний.');
});

// Тестовий маршрут для перевірки часу
app.get('/api/test-time', (req, res) => {
  const now = new Date();
  const kyivTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Kiev"}));
  res.json({
    utc_time: now.toISOString(),
    kyiv_time: kyivTime.toString(),
    week_type: getWeekType()
  });
});
// udoli

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

