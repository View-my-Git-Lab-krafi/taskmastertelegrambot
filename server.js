require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();
const OpenAI = require('openai'); 
const fetch = require('node-fetch'); 

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'your_secret_key', resave: false, saveUninitialized: true }));


const fs = require('fs');
const db = new sqlite3.Database('./deadlines.db');
const path = require('path');

const { exec } = require('child_process');

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html')); 
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS deadlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    title TEXT,
    date TEXT
  )`);
});
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
  baseURL: 'https://integrate.api.nvidia.com/v1',
});
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const chatId = process.env.CHAT_ID; 
const adminIds = process.env.ADMIN_IDS.split(',').map(id => id.trim()); 

function isAdmin(userId) {
  return adminIds.includes(userId.toString());
}

function adjustToMoscowTime(date) {
  return new Date(date.getTime() + 5 * 60 * 60 * 1000);
}


const allowedGroupIds = process.env.ALLOWED_GROUP_IDS.split(',').map(id => id.trim());

function isAllowedGroup(chatId) {
  return allowedGroupIds.includes(chatId.toString());
}

bot.onText(/\/bria (.+)/, async (msg, match) => {
  const userPrompt = match[1];
  const chatId = msg.chat.id;

  if (!isAllowedGroup(chatId)) {
    return bot.sendMessage(chatId, 'Этот бот не предназначен для использования в этой группе.');
  }
  const username = msg.from.username || msg.from.first_name || 'Пользователь';

  if (!userPrompt) {
    return bot.sendMessage(chatId, 'Пожалуйста, введите описание для генерации изображения.');
  }

  const payload = {
    "prompt": userPrompt,
    "cfg_scale": 5,
    "aspect_ratio": "1:1",
    "seed": 0,
    "steps": 30,
    "negative_prompt": ""
  };

  try {
    const response = await fetch("https://ai.api.nvidia.com/v1/genai/briaai/bria-2.3", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errBody = await response.text();
      throw new Error(`Ошибка: ${response.status} ${errBody}`);
    }

    const responseBody = await response.json();
    
    const imageBase64 = responseBody.image;
    if (!imageBase64) {
      throw new Error('Ошибка, krafi.info');
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');

    bot.sendPhoto(chatId, imageBuffer, {
      caption: `@${username}, вот ваше изображение на основе запроса: "${userPrompt}"`
    });
  } catch (error) {
    console.error('Error generating image:', error);
    bot.sendMessage(chatId, `@${username}, произошла ошибка при генерации изображения. Попробуйте позже.`);
  }
});


bot.onText(/\/ai (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  const userQuery = match[1]; 
  const chatId = msg.chat.id;

  if (!isAllowedGroup(chatId)) {
    return bot.sendMessage(chatId, 'Этот бот не предназначен для использования в этой группе.');
  }
  if (!userQuery) {
    return bot.sendMessage(msg.chat.id, 'Вы учитель информатики. /ai.');
  }

  const username = msg.from.username || msg.from.first_name || 'Пользователь';

  try {
    const completion = await openai.chat.completions.create({
      model: "meta/llama-3.1-405b-instruct",
      messages: [
        { "role": "system", "content": "Вы специалист по компьютерным наукам" },
        { "role": "user", "content": userQuery }
      ],
      temperature: 0.9,
      top_p: 0.2,
      max_tokens: 180,
      stream: false, 
    });

    const botResponse = completion.choices[0].message.content;

    bot.sendMessage(msg.chat.id, `ребята ,${username} ${botResponse}`, {
      reply_to_message_id: msg.message_id 
    });
  } catch (error) {
    bot.sendMessage(msg.chat.id, `${username}, произошла ошибка. Попробуйте позже.`, {
      reply_to_message_id: msg.message_id
    });
    console.error('Error interacting with Llama 3:', error);
  }
});

bot.onText(/\/bigai (.+)/, async (msg, match) => {
  const userId = msg.from.id;
  const userQuery = match[1];
  const chatId = msg.chat.id;

  if (!isAllowedGroup(chatId)) {
    return bot.sendMessage(chatId, 'Этот бот не предназначен для использования в этой группе.');
  }
  if (!userQuery) {
    return bot.sendMessage(msg.chat.id, 'Пожалуйста, введите вопрос после команды /ai.');
  }

  const username = msg.from.username || msg.from.first_name || 'Пользователь';

  try {
    const completion = await openai.chat.completions.create({
      model: "meta/llama-3.1-405b-instruct",
      messages: [
        { "role": "system", "content": "Вы объясняете вещи легко и с удовольствием, используя примеры из реальной жизни." },
        { "role": "user", "content": userQuery }
      ],
      temperature: 0.2,
      top_p: 0.7,
      max_tokens: 1024,
      stream: false,
    });

    const botResponse = completion.choices[0].message.content;
    bot.sendMessage(msg.chat.id, `@${username} ${botResponse}`, {
      reply_to_message_id: msg.message_id
    });
  } catch (error) {
    bot.sendMessage(msg.chat.id, 'Ошибка. www.krafi.info', {
      reply_to_message_id: msg.message_id
    });
    console.error('Error interacting with Llama 3:', error);
  }
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;

  if (!isAllowedGroup(chatId)) {
    return bot.sendMessage(chatId, 'Этот бот не предназначен для использования в этой группе.');
  }
  // If the message is a command (starts with '/'), do not process in this handler
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }

  if (!msg.text || /^[.]+$/.test(msg.text) || msg.photo || msg.video || msg.document || msg.sticker || msg.animation || msg.voice || msg.audio) {
    return;
  }

  if (msg.reply_to_message && msg.reply_to_message.from.is_bot) {
    const userMessage = msg.text;
    const username = msg.from.username || msg.from.first_name || 'Пользователь';

    try {
      const completion = await openai.chat.completions.create({
        model: "meta/llama-3.1-405b-instruct",
        messages: [
          { "role": "system", "content": "Вы специалист по компьютерным наукам" },
          { "role": "user", "content": userMessage }
        ],
        temperature: 0.9,
        top_p: 0.2,
        max_tokens: 150,
        stream: false,
      });

      const botResponse = completion.choices[0].message.content;
      bot.sendMessage(msg.chat.id, `@${username} ${botResponse}`, {
        reply_to_message_id: msg.message_id
      });
    } catch (error) {
      bot.sendMessage(msg.chat.id, 'Ошибка, krafi.info ', {
        reply_to_message_id: msg.message_id
      });
      console.error('Error interacting with Llama 3.1:', error);
    }
  }
});

bot.onText(/\/del/, (msg) => {
  const chatId = msg.chat.id;

  if (!isAllowedGroup(chatId)) {
    return bot.sendMessage(chatId, 'Этот бот не предназначен для использования в этой группе.');
  }

  if (msg.reply_to_message) {
    const messageId = msg.reply_to_message.message_id;

    bot.deleteMessage(chatId, messageId)
      .then(() => {
      })
      .catch((error) => {
        console.error('Ошибка удаления сообщения:', error);
        bot.sendMessage(chatId, 'Не удалось удалить сообщение.');
      });
  } else {
    bot.sendMessage(chatId, 'Эта команда должна быть ответом на сообщение, которое вы хотите удалить.');
  }
});



bot.onText(/\/translate (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  if (!isAllowedGroup(chatId)) {
    return bot.sendMessage(chatId, 'Этот бот не предназначен для использования в этой группе.');
  }
  const userQuery = match[1]; 
  const username = msg.from.username || msg.from.first_name || 'Пользователь';

  if (!userQuery) {
    return bot.sendMessage(msg.chat.id, 'Пожалуйста, введите текст для перевода.');
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "meta/llama-3.1-405b-instruct",
      messages: [
        { "role": "system", "content": "Вы экспертный переводчик с русского языка. Не нужно объяснять грамматику. Вы можете переводить любой язык на русский." },
        { "role": "user", "content": `Переведите следующий текст на русский, сохраняя его значение таким, какое оно есть. : "${userQuery}"` }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      stream: false,
    });

    const botResponse = completion.choices[0].message.content;
    bot.sendMessage(msg.chat.id, `@${username} ${botResponse}`, {
      reply_to_message_id: msg.message_id
    });
  } catch (error) {
    bot.sendMessage(msg.chat.id, 'Ошибка, krafi.info', {
      reply_to_message_id: msg.message_id
    });
    console.error('Error translating the text:', error);
  }
});

bot.onText(/\/help/, (msg) => {
  const helpMessage = `
Привет! Вот список команд, которые вы можете использовать:

1. **/add <название> <дата в формате "YYYY-MM-DD HH:MM">** - Добавить дедлайн. Например: /add Проект 2024-10-12 18:00
2. **/modify <id> <новое название> <новая дата в формате "YYYY-MM-DD HH:MM">** - Изменить дедлайн. Например: /modify 1 Новое название 2024-10-15 18:00
3. **/rm <id>** - Удалить дедлайн. Например: /rm 1
4. **/lt** - Показать задачи за последние 10 дней.
5. **/ut** - Показать предстоящие задачи на следующие 10 дней.
6. **/ai <вопрос>** - Получить ответ на вопрос с помощью искусственного интеллекта.
7. **/bigai <вопрос>** - Получить более детализированный ответ с использованием искусственного интеллекта.
8. **/translate <текст>** - Перевести любой текст на русский язык.
9. **/bria <описание>** - Сгенерировать изображение по описанию.
10. **/del** - Удалить сообщение (ответ на сообщение).
11. **/help** - Показать это сообщение с инструкциями.

Пожалуйста, не используйте /bigai без причины, иначе групповая беседа превратится в мусор.  
Только администраторы могут добавлять, изменять или удалять дедлайны.

www.krafi.info email@krafi.info
  `;
  bot.sendMessage(msg.chat.id, helpMessage);
});



bot.onText(/\/add (.+) (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/, (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (!isAllowedGroup(chatId)) {
    return bot.sendMessage(chatId, 'Этот бот не предназначен для использования в этой группе.');
  }
  if (!isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, 'У вас нет прав на выполнение этой команды.');
  }

  if (!match || match.length < 3) {
    return bot.sendMessage(msg.chat.id, 'Неверный формат. Используйте команду: /add <название> <дата в формате "YYYY-MM-DD HH:MM">.');
  }

  const title = match[1];
  let date = new Date(match[2]);
  date = adjustToMoscowTime(date); //reducing 5 hours

  if (isNaN(date.getTime())) {
    return bot.sendMessage(msg.chat.id, 'Неверный формат даты. Используйте "YYYY-MM-DD HH:MM".');
  }

  const stmt = db.prepare('INSERT INTO deadlines (userId, title, date) VALUES (?, ?, ?)');
  stmt.run(userId, title, date.toISOString(), function(err) {
    if (err) {
      return bot.sendMessage(msg.chat.id, 'Ошибка, krafi.info');
    }
    bot.sendMessage(msg.chat.id, `Дедлайн добавлен: ${title} на ${date.toLocaleString('ru-RU')}`);
  });
  stmt.finalize();
});

bot.onText(/\/modify (\d+) (.+) (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/, (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (!isAllowedGroup(chatId)) {
    return bot.sendMessage(chatId, 'Этот бот не предназначен для использования в этой группе.');
  }
  if (!isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, 'У вас нет прав на выполнение этой команды.');
  }

  if (!match || match.length < 4) {
    return bot.sendMessage(msg.chat.id, 'Неверный формат. Используйте команду: /modify <id> <новое название> <новая дата в формате "YYYY-MM-DD HH:MM">.');
  }

  const id = match[1];
  const newTitle = match[2];
  let newDate = new Date(match[3]);
  newDate = adjustToMoscowTime(newDate); 

  if (isNaN(newDate.getTime())) {
    return bot.sendMessage(msg.chat.id, 'Неверный формат даты. Используйте "YYYY-MM-DD HH:MM".');
  }

  db.run('UPDATE deadlines SET title = ?, date = ? WHERE id = ?', [newTitle, newDate.toISOString(), id], function(err) {
    if (err) {
      return bot.sendMessage(msg.chat.id, 'Ошибка, krafi.info');
    }
    bot.sendMessage(msg.chat.id, `Дедлайн обновлен: ${newTitle} на ${newDate.toLocaleString('ru-RU')}`);
  });
});

bot.onText(/\/rm (\d+)/, (msg, match) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (!isAllowedGroup(chatId)) {
    return bot.sendMessage(chatId, 'Этот бот не предназначен для использования в этой группе.');
  }
  if (!isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, 'У вас нет прав на выполнение этой команды.');
  }

  if (!match || match.length < 2) {
    return bot.sendMessage(msg.chat.id, 'Неверный формат. Используйте команду: /remove <id>.');
  }

  const id = match[1];

  db.run('DELETE FROM deadlines WHERE id = ?', id, function(err) {
    if (err) {
      return bot.sendMessage(msg.chat.id, 'Ошибка , krafi.info');
    }
    bot.sendMessage(msg.chat.id, 'Дедлайн удален.');
  });
});

bot.onText(/\/lt/, (msg) => {
  const now = adjustToMoscowTime(new Date()); // Current Moscow time
  const pastDate = new Date(now);
  pastDate.setDate(now.getDate() - 10); // 10 days ago in Moscow time

  db.all('SELECT * FROM deadlines WHERE date BETWEEN ? AND ?', [pastDate.toISOString(), now.toISOString()], (err, rows) => {
    if (err) {
      return bot.sendMessage(msg.chat.id, 'Ошибка, krafi.info');
    }
    
    if (rows.length > 0) {
      const response = rows.map(d => {
        const taskDate = new Date(d.date);
        return `${d.id}. ${d.title} - ${taskDate.toLocaleDateString('ru-RU')} ${taskDate.toLocaleTimeString('ru-RU')}`;
      }).join('\n');
      bot.sendMessage(msg.chat.id, `Задачи за последние 10 дней:\n${response}`);
    } else {
      bot.sendMessage(msg.chat.id, 'Задачи не найдены.');
    }
  });
});

bot.onText(/\/ut/, (msg) => {
  const now = adjustToMoscowTime(new Date()); // Current Moscow time
  const upcomingDate = new Date(now);
  upcomingDate.setDate(now.getDate() + 10); // 10 days from now in Moscow time

  db.all('SELECT * FROM deadlines WHERE date BETWEEN ? AND ?', [now.toISOString(), upcomingDate.toISOString()], (err, rows) => {
    if (err) {
      return bot.sendMessage(msg.chat.id, 'Ошибка krafi.info');
    }

    if (rows.length > 0) {
      const response = rows.map(d => {
        const taskDate = new Date(d.date);
        const timeRemaining = calculateTimeRemaining(taskDate, now);

        return `${d.id}. ${d.title} - ${taskDate.toLocaleDateString('ru-RU')} ${taskDate.toLocaleTimeString('ru-RU')} (Осталось времени: ${timeRemaining})`;
      }).join('\n');
      bot.sendMessage(msg.chat.id, `Предстоящие задачи на 10 дней:\n${response}`);
    } else {
      bot.sendMessage(msg.chat.id, 'Предстоящие задачи не найдены.');
    }
  });
});


function calculateTimeRemaining(targetDate, currentDate) {
  const diff = targetDate - currentDate;
  if (diff <= 0) return 'Время прошло';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
	

  let timeRemaining = '';
  if (days > 0) timeRemaining += `${days} дн. `;
  if (hours > 0) timeRemaining += `${hours} ч. `;
  if (minutes > 0) timeRemaining += `${minutes} мин. `;
  if (seconds > 0) timeRemaining += `${seconds} сек.`;

  return timeRemaining.trim(); 
}

cron.schedule('0 0,12 * * *', () => {
  const now = adjustToMoscowTime(new Date()).toISOString(); // Moscow time

  db.all('SELECT * FROM deadlines WHERE date <= ?', [now], (err, rows) => {
    if (err) {
      return console.error('Ошибка проверки дедлайнов:', err);
    }

    rows.forEach((d) => {
      bot.sendMessage(chatId, `Напоминание: срок по задаче "${d.title}" истекает!`);
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
  //bot.sendMessage(chatId, 'Привет! Я в сети. НКА друзья!!');
});
