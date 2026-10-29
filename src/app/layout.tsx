import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { ToastProvider } from '@/components/ui/toast';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import './globals.css';

// Inter с кириллицей подключается локально (@fontsource/inter), чтобы сборка
// не зависела от доступности Google Fonts.
const inter = localFont({
  src: [
    { path: '../../node_modules/@fontsource/inter/files/inter-cyrillic-400-normal.woff2', weight: '400' },
    { path: '../../node_modules/@fontsource/inter/files/inter-cyrillic-500-normal.woff2', weight: '500' },
    { path: '../../node_modules/@fontsource/inter/files/inter-cyrillic-600-normal.woff2', weight: '600' },
    { path: '../../node_modules/@fontsource/inter/files/inter-cyrillic-700-normal.woff2', weight: '700' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', weight: '400' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff2', weight: '500' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', weight: '600' },
    { path: '../../node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2', weight: '700' },
  ],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: {
    default: 'События — бронирование билетов',
    template: '%s — События',
  },
  description: 'Платформа мероприятий: конференции, концерты, мастер-классы и магия',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={inter.variable}>
      <body className="flex min-h-screen flex-col antialiased">
        <ToastProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </ToastProvider>
      </body>
    </html>
  );
}
