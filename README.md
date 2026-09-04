# MAX Bot API Long Polling Server

Минимальный серверный проект для тестирования и отладки **MAX Bot API** через Long Polling (`GET /updates`).

## Стек и возможности
- Официальный endpoint: `https://platform-api2.max.ru`
- Авторизация через заголовок `Authorization: <token>` (из переменной окружения `MAX_BOT_TOKEN`)
- Проверка токена и профиля бота через `GET /me` (вывод ID, имени и username бота)
- Потоковый Long Polling через `GET /updates`
- Сохранение и передача параметра `marker` между запросами
- Обработка и фильтрация событий `message_created` с выводом:
  - Тип события
  - `chat_id`
  - Данные отправителя (`sender`)
  - Текст сообщения
  - Полный исходный JSON
- Автоматический retry c экспоненциальной задержкой при сетевых сбоях и ошибках API (без падения приложения)
- Два режима запуска:
  1. **Standalone Node.js / TypeScript CLI демон** (`npm run bot` или `npx tsx bot.ts`)
  2. **Web-сервер с консолью просмотра логов в реальном времени** (`npm run dev`)

---

## Структура файлов

```
.
├── bot.ts                    # Автономный Node.js скрипт для запуска бота в фоне/терминале
├── lib/
│   └── max-bot.ts            # Сервис подключения к MAX Bot API (Long Polling, GET /me, логирование)
├── app/
│   ├── api/
│   │   └── bot/
│   │       ├── status/route.ts   # API статус подключения и данные бота
│   │       ├── logs/route.ts     # API получения серверных логов
│   │       └── control/route.ts  # API управления ботом (старт / стоп / проверка / очистка)
│   ├── globals.css           # Базовые стили
│   ├── layout.tsx            # Корневой layout
│   └── page.tsx              # Консоль для просмотра логов в реальном времени
├── package.json              # Зависимости и npm-скрипты
├── tsconfig.json             # Настройки TypeScript
└── .env.example              # Пример переменных окружения
```

---

## Инструкция по локальному запуску

### 1. Установка зависимостей
```bash
npm install
```

### 2. Настройка токена бота
Создайте файл `.env` в корне проекта (или скопируйте `.env.example`):
```bash
cp .env.example .env
```

Заполните `MAX_BOT_TOKEN` вашим токеном:
```env
MAX_BOT_TOKEN="ВАШ_ТОКЕН_MAX_БОТА"
```

### 3. Варианты запуска

#### Вариант A: Автономный CLI-бот (Node.js)
Запуск только серверного демона без браузера:
```bash
npm run bot
```
или с передачей переменной напрямую:
```bash
MAX_BOT_TOKEN="ВАШ_ТОКЕН" npm run bot
```

#### Вариант B: Сервер с веб-экраном логов
Запуск веб-сервера:
```bash
npm run dev
```
Откройте в браузере `http://localhost:3000`. На странице отображается статус подключения к MAX API и выводятся логи Long Polling в реальном времени.

---

## Production развертывание в Docker на VPS (для https://vivonline.ru/max)

1. Склонируйте репозиторий и создайте `.env`:
```bash
cp .env.example .env
# Заполните MAX_BOT_TOKEN, MAX_WEBHOOK_SECRET, OPENAI_API_KEY
# Для работы по адресу https://vivonline.ru/max задайте BASE_PATH и MAX_WEBHOOK_URL:
BASE_PATH=/max
NEXT_PUBLIC_BASE_PATH=/max
MAX_WEBHOOK_URL=https://vivonline.ru/max/webhook/max
MAX_WEBHOOK_SECRET=ваш_секретный_ключ
```

2. Сборка и запуск контейнера:
```bash
docker compose up -d --build
```

3. Настройка Nginx на сервере для пути `/max`:
> **Важно**: в директиве `proxy_pass http://127.0.0.1:3001;` **не должно быть слэша `/` на конце после 3001**, чтобы Nginx передавал полный путь `/max/...` в Next.js:

```nginx
location /max {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

4. Проверка статуса сервиса и Webhook:
```bash
# Проверка логов контейнера
docker compose logs -f maxbot-sammary

# Проверка API статуса бота
curl http://127.0.0.1:3001/max/api/bot/status

# Проверка Webhook локально (HTTP 200 {"ok":true})
curl -i -X POST http://127.0.0.1:3001/max/webhook/max \
  -H "Content-Type: application/json" \
  -H "X-Max-Bot-Api-Secret: ваш_секретный_ключ" \
  -d '{"update_type":"message_created","message":{"body":{"text":"тест"},"recipient":{"chat_id":123},"sender":{"name":"Тест"}}}'

# Проверка Webhook через Nginx / HTTPS (HTTP 200 {"ok":true})
curl -i -X POST https://vivonline.ru/max/webhook/max \
  -H "Content-Type: application/json" \
  -H "X-Max-Bot-Api-Secret: ваш_секретный_ключ" \
  -d '{"update_type":"message_created","message":{"body":{"text":"тест"},"recipient":{"chat_id":123},"sender":{"name":"Тест"}}}'
```

