import { neonConfig, Pool as NeonPool } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

neonConfig.webSocketConstructor = undefined;

/**
 * Пул соединений. Схема одна и та же, но драйверы разные:
 *  - Neon требует WebSocket-транспорт (@neondatabase/serverless);
 *  - всё остальное (Supabase, обычный PostgreSQL) работает через node-postgres.
 * Выбор делается по строке подключения.
 */
export interface DbPool {
  connect(): Promise<{
    query: <T = Record<string, unknown>>(
      text: string,
      values?: unknown[],
    ) => Promise<{ rows: T[]; rowCount: number | null }>;
    release: () => void;
  }>;
  end(): Promise<void>;
}

declare global {
  var __dbPool: DbPool | undefined;
}

function isNeonUrl(url: string): boolean {
  return url.includes('neon.tech') || url.includes('neon.build');
}

/**
 * Решает, нужен ли TLS, по строке подключения.
 *
 * Управляемые базы (Neon, Supabase, RDS) требуют шифрования, но в их строке
 * подключения параметр `sslmode=require` может отсутствовать — особенно у Supabase.
 * Локальный PostgreSQL, наоборот, SSL обычно не поддерживает вовсе, и принудительное
 * включение обрывает соединение ошибкой «The server does not support SSL connections».
 *
 * Поэтому: явный sslmode в URL уважается всегда; если его нет, TLS включается
 * для удалённых хостов и выключается для localhost.
 */
function resolveSsl(url: string): { rejectUnauthorized: boolean } | undefined {
  const sslmode = /[?&]sslmode=([a-z]+)/.exec(url)?.[1];
  if (sslmode) {
    if (sslmode === 'disable') return undefined;
    return { rejectUnauthorized: false };
  }
  const host = /^[a-z+]+:\/\/[^@/]*@?([^:/?]+)/i.exec(url)?.[1] ?? '';
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '';
  if (isLocal) return undefined;
  // Сертификаты managed-провайдеров самоподписанные, системную проверку не проходят.
  return { rejectUnauthorized: false };
}

function createPool(): DbPool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL не задан. Скопируйте .env.example в .env.local и укажите строку подключения к PostgreSQL (Supabase или Neon).',
    );
  }
  if (isNeonUrl(url)) {
    return new NeonPool({ connectionString: url, max: 5 }) as unknown as DbPool;
  }
  const pool = new PgPool({
    connectionString: url,
    max: 5,
    ssl: resolveSsl(url),
  });
  return pool as unknown as DbPool;
}

/** Пул создаётся лениво, чтобы `next build` не требовал переменные окружения. */
export function getPool(): DbPool {
  if (!globalThis.__dbPool) {
    globalThis.__dbPool = createPool();
  }
  return globalThis.__dbPool;
}

type Db = ReturnType<typeof drizzleNeon<typeof schema>> | ReturnType<typeof drizzleNode<typeof schema>>;

let cached: Db | null = null;

function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL ?? '';
    const pool = getPool();
    cached = isNeonUrl(url)
      ? drizzleNeon(pool as unknown as NeonPool, { schema })
      : drizzleNode(pool as unknown as PgPool, { schema });
  }
  return cached;
}

/**
 * Прокси даёт ленивую инициализацию соединения: `db` можно импортировать на этапе
 * сборки, а пул создастся только при первом реальном SQL-запросе.
 */
export const db: Db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const instance = getDb() as unknown as Record<string | symbol, unknown>;
    const value = Reflect.get(instance, prop, receiver);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});

export type Database = Db;
export { schema };
