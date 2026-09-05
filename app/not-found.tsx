import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-bold mb-2">404 - Страница не найдена</h2>
      <p className="text-zinc-400 mb-4">Запрашиваемый ресурс не найден.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-sm transition-colors"
      >
        На главную
      </Link>
    </div>
  );
}
