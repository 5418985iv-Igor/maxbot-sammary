'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Play,
  Square,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Radio,
  Send,
  ArrowDownToLine,
  Link2,
} from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'event';
  message: string;
  rawJson?: string;
}

interface MaxSubscriptionItem {
  url: string;
  time: number;
  update_types?: string[];
  [key: string]: unknown;
}

interface BotStatus {
  isRunning: boolean;
  hasToken: boolean;
  hasOpenAiKey?: boolean;
  hasWebhookSecret?: boolean;
  webhookUrl?: string;
  subscriptions?: MaxSubscriptionItem[];
  botInfo: {
    user_id?: number | string;
    id?: number | string;
    name?: string;
    username?: string;
  } | null;
  marker: number | string | null;
  logCount: number;
}

function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;

  // 1. If running in browser and pathname starts with /max, use /max
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/max')) {
    return `/max${cleanPath}`;
  }

  // 2. Sanitize environment variables (strip quotes)
  const rawBase =
    process.env.NEXT_PUBLIC_BASE_PATH ||
    process.env.BASE_PATH ||
    '/max';
  const cleaned = rawBase.replace(/^["']+|["']+$/g, '').trim();

  if (cleaned && cleaned !== '/') {
    const withSlash = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
    return `${withSlash.replace(/\/+$/, '')}${cleanPath}`;
  }

  return `/max${cleanPath}`;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [testText, setTestText] = useState('саммари 10');
  const [showTestModal, setShowTestModal] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Poll for logs and status
  useEffect(() => {
    const fetchStatusAndLogs = async () => {
      try {
        const primaryStatusUrl = getApiUrl('/api/bot/status');
        let statusRes = await fetch(primaryStatusUrl);
        if (!statusRes.ok && statusRes.status === 404) {
          const fallbackUrl = primaryStatusUrl.startsWith('/max')
            ? '/api/bot/status'
            : '/max/api/bot/status';
          const fallbackRes = await fetch(fallbackUrl);
          if (fallbackRes.ok) statusRes = fallbackRes;
        }

        const primaryLogsUrl = getApiUrl('/api/bot/logs');
        let logsRes = await fetch(primaryLogsUrl);
        if (!logsRes.ok && logsRes.status === 404) {
          const fallbackUrl = primaryLogsUrl.startsWith('/max')
            ? '/api/bot/logs'
            : '/max/api/bot/logs';
          const fallbackRes = await fetch(fallbackUrl);
          if (fallbackRes.ok) logsRes = fallbackRes;
        }

        if (statusRes.ok) {
          const statusData = await statusRes.json();
          setStatus(statusData);
        }
        if (logsRes.ok) {
          const logsData = await logsRes.json();
          setLogs(logsData.logs || []);
        }
      } catch (err) {
        console.error('Failed to fetch bot data', err);
      }
    };

    fetchStatusAndLogs();
    const interval = setInterval(fetchStatusAndLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const handleAction = async (
    action:
      | 'start'
      | 'stop'
      | 'clear'
      | 'check'
      | 'check_subscriptions'
      | 'register_webhook'
      | 'delete_webhook'
      | 'test_webhook'
      | 'sync_production_logs',
    extra?: Record<string, unknown>
  ) => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/bot/control'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Ошибка: ${data.error || 'Не удалось выполнить действие'}`);
      }
      // Refresh immediately
      const [statusRes, logsRes] = await Promise.all([
        fetch(getApiUrl('/api/bot/status')),
        fetch(getApiUrl('/api/bot/logs')),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (logsRes.ok) setLogs((await logsRes.json()).logs || []);
    } catch (err) {
      alert(`Ошибка сети: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  const getLevelBadge = (level: LogEntry['level']) => {
    switch (level) {
      case 'event':
        return <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-950 text-blue-400 border border-blue-800">EVENT</span>;
      case 'success':
        return <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">OK</span>;
      case 'warn':
        return <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-amber-950 text-amber-400 border border-amber-800">WARN</span>;
      case 'error':
        return <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-rose-950 text-rose-400 border border-rose-800">ERROR</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-zinc-800 text-zinc-400 border border-zinc-700">INFO</span>;
    }
  };

  const activeSub = status?.subscriptions && status.subscriptions.length > 0 ? status.subscriptions[0] : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white">
      {/* Header bar */}
      <header className="border-b border-zinc-800 bg-zinc-900/60 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
              MAX Bot API Server
              {status?.isRunning ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-emerald-950/80 text-emerald-400 border border-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active (Long Polling)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-emerald-950/40 text-emerald-300 border border-emerald-800/60">
                  Webhook Ready
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-400">
              Host: <span className="font-mono text-zinc-300">https://platform-api2.max.ru</span> • Webhook: <span className="font-mono text-emerald-400">{status?.webhookUrl || 'https://vivonline.ru/max/webhook/max'}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {!status?.isRunning ? (
            <button
              onClick={() => handleAction('start')}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5" />
              Запустить Long Polling
            </button>
          ) : (
            <button
              onClick={() => handleAction('stop')}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-50"
            >
              <Square className="w-3.5 h-3.5" />
              Остановить
            </button>
          )}

          {/* Webhook API check */}
          <button
            onClick={() => handleAction('check_subscriptions')}
            disabled={loading}
            title="Проверить активные подписки Webhook в MAX API"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-blue-900/50 hover:bg-blue-800/70 text-blue-200 border border-blue-700/60 transition-colors disabled:opacity-50"
          >
            <Radio className="w-3.5 h-3.5 text-blue-400" />
            Проверить Webhook (MAX)
          </button>

          {/* Test Webhook */}
          <button
            onClick={() => setShowTestModal(true)}
            disabled={loading}
            title="Отправить симулированное сообщение webhook"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border border-emerald-800/60 transition-colors disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            Тест Webhook
          </button>

          {/* Sync production logs from vivonline.ru */}
          <button
            onClick={() => handleAction('sync_production_logs')}
            disabled={loading}
            title="Загрузить недавние логи с сервера vivonline.ru"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors disabled:opacity-50"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            Логи vivonline.ru
          </button>

          <button
            onClick={() => handleAction('check')}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            GET /me
          </button>

          <button
            onClick={() => handleAction('clear')}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 transition-colors disabled:opacity-50"
            title="Очистить лог"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Очистить
          </button>
        </div>
      </header>

      {/* Bot info & status bar */}
      <div className="px-6 py-2.5 bg-zinc-900 border-b border-zinc-800 text-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">MAX:</span>
            {status === null ? (
              <span className="text-zinc-400 font-mono inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" /> Проверка...
              </span>
            ) : status.hasToken ? (
              <span className="text-emerald-400 font-mono inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> MAX_BOT_TOKEN OK
              </span>
            ) : (
              <span className="text-amber-400 font-mono inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> MAX_BOT_TOKEN не задан
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500">OpenAI:</span>
            {status === null ? (
              <span className="text-zinc-400 font-mono inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" /> Проверка...
              </span>
            ) : status.hasOpenAiKey ? (
              <span className="text-emerald-400 font-mono inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> OPENAI_API_KEY OK
              </span>
            ) : (
              <span className="text-amber-400 font-mono inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> OPENAI_API_KEY не задан
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500">Webhook Эндпоинт:</span>
            <span className="text-emerald-400 font-mono inline-flex items-center gap-1" title={status?.webhookUrl || '/max/webhook/max'}>
              <CheckCircle2 className="w-3 h-3" /> 200 OK готов
            </span>
            {status?.hasWebhookSecret ? (
              <span className="text-zinc-400 font-mono text-[11px]">(Секрет включен)</span>
            ) : (
              <span className="text-zinc-500 font-mono text-[11px]">(Секрет отключен)</span>
            )}
          </div>

          {activeSub && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">MAX Подписка:</span>
              <span className="text-blue-400 font-mono text-[11px] bg-blue-950/60 px-2 py-0.5 rounded border border-blue-800">
                {activeSub.url}
              </span>
            </div>
          )}

          {status?.botInfo && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Бот:</span>
              <span className="text-zinc-200 font-medium">
                {status.botInfo.name || status.botInfo.username || 'Бот'}
              </span>
              <span className="font-mono text-zinc-400">
                (ID: {String(status.botInfo.user_id ?? status.botInfo.id ?? '—')})
              </span>
            </div>
          )}

          {status?.marker !== null && status?.marker !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">Текущий marker:</span>
              <span className="font-mono text-zinc-300 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700">
                {String(status.marker)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-zinc-400 hover:text-zinc-300">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-zinc-800 border-zinc-700 text-emerald-500 focus:ring-0"
            />
            Автоскролл
          </label>
          <span className="text-zinc-500">Записей: {logs.length}</span>
        </div>
      </div>

      {/* Main Terminal / Log View */}
      <main className="flex-1 p-6 overflow-hidden flex flex-col">
        <div className="flex-1 bg-black border border-zinc-800 rounded-lg p-4 font-mono text-xs overflow-y-auto flex flex-col gap-2 shadow-inner">
          {logs.length === 0 ? (
            <div className="text-zinc-500 flex flex-col items-center justify-center h-full gap-2">
              <Terminal className="w-8 h-8 opacity-40" />
              <p>Логи пусты. Нажмите «Запустить Long Polling», «Тест Webhook» или отправьте команду боту в MAX.</p>
              {!status?.hasToken && (
                <p className="text-amber-400/80 text-[11px]">
                  * Убедитесь, что переменная <span className="font-bold">MAX_BOT_TOKEN</span> задана в .env или в окружении.
                </p>
              )}
            </div>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.id}
                className="flex flex-col gap-1 py-1 border-b border-zinc-900/80 last:border-0 hover:bg-zinc-900/40 px-2 rounded transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <span className="text-zinc-500 shrink-0 select-none">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <div className="shrink-0">{getLevelBadge(entry.level)}</div>
                  <span
                    className={`flex-1 break-words leading-relaxed ${
                      entry.level === 'error'
                        ? 'text-rose-300 font-semibold'
                        : entry.level === 'event'
                        ? 'text-blue-300'
                        : entry.level === 'success'
                        ? 'text-emerald-300'
                        : entry.level === 'warn'
                        ? 'text-amber-300'
                        : 'text-zinc-300'
                    }`}
                  >
                    {entry.message}
                  </span>
                </div>

                {entry.rawJson && (
                  <details className="mt-1 ml-6 text-zinc-400">
                    <summary className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-300 select-none">
                      ▶ Полный JSON события (нажмите для просмотра)
                    </summary>
                    <pre className="mt-1.5 p-3 rounded bg-zinc-950 border border-zinc-800 text-zinc-300 overflow-x-auto text-[11px] leading-snug">
                      {entry.rawJson}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </main>

      {/* Modal for Webhook testing */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Send className="w-4 h-4 text-emerald-400" />
                Тестирование входящего Webhook
              </h3>
              <button
                onClick={() => setShowTestModal(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400">
              Это действие сымитирует доставку вебхука <code className="text-emerald-400">message_created</code> в приложение, запустит чтение истории, вызов OpenAI gpt-5.4-mini и отправку саммари в чат MAX.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-300 font-medium">Текст команды:</label>
              <input
                type="text"
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder="саммари 10"
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                onClick={() => setShowTestModal(false)}
                className="px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-zinc-200"
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  setShowTestModal(false);
                  await handleAction('test_webhook', { text: testText });
                }}
                className="px-4 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
              >
                Отправить тест
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
