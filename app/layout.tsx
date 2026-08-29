import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'MAX Bot Long Polling Server',
  description: 'Minimal server application for MAX Bot API with Long Polling, chat history extraction, and OpenAI gpt-5.4-mini summary generator.',
  openGraph: {
    title: 'MAX Bot Long Polling Server',
    description: 'Minimal server application for MAX Bot API with Long Polling, chat history extraction, and OpenAI gpt-5.4-mini summary generator.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MAX Bot Long Polling Server',
    description: 'Minimal server application for MAX Bot API with Long Polling, chat history extraction, and OpenAI gpt-5.4-mini summary generator.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
