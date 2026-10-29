export function Footer() {
  return (
    <footer className="no-print mt-12 border-t border-[var(--border-ui)] bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-[var(--muted-fg)] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} События — курсовая работа</p>
        <p>Платформа управления мероприятиями и бронирования билетов</p>
      </div>
    </footer>
  );
}
