import OpenAI from 'openai';

// Allow TLS connections with Russian Trusted Root CA certificates used by platform-api2.max.ru
if (typeof process !== 'undefined' && process.env && !process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

export const BOT_USER_ID = 232063193;

export interface BotInfo {
  user_id?: number | string;
  id?: number | string;
  name?: string;
  username?: string;
  is_bot?: boolean;
  [key: string]: unknown;
}

export interface MaxSender {
  user_id?: number | string;
  id?: number | string;
  name?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  [key: string]: unknown;
}

export interface MaxRecipient {
  chat_id?: number | string;
  chat_type?: string;
  [key: string]: unknown;
}

export interface MaxMessageBody {
  text?: string;
  mid?: string;
  seq?: number;
  [key: string]: unknown;
}

export interface MaxForwardLink {
  type?: string; // "forward", "reply", etc.
  sender?: MaxSender;
  message?: {
    text?: string;
    body?: { text?: string };
    [key: string]: unknown;
  };
  text?: string;
  timestamp?: number | string;
  [key: string]: unknown;
}

export interface MaxMessage {
  body?: MaxMessageBody;
  sender?: MaxSender;
  recipient?: MaxRecipient;
  timestamp?: number | string;
  time?: number | string;
  link?: MaxForwardLink;
  [key: string]: unknown;
}

export interface MaxUpdate {
  update_type: string;
  timestamp?: number | string;
  message?: MaxMessage;
  chat_id?: number | string;
  sender?: MaxSender;
  [key: string]: unknown;
}

export interface MaxUpdatesResponse {
  updates: MaxUpdate[];
  marker?: number | string | null;
  [key: string]: unknown;
}

export interface MaxMessagesResponse {
  messages?: MaxMessage[];
  [key: string]: unknown;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'event';
  message: string;
  rawJson?: string;
}

export interface SummaryCommandInfo {
  isCommand: boolean;
  requestedCount: number;
  rawText: string;
}

export interface ProcessedHistoryMessage {
  isForwarded: boolean;
  author: string;
  authorUserId?: string | number;
  text: string;
  timestamp: number;
  rawTimestamp?: number | string;
  seq?: number;
  raw: MaxMessage;
}

/**
 * Format timestamp to readable time string: HH:mm:ss
 */
function formatTime(ts?: number | string): string {
  if (!ts) return '00:00:00';
  let date: Date;
  if (typeof ts === 'number') {
    date = ts < 1e11 ? new Date(ts * 1000) : new Date(ts);
  } else if (typeof ts === 'string') {
    const num = Number(ts);
    if (!isNaN(num)) {
      date = num < 1e11 ? new Date(num * 1000) : new Date(num);
    } else {
      date = new Date(ts);
    }
  } else {
    date = new Date();
  }

  if (isNaN(date.getTime())) {
    return '00:00:00';
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Format timestamp to readable string: YYYY-MM-DD HH:mm:ss
 */
function formatDateTime(ts?: number | string): string {
  if (!ts) {
    const now = new Date();
    return now.toISOString().replace('T', ' ').slice(0, 19);
  }
  let date: Date;
  if (typeof ts === 'number') {
    date = ts < 1e11 ? new Date(ts * 1000) : new Date(ts);
  } else if (typeof ts === 'string') {
    const num = Number(ts);
    if (!isNaN(num)) {
      date = num < 1e11 ? new Date(num * 1000) : new Date(num);
    } else {
      date = new Date(ts);
    }
  } else {
    date = new Date();
  }

  if (isNaN(date.getTime())) {
    date = new Date();
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Extract display author name from sender object
 */
function getSenderDisplayName(sender?: MaxSender): string {
  if (!sender) return 'Неизвестный автор';
  if (sender.name && typeof sender.name === 'string' && sender.name.trim()) {
    return sender.name.trim();
  }
  const parts: string[] = [];
  if (typeof sender.first_name === 'string' && sender.first_name) parts.push(sender.first_name);
  if (typeof sender.last_name === 'string' && sender.last_name) parts.push(sender.last_name);
  if (parts.length > 0) return parts.join(' ').trim();
  if (sender.username && typeof sender.username === 'string') {
    return `@${sender.username}`;
  }
  if (sender.user_id !== undefined && sender.user_id !== null) {
    return `User ${sender.user_id}`;
  }
  if (sender.id !== undefined && sender.id !== null) {
    return `User ${sender.id}`;
  }
  return 'Неизвестный автор';
}

/**
 * Check if a text message is a command to our bot
 */
function isBotCommand(
  text: string,
  botUsername?: string,
  botUserId?: string | number
): boolean {
  if (!text) return false;
  const trimmed = text.trim();
  if (/@id\d+_bot/i.test(trimmed) || /@\w+_bot/i.test(trimmed)) return true;
  if (botUsername && trimmed.toLowerCase().includes(`@${botUsername.toLowerCase()}`)) return true;
  if (botUserId && trimmed.includes(String(botUserId))) return true;
  if (/^(?:сделай\s+)?саммари/i.test(trimmed)) return true;
  if (/^\/[a-zA-Z0-9_-]+/.test(trimmed)) return true;
  return false;
}

/**
 * Parse incoming message for summary command and extract requested message count
 */
export function parseSummaryCommand(
  text: string,
  botUsername?: string,
  botUserId?: string | number
): SummaryCommandInfo | null {
  if (!text || typeof text !== 'string') return null;
  const trimmed = text.trim();

  // Check if bot is mentioned or summary requested
  const hasMention =
    /@id\d+_bot/i.test(trimmed) ||
    /@\w+_bot/i.test(trimmed) ||
    (botUsername && trimmed.toLowerCase().includes(`@${botUsername.toLowerCase()}`)) ||
    (botUserId && trimmed.includes(String(botUserId)));

  const hasSummaryWord = /саммари|summary|сократи|кратко/i.test(trimmed);

  if (!hasSummaryWord && !hasMention) {
    return null;
  }

  if (hasSummaryWord || (hasMention && /сделай|создай|собери|напиши/i.test(trimmed))) {
    // Extract count from expressions like "последних 20 сообщений", "последних 5", "20 сообщений"
    const matchCount =
      trimmed.match(/последни[хе]\s+(\d+)/i) ||
      trimmed.match(/(\d+)\s+сообщен/i) ||
      trimmed.match(/(\d+)\s+пост/i) ||
      trimmed.match(/\b(\d+)\b/);

    let count = 20; // Default
    if (matchCount && matchCount[1]) {
      const parsed = parseInt(matchCount[1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        count = parsed;
      }
    }

    return {
      isCommand: true,
      requestedCount: count,
      rawText: trimmed,
    };
  }

  return null;
}

export class MaxBotService {
  private static instance: MaxBotService | null = null;
  private readonly baseUrl = 'https://platform-api2.max.ru';
  private token: string | null = null;
  private marker: number | string | null = null;
  private isRunning: boolean = false;
  private botInfo: BotInfo | null = null;
  private logs: LogEntry[] = [];
  private readonly maxLogs = 500;
  private pollAbortController: AbortController | null = null;

  private constructor() {
    this.token = process.env.MAX_BOT_TOKEN || null;
  }

  public static getInstance(): MaxBotService {
    if (!MaxBotService.instance) {
      MaxBotService.instance = new MaxBotService();
    }
    return MaxBotService.instance;
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      hasToken: Boolean(this.token && this.token.trim().length > 0),
      hasOpenAiKey: Boolean(
        process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0
      ),
      hasWebhookSecret: Boolean(
        process.env.MAX_WEBHOOK_SECRET && process.env.MAX_WEBHOOK_SECRET.trim().length > 0
      ),
      webhookUrl:
        process.env.MAX_WEBHOOK_URL || 'https://vivonline.ru/max/webhook/max',
      botInfo: this.botInfo,
      marker: this.marker,
      logCount: this.logs.length,
    };
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clearLogs(): void {
    this.logs = [];
    this.addLog('info', 'Журнал логов очищен.');
  }

  public addLog(
    level: LogEntry['level'],
    message: string,
    rawJson?: unknown
  ): void {
    const timestamp = new Date().toISOString();
    const formattedRawJson =
      rawJson !== undefined
        ? typeof rawJson === 'string'
          ? rawJson
          : JSON.stringify(rawJson, null, 2)
        : undefined;

    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp,
      level,
      message,
      rawJson: formattedRawJson,
    };

    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Output to stdout / stderr for native server logs
    const prefix = `[MAX-BOT] [${timestamp}] [${level.toUpperCase()}]`;
    if (level === 'error') {
      console.error(`${prefix} ${message}`);
      if (formattedRawJson) {
        console.error(formattedRawJson);
      }
    } else {
      console.log(`${prefix} ${message}`);
      if (formattedRawJson) {
        console.log(formattedRawJson);
      }
    }
  }

  /**
   * Check bot token via GET /me
   */
  public async checkMe(): Promise<BotInfo> {
    const token = this.token || process.env.MAX_BOT_TOKEN;
    if (!token || !token.trim()) {
      const errMsg =
        'Переменная окружения MAX_BOT_TOKEN не задана. Укажите токен бота в .env или в настройках окружения.';
      this.addLog('error', errMsg);
      throw new Error(errMsg);
    }

    this.addLog('info', 'Проверка токена MAX (GET /me)...');

    const headers: Record<string, string> = {
      Authorization: token.trim(),
      'User-Agent': 'MaxBot-LongPolling-Client/1.0',
    };

    const url = `${this.baseUrl}/me`;
    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers,
      });
    } catch (fetchErr: unknown) {
      const cause =
        fetchErr && typeof fetchErr === 'object' && 'cause' in fetchErr
          ? ` (${(fetchErr as { cause: unknown }).cause})`
          : '';
      const msg = `Сбой сетевого соединения при GET /me: ${
        fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      }${cause}`;
      this.addLog('error', msg);
      throw new Error(msg);
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      const err = `Ошибка проверки токена MAX (HTTP ${response.status} ${response.statusText}): ${errorText}`;
      this.addLog('error', err);
      throw new Error(err);
    }

    const data = (await response.json()) as BotInfo;
    this.botInfo = data;

    const botId = data.user_id ?? data.id ?? 'неизвестен';
    const botName = data.name || data.username || 'Без имени';
    const botUsername = data.username ? `@${data.username}` : '';

    this.addLog(
      'success',
      `Бот успешно авторизован! Имя: "${botName}" ${botUsername} | ID: ${botId}`
    );

    return data;
  }

  /**
   * Fetch chat history via GET /messages
   */
  public async fetchChatMessages(
    chatId: string | number,
    count: number
  ): Promise<MaxMessage[]> {
    const token = this.token || process.env.MAX_BOT_TOKEN;
    if (!token || !token.trim()) {
      throw new Error('MAX_BOT_TOKEN не задан');
    }

    const queryParams = new URLSearchParams();
    queryParams.set('chat_id', String(chatId));
    queryParams.set('count', String(count));

    const url = `${this.baseUrl}/messages?${queryParams.toString()}`;
    const headers: Record<string, string> = {
      Authorization: token.trim(),
      'User-Agent': 'MaxBot-LongPolling-Client/1.0',
    };

    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      throw new Error(
        `Ошибка MAX API GET /messages (HTTP ${response.status} ${response.statusText}): ${errorText}`
      );
    }

    const data = (await response.json()) as
      | MaxMessagesResponse
      | MaxMessage[]
      | Record<string, unknown>;

    if (Array.isArray(data)) {
      return data;
    }
    if (data && Array.isArray((data as MaxMessagesResponse).messages)) {
      return (data as MaxMessagesResponse).messages!;
    }
    if (data && Array.isArray((data as Record<string, unknown>).data)) {
      return (data as Record<string, unknown>).data as MaxMessage[];
    }
    return [];
  }

  /**
   * Handle a summary command in a chat:
   * 1. Fetch chat history via MAX /messages
   * 2. Extract regular messages
   * 3. Extract forwarded messages (text from link.message.text, author from link.sender)
   * 4. Combine all messages into a unified array
   * 5. Sort unified array chronologically (timestamp ASC, seq ASC)
   * 6. Exclude bot commands and our bot's messages
   * 7. Select last N messages
   * 8. Output to log in chronological order with timestamp and seq
   */
  public async handleSummaryRequest(
    chatId: string | number,
    requestedCount: number,
    commandText: string
  ): Promise<void> {
    const activeBotUserId = String(
      process.env.BOT_USER_ID ||
        this.botInfo?.user_id ||
        this.botInfo?.id ||
        BOT_USER_ID
    );

    // Fetch messages with margin (e.g. 3x requested, min 50, max 100)
    const fetchCount = Math.min(Math.max(requestedCount * 3, 50), 100);

    let rawMessages: MaxMessage[] = [];
    try {
      rawMessages = await this.fetchChatMessages(chatId, fetchCount);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.addLog(
        'error',
        `Не удалось получить историю чата ${chatId} через /messages: ${errMsg}`
      );
      return;
    }

    // 2 & 3 & 4. Extract regular and forwarded messages into a single unified array
    let regularCount = 0;
    let forwardedCount = 0;
    const allMessages: ProcessedHistoryMessage[] = [];

    for (const rawMsg of rawMessages) {
      const isForwarded =
        rawMsg.link?.type === 'forward' ||
        (rawMsg.link !== undefined &&
          rawMsg.link !== null &&
          rawMsg.link.type !== 'reply' &&
          Boolean(rawMsg.link.message));

      let text = '';
      let author = '';
      let authorUserId: string | number | undefined;

      if (isForwarded) {
        forwardedCount++;
        // Extract text from link.message.text
        text =
          rawMsg.link?.message?.text ||
          rawMsg.link?.message?.body?.text ||
          rawMsg.link?.text ||
          rawMsg.body?.text ||
          '';
        // Extract author from link.sender
        const sender = rawMsg.link?.sender;
        author = getSenderDisplayName(sender);
        authorUserId = sender?.user_id ?? sender?.id;
      } else {
        regularCount++;
        text =
          rawMsg.body?.text ??
          (typeof rawMsg.text === 'string' ? rawMsg.text : '') ??
          '';
        const sender = rawMsg.sender;
        author = getSenderDisplayName(sender);
        authorUserId = sender?.user_id ?? sender?.id;
      }

      // Extract raw timestamp and normalize to milliseconds for precise sorting
      const rawTs: number | string =
        typeof rawMsg.timestamp === 'number' || typeof rawMsg.timestamp === 'string'
          ? rawMsg.timestamp
          : typeof rawMsg.time === 'number' || typeof rawMsg.time === 'string'
          ? rawMsg.time
          : typeof (rawMsg.body as Record<string, unknown> | undefined)?.timestamp === 'number' ||
            typeof (rawMsg.body as Record<string, unknown> | undefined)?.timestamp === 'string'
          ? ((rawMsg.body as Record<string, unknown>).timestamp as number | string)
          : Date.now();

      let tsNormalized: number;
      if (typeof rawTs === 'number') {
        tsNormalized = rawTs < 1e11 ? rawTs * 1000 : rawTs;
      } else if (typeof rawTs === 'string') {
        const num = Number(rawTs);
        if (!isNaN(num)) {
          tsNormalized = num < 1e11 ? num * 1000 : num;
        } else {
          tsNormalized = new Date(rawTs).getTime();
        }
      } else {
        tsNormalized = Date.now();
      }
      if (isNaN(tsNormalized)) {
        tsNormalized = Date.now();
      }

      // Extract seq if available
      let seq: number | undefined = undefined;
      if (typeof rawMsg.seq === 'number') {
        seq = rawMsg.seq;
      } else if (typeof rawMsg.body?.seq === 'number') {
        seq = rawMsg.body.seq;
      } else if (
        typeof (rawMsg.link?.message as Record<string, unknown> | undefined)
          ?.seq === 'number'
      ) {
        seq = (rawMsg.link?.message as Record<string, unknown>).seq as number;
      }

      allMessages.push({
        isForwarded,
        author,
        authorUserId,
        text: text.trim(),
        timestamp: tsNormalized,
        rawTimestamp: rawTs,
        seq,
        raw: rawMsg,
      });
    }

    // 5. Sort the unified array chronologically: timestamp ASC, seq ASC
    allMessages.sort((a, b) => {
      const timeDiff = a.timestamp - b.timestamp;
      if (timeDiff !== 0) {
        return timeDiff;
      }
      if (
        a.seq !== undefined &&
        b.seq !== undefined &&
        !isNaN(a.seq) &&
        !isNaN(b.seq)
      ) {
        return a.seq - b.seq;
      }
      return 0;
    });

    // 6. After sorting, exclude bot commands and our bot's messages
    let excludedCommands = 0;
    let excludedBotMsgs = 0;
    const filteredMessages: ProcessedHistoryMessage[] = [];

    for (const msg of allMessages) {
      // Exclude messages written by our bot
      const isOurBot =
        msg.authorUserId !== undefined &&
        msg.authorUserId !== null &&
        String(msg.authorUserId) === activeBotUserId;

      if (isOurBot) {
        excludedBotMsgs++;
        continue;
      }

      // Exclude commands to our bot
      const isCommand = isBotCommand(
        msg.text,
        this.botInfo?.username,
        activeBotUserId
      );
      if (isCommand) {
        excludedCommands++;
        continue;
      }

      // Skip empty text messages
      if (!msg.text || !msg.text.trim()) {
        continue;
      }

      filteredMessages.push(msg);
    }

    // 7. Select last N messages
    const selectedMessages = filteredMessages.slice(-requestedCount);

    // 8. Output to log strictly in chronological order (oldest to newest) with timestamp and seq
    const formattedAiLines = selectedMessages.map((msg) => {
      const timeStr = formatTime(msg.timestamp);
      const seqStr = msg.seq !== undefined ? `, seq: ${msg.seq}` : '';
      const meta = `[ts: ${msg.rawTimestamp ?? msg.timestamp}${seqStr}]`;
      if (msg.isForwarded) {
        return `[${timeStr}] ${meta} [Переслано] ${msg.author}: ${msg.text}`;
      }
      return `[${timeStr}] ${meta} ${msg.author}: ${msg.text}`;
    });

    const messagesFormatted =
      formattedAiLines.length > 0
        ? formattedAiLines.join('\n')
        : '(сообщений не найдено)';

    // Required Structured Output Format
    const report = [
      '============================================================',
      'ЗАПРОС НА САММАРИ',
      '=================',
      '',
      `Chat ID: ${chatId}`,
      `Запрошено сообщений: ${requestedCount}`,
      `Команда: ${commandText}`,
      '',
      `MAX вернул сообщений: ${rawMessages.length}`,
      `Обычных сообщений: ${regularCount}`,
      `Пересланных сообщений: ${forwardedCount}`,
      `Исключено команд: ${excludedCommands}`,
      `Исключено сообщений нашего бота: ${excludedBotMsgs}`,
      `Передано на анализ: ${selectedMessages.length}`,
      '',
      '============================================================',
      'СООБЩЕНИЯ ДЛЯ AI',
      '================',
      '',
      messagesFormatted,
    ].join('\n');

    // Add to service logs: Report on summary request & messages for AI
    this.addLog('info', report);

    if (selectedMessages.length === 0) {
      const emptySummaryReport = [
        '============================================================',
        'OPENAI — САММАРИ',
        '================',
        '',
        '(нет сообщений для анализа)',
      ].join('\n');
      this.addLog('info', emptySummaryReport);
      return;
    }

    // Call OpenAI for summary generation
    try {
      this.addLog('info', 'Отправка сообщений в OpenAI (модель gpt-5.4-mini) для создания саммари...');
      const summary = await this.generateSummaryWithOpenAI(messagesFormatted);

      const summaryReport = [
        '============================================================',
        'OPENAI — САММАРИ',
        '================',
        '',
        summary,
      ].join('\n');

      this.addLog('info', summaryReport);

      // Send summary back to the same MAX chat
      await this.sendSummaryToMax(chatId, summary);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      this.addLog('error', `Ошибка при вызове OpenAI: ${errMsg}`);
    }
  }

  /**
   * Send summary text back to MAX chat via POST https://platform-api2.max.ru/messages?chat_id=...
   */
  public async sendSummaryToMax(
    chatId: string | number,
    summary: string
  ): Promise<void> {
    const token = this.token || process.env.MAX_BOT_TOKEN;
    if (!token || !token.trim()) {
      const errReport = [
        '============================================================',
        'MAX — ОТПРАВКА САММАРИ',
        '======================',
        '',
        'HTTP-код: —',
        'Ошибка: MAX_BOT_TOKEN не задан.',
      ].join('\n');
      this.addLog('error', errReport);
      return;
    }

    const queryParams = new URLSearchParams();
    queryParams.set('chat_id', String(chatId));

    const url = `${this.baseUrl}/messages?${queryParams.toString()}`;
    const headers: Record<string, string> = {
      Authorization: token.trim(),
      'Content-Type': 'application/json',
      'User-Agent': 'MaxBot-LongPolling-Client/1.0',
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ text: summary }),
      });

      const responseText = await response.text().catch(() => '');

      if (response.ok) {
        const sendReport = [
          '============================================================',
          'MAX — ОТПРАВКА САММАРИ',
          '======================',
          '',
          `HTTP-код: ${response.status}`,
          '✓ Саммари отправлено в MAX.',
        ].join('\n');
        this.addLog('success', sendReport);
      } else {
        const sendReport = [
          '============================================================',
          'MAX — ОТПРАВКА САММАРИ',
          '======================',
          '',
          `HTTP-код: ${response.status}`,
          `Текст ответа MAX: ${responseText || response.statusText || 'Пустой ответ'}`,
        ].join('\n');
        this.addLog('error', sendReport);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const sendReport = [
        '============================================================',
        'MAX — ОТПРАВКА САММАРИ',
        '======================',
        '',
        'HTTP-код: Сетевая ошибка',
        `Текст ответа MAX: ${errMsg}`,
      ].join('\n');
      this.addLog('error', sendReport);
    }
  }

  /**
   * Generate concise chat summary using OpenAI gpt-5.4-mini
   */
  public async generateSummaryWithOpenAI(messagesText: string): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      throw new Error(
        'Переменная окружения OPENAI_API_KEY не задана. Укажите ключ в .env или настройках окружения.'
      );
    }

    const openai = new OpenAI({
      apiKey: apiKey.trim(),
    });

    const systemPrompt = `Ты создаёшь краткое саммари переписки в рабочем групповом чате.

Передай только главное содержание обсуждения.
Объединяй связанные сообщения в общие темы.
Выделяй решения, договорённости, важные факты, проблемы и следующие действия.
Не пересказывай каждое сообщение отдельно.
Не выдумывай информацию.
Не добавляй информацию, которой нет в переписке.
Не упоминай процесс анализа.
Не используй заголовки вроде "Саммари", "Резюме", "Итоги".
Ответ должен содержать только краткое саммари.
Обычно достаточно 1–3 коротких абзацев.`;

    const userPrompt = `Сообщения из чата (в хронологическом порядке):\n\n${messagesText}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const summary = completion.choices?.[0]?.message?.content?.trim();
    if (!summary) {
      throw new Error('OpenAI вернул пустой ответ');
    }

    return summary;
  }

  /**
   * Start Long Polling loop
   */
  public async start(): Promise<void> {
    if (this.isRunning) {
      this.addLog('warn', 'Бот уже запущен.');
      return;
    }

    this.isRunning = true;
    this.token = process.env.MAX_BOT_TOKEN || null;
    this.pollAbortController = new AbortController();

    this.addLog('info', 'Запуск приложения MAX Bot Long Polling...');

    try {
      await this.checkMe();
    } catch (e: unknown) {
      const err = e instanceof Error ? e.message : String(e);
      this.addLog(
        'warn',
        `Первичная проверка не завершилась успешно: ${err}. Цикл поллинга начинает работу и продолжит попытки подключения...`
      );
    }

    this.addLog('info', 'Старт цикла Long Polling (GET /updates)...');
    this.runPollingLoop();
  }

  /**
   * Stop Long Polling loop
   */
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.pollAbortController) {
      this.pollAbortController.abort();
      this.pollAbortController = null;
    }
    this.addLog('warn', 'Сервис Long Polling остановлен.');
  }

  /**
   * Polling loop with retry backoff
   */
  private async runPollingLoop(): Promise<void> {
    let retryDelay = 1000;
    const maxRetryDelay = 15000;

    while (this.isRunning) {
      const token = this.token || process.env.MAX_BOT_TOKEN;
      if (!token || !token.trim()) {
        this.addLog(
          'error',
          'MAX_BOT_TOKEN отсутствует в окружении. Ожидание 5 сек перед повторной проверкой...'
        );
        await this.sleep(5000);
        continue;
      }

      try {
        const queryParams = new URLSearchParams();
        if (this.marker !== null && this.marker !== undefined) {
          queryParams.set('marker', String(this.marker));
        }

        const endpoint = `${this.baseUrl}/updates${
          queryParams.toString() ? `?${queryParams.toString()}` : ''
        }`;

        const headers: Record<string, string> = {
          Authorization: token.trim(),
          'User-Agent': 'MaxBot-LongPolling-Client/1.0',
        };

        const response = await fetch(endpoint, {
          method: 'GET',
          headers,
          signal: this.pollAbortController?.signal,
        });

        if (!response.ok) {
          const errorBody = await response
            .text()
            .catch(() => 'No response body');
          this.addLog(
            'error',
            `Ошибка MAX API при GET /updates (HTTP ${response.status} ${response.statusText}): ${errorBody}`
          );

          // Exponential backoff
          await this.sleep(retryDelay);
          retryDelay = Math.min(retryDelay * 1.5, maxRetryDelay);
          continue;
        }

        // Reset retry delay on successful request
        retryDelay = 1000;

        const data = (await response.json()) as MaxUpdatesResponse;

        // Update marker if provided
        if (data.marker !== undefined && data.marker !== null) {
          this.marker = data.marker;
        }

        const updates = Array.isArray(data.updates) ? data.updates : [];

        if (updates.length > 0) {
          for (const update of updates) {
            this.handleUpdate(update);
          }
        }
      } catch (err: unknown) {
        if (!this.isRunning) {
          break; // Aborted normally
        }

        const cause =
          err && typeof err === 'object' && 'cause' in err
            ? ` [Детали: ${(err as { cause: unknown }).cause}]`
            : '';
        const errorMessage = `${
          err instanceof Error ? err.message : String(err)
        }${cause}`;

        this.addLog(
          'error',
          `Сетевая ошибка или сбой запроса: ${errorMessage}. Повтор через ${Math.round(
            retryDelay / 1000
          )}с...`
        );

        await this.sleep(retryDelay);
        retryDelay = Math.min(retryDelay * 1.5, maxRetryDelay);
      }
    }
  }

  /**
   * Process individual update event (used by both Long Polling and Webhook)
   */
  public handleUpdate(
    update: MaxUpdate,
    options?: { isWebhook?: boolean }
  ): void {
    const updateType =
      update.update_type ||
      (update as Record<string, unknown>).event_type ||
      (update as Record<string, unknown>).type ||
      'unknown_event';

    // Extract details according to MAX Bot API spec
    const rawChatId =
      update.message?.recipient?.chat_id ??
      update.chat_id ??
      (update as Record<string, unknown>).recipient_chat_id ??
      (update.message as Record<string, unknown> | undefined)?.chat_id ??
      ((update as Record<string, unknown>).recipient as Record<string, unknown> | undefined)?.chat_id;

    const chatId: string | number =
      typeof rawChatId === 'string' || typeof rawChatId === 'number'
        ? rawChatId
        : 'неизвестно';

    const senderObj = update.message?.sender ?? update.sender;
    const senderName = senderObj?.name || senderObj?.username || 'неизвестен';
    const senderId = senderObj?.user_id ?? senderObj?.id ?? '';
    const senderStr = senderId ? `${senderName} (ID: ${senderId})` : senderName;

    const msgBody = update.message?.body as Record<string, unknown> | undefined;
    const messageText =
      (msgBody?.text as string) ??
      (update.message?.text as string) ??
      ((update as Record<string, unknown>).text as string) ??
      '—';

    // Required readable log format for incoming event
    const sourcePrefix = options?.isWebhook ? '[Webhook MAX]' : '[Событие MAX]';
    const summaryMsg =
      `${sourcePrefix} Тип: ${updateType} | Chat ID: ${chatId} | Отправитель: ${senderStr} | Текст: "${messageText}"`;

    if (updateType === 'message_created') {
      this.addLog('event', summaryMsg, update);
    } else {
      this.addLog('info', summaryMsg, update);
    }

    // Check if this event contains a summary command for our bot
    if (
      messageText &&
      messageText !== '—' &&
      (typeof rawChatId === 'string' || typeof rawChatId === 'number')
    ) {
      const activeBotUserId =
        this.botInfo?.user_id ?? this.botInfo?.id ?? BOT_USER_ID;
      const cmdInfo = parseSummaryCommand(
        messageText,
        this.botInfo?.username,
        activeBotUserId
      );

      if (cmdInfo && cmdInfo.isCommand) {
        // Run summary handler asynchronously without blocking polling or webhook response
        this.handleSummaryRequest(
          rawChatId,
          cmdInfo.requestedCount,
          messageText
        ).catch((err) => {
          this.addLog(
            'error',
            `Ошибка при обработке запроса на саммари: ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        });
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const globalForBot = globalThis as unknown as {
  maxBotServiceInstance?: MaxBotService;
};

export const maxBotService =
  globalForBot.maxBotServiceInstance || MaxBotService.getInstance();

if (process.env.NODE_ENV !== 'production') {
  globalForBot.maxBotServiceInstance = maxBotService;
}
