# Telegram Bot with Deadline Management and AI Integration

## Overview
This project implements a Telegram bot that helps users manage deadlines and utilize AI to answer questions, generate images, and translate text. It uses various APIs like OpenAI, NVIDIA's AI image generation, and SQLite for database management.

The bot provides functionalities like adding, updating, deleting, and listing deadlines, as well as AI-powered features such as answering user queries, translating text, and generating images.

## Features
- **Deadline Management**: 
  - Add, update, and delete deadlines.
  - List past and upcoming deadlines.
  - Scheduled reminders for deadlines.
  
- **AI Integration**:
  - Answer questions using OpenAI's Llama model.
  - Generate AI-based images using NVIDIA's Bria API.
  - Translate text into Russian using OpenAI's translation capabilities.

- **Admin Controls**: Only admins can modify deadlines.
  
- **Multimedia Handling**: 
  - Can handle multimedia files like images, documents, and audio.

## Requirements
- **Node.js** (>=14.x)
- **npm** (>=6.x)
- **SQLite3**
- A **Telegram Bot Token** (from [BotFather](https://core.telegram.org/bots#botfather))
- An **OpenAI API Key** (from [OpenAI](https://platform.openai.com/signup))
- An **NVIDIA AI API Key** (from [NVIDIA](https://developer.nvidia.com/gen-ai))

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/telegram-bot-deadline-ai.git
   cd telegram-bot-deadline-ai
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory:
   ```
   TELEGRAM_TOKEN=<your-telegram-bot-token>
   OPENAI_API_KEY=<your-openai-api-key>
   ADMIN_IDS=<admin-telegram-id-1>,<admin-telegram-id-2>
   CHAT_ID=<default-chat-id>
   PORT=<port-number> (optional, defaults to 3000)
   ```

4. Start the bot:
   ```bash
   npm start
   ```

## Usage

### Bot Commands:
1. **/add `<title>` `<YYYY-MM-DD HH:MM>`**  
   Add a deadline. Example: `/add Project 2024-12-01 14:00`
   
2. **/modify `<id>` `<new-title>` `<YYYY-MM-DD HH:MM>`**  
   Modify a deadline. Example: `/modify 1 UpdatedProject 2024-12-05 16:00`
   
3. **/rm `<id>`**  
   Delete a deadline. Example: `/rm 1`
   
4. **/lt**  
   List tasks from the last 10 days.
   
5. **/ut**  
   List upcoming tasks within the next 10 days.
   
6. **/ai `<query>`**  
   Ask AI a question. Example: `/ai What is the capital of France?`
   
7. **/bigai `<query>`**  
   Get a more detailed AI response.
   
8. **/translate `<text>`**  
   Translate any text to Russian. Example: `/translate Hello, how are you?`
   
9. **/bria `<image-description>`**  
   Generate an image using NVIDIA's AI. Example: `/bria A cat sitting on a chair`
   
10. **/del**  
    Delete a bot message. Must reply to the bot's message to delete it.

11. **/help**  
    Display help message with available commands.

### Scheduled Reminders
The bot checks deadlines twice a day (12:00 AM and 12:00 PM) and sends reminders to the chat.

### AI-based Interactions
- The bot can respond to regular text messages in the chat and provide AI-generated replies.
- To reply to a specific message, use `/ai` or `/bigai`.

## Database
The deadlines are stored in an SQLite database (`deadlines.db`). It is created automatically when you run the bot for the first time.

## Cron Jobs
The bot runs a cron job that checks for upcoming deadlines every 12 hours and sends reminders for tasks that are due soon.

## License
This project is licensed under the GPL-3 License.

For more information or questions, visit [krafi.info](https://www.krafi.info) or email at `email@krafi.info`.

