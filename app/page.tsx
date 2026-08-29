'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, Play, Square, RefreshCw, Trash2, CheckCircle2, AlertTriangle, XCircle, ShieldCheck } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'event';
  message: string;
  rawJson?: string;
}

interface BotStatus {
  isRunning: boolean;
  hasToken: boolean;
  hasOpenAiKey?: boolean;
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
  const envBase = process.env.NEXT_PUBLIC_BASE_PATH || process.env.BASE_PATH;
  if (envBase && envBase !== '/') {
    const cleanBase = envBase.startsWith('/') ? envBase.replace(/\/$/, '') : `/${envBase.replace(/\/$/, '')}`;
    return `${cleanBase}${cleanPath}`;
  }
  if (typeof window !== 'undefined' && window.location.pathname.startsWith('/max')) {
    return `/max${cleanPath}`;
  }
  return cleanPath;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<BotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Poll for logs and status
  useEffect(() => {
    const fetchStatusAndLogs = async () => {
      try {
        const [statusRes, logsRes] = await Promise.all([
          fetch(getApiUrl('/api/bot/status')),
          fetch(getApiUrl('/api/bot/logs')),
        ]);

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

  const handleAction = async (action: 'start' | 'stop' | 'clear' | 'check') => {
    setLoading(true);
    try {
      const res = await fetch(getApiUrl('/api/bot/control'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
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
              MAX Bot API Server (Long Polling)
              {status?.isRunning ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-emerald-950/80 text-emerald-400 border border-emerald-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-400 border border-zinc-700">
                  Stopped
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-400">
              Host: <span className="font-mono text-zinc-300">https://platform-api2.max.ru</span> • Endpoint: <span className="font-mono text-zinc-300">GET /updates</span>
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

          <button
            onClick={() => handleAction('check')}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Проверить GET /me
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
            {status?.hasToken ? (
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
            {status?.hasOpenAiKey ? (
              <span className="text-emerald-400 font-mono inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> OPENAI_API_KEY OK
              </span>
            ) : (
              <span className="text-amber-400 font-mono inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> OPENAI_API_KEY не задан
              </span>
            )}
          </div>

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
              <p>Логи пусты. Нажмите «Запустить Long Polling» или отправьте сообщение боту в MAX.</p>
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
    </div>
  );
}
