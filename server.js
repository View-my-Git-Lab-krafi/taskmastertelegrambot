
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({ secret: 'your_secret_key', resave: false, saveUninitialized: true }));

//const db = new sqlite3.Database(':memory:');
const db = new sqlite3.Database('./deadlines.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS deadlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT,
    title TEXT,
    date TEXT
  )`);
});

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const chatId = process.env.CHAT_ID; 
const adminIds = process.env.ADMIN_IDS.split(',').map(id => id.trim()); 

function isAdmin(userId) {
  return adminIds.includes(userId.toString());
}

bot.onText(/\/add (.+) (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/, (msg, match) => {
  const userId = msg.from.id;
  
  if (!isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, 'You are not authorized to perform this action.');
  }

  const title = match[1];
  const date = new Date(match[2]);

  if (isNaN(date.getTime())) {
    return bot.sendMessage(msg.chat.id, 'Invalid date format. Please use "YYYY-MM-DD HH:MM".');
  }

  const stmt = db.prepare('INSERT INTO deadlines (userId, title, date) VALUES (?, ?, ?)');
  stmt.run(userId, title, date.toISOString(), function(err) {
    if (err) {
      return bot.sendMessage(msg.chat.id, 'Error adding deadline.');
    }
    bot.sendMessage(msg.chat.id, `Deadline added: ${title} on ${date.toLocaleString()}`);
  });
  stmt.finalize();
});

bot.onText(/\/modify (\d+) (.+) (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/, (msg, match) => {
  const userId = msg.from.id;
  
  if (!isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, 'You are not authorized to perform this action.');
  }

  const id = match[1];
  const newTitle = match[2];
  const newDate = new Date(match[3]);

  if (isNaN(newDate.getTime())) {
    return bot.sendMessage(msg.chat.id, 'Invalid date format. Please use "YYYY-MM-DD HH:MM".');
  }

  db.run('UPDATE deadlines SET title = ?, date = ? WHERE id = ?', [newTitle, newDate.toISOString(), id], function(err) {
    if (err) {
      return bot.sendMessage(msg.chat.id, 'Error updating deadline.');
    }
    bot.sendMessage(msg.chat.id, `Deadline updated: ${newTitle} on ${newDate.toLocaleString()}`);
  });
});

bot.onText(/\/remove (\d+)/, (msg, match) => {
  const userId = msg.from.id;
  
  if (!isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, 'You are not authorized to perform this action.');
  }

  const id = match[1];

  db.run('DELETE FROM deadlines WHERE id = ?', id, function(err) {
    if (err) {
      return bot.sendMessage(msg.chat.id, 'Error removing deadline.');
    }
    bot.sendMessage(msg.chat.id, 'Deadline removed.');
  });
});
bot.onText(/\/last_tasks/, (msg) => {
  const now = new Date();
  const pastDate = new Date(now);
  pastDate.setDate(now.getDate() - 10);

  db.all('SELECT * FROM deadlines WHERE date BETWEEN ? AND ?', [pastDate.toISOString(), now.toISOString()], (err, rows) => {
    if (err) {
      return bot.sendMessage(msg.chat.id, 'Error retrieving tasks.');
    }
    
    if (rows.length > 0) {
      const response = rows.map(d => {
        const taskDate = new Date(d.date);
        return `${d.title} - ${taskDate.toLocaleDateString()} ${taskDate.toLocaleTimeString()}`;
      }).join('\n');
      bot.sendMessage(msg.chat.id, `Last 10 days tasks:\n${response}`);
    } else {
      bot.sendMessage(msg.chat.id, 'No tasks found.');
    }
  });
});

bot.onText(/\/upcoming_tasks/, (msg) => {
  const now = new Date();
  const upcomingDate = new Date(now);
  upcomingDate.setDate(now.getDate() + 10);

  db.all('SELECT * FROM deadlines WHERE date BETWEEN ? AND ?', [now.toISOString(), upcomingDate.toISOString()], (err, rows) => {
    if (err) {
      return bot.sendMessage(msg.chat.id, 'Error retrieving tasks.');
    }

    if (rows.length > 0) {
      const response = rows.map(d => {
        const taskDate = new Date(d.date);
        const timeRemaining = calculateTimeRemaining(taskDate, now);

        return `${d.title} - ${taskDate.toLocaleDateString()} ${taskDate.toLocaleTimeString()} (Time left: ${timeRemaining})`;
      }).join('\n');
      bot.sendMessage(msg.chat.id, `Upcoming 10 days tasks:\n${response}`);
    } else {
      bot.sendMessage(msg.chat.id, 'No upcoming tasks found.');
    }
  });
});

function calculateTimeRemaining(targetDate, currentDate) {
  const diff = targetDate - currentDate;
  if (diff <= 0) return 'Time passed';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return `${days} days, ${hours} hours, ${minutes} minutes, ${seconds} seconds`;
}


cron.schedule('0 0,12 * * *', () => {
  const now = new Date().toISOString();

  db.all('SELECT * FROM deadlines WHERE date <= ?', [now], (err, rows) => {
    if (err) {
      return console.error('Error checking deadlines:', err);
    }

    rows.forEach((d) => {
      bot.sendMessage(chatId, `Deadline alert: ${d.title} is due!`);
    });
  });
});

// Server starting message
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  bot.sendMessage(chatId, 'Bot is now online and ready to manage tasks!');
});

