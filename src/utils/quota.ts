// Клиентские утилиты для системы лимитов («подписок»).
// Бэкенд: GET /api/users/me/quota + 429 quota_exceeded.

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export type QuotaKind = 'generation' | 'explain';

export interface QuotaBucket {
  kind: QuotaKind;
  limit: number | null;       // null = без лимита (админ)
  used: number;
  remaining: number | null;   // null = без лимита
  unlimited: boolean;
  next_reset_at: string | null;
}

export interface QuotaInfo {
  tier: 'free' | 'pro';
  generation: QuotaBucket;
  explain: QuotaBucket;
}

export interface QuotaExceededDetail {
  code: 'quota_exceeded';
  kind: QuotaKind;
  tier: 'free' | 'pro';
  limit: number;
  used: number;
  remaining: number;
  next_reset_at: string | null;
}

export async function fetchQuota(token: string | null): Promise<QuotaInfo | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/api/users/me/quota`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as QuotaInfo;
  } catch {
    return null;
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  } catch {
    return '';
  }
}

// true, если detail — это структурированный ответ о превышении лимита.
export function isQuotaExceeded(detail: unknown): detail is QuotaExceededDetail {
  return (
    typeof detail === 'object' &&
    detail !== null &&
    (detail as { code?: string }).code === 'quota_exceeded'
  );
}

// Дружелюбное сообщение для модалки/алерта при 429.
export function formatQuotaError(detail: QuotaExceededDetail): string {
  const what = detail.kind === 'explain' ? 'объяснений' : 'генераций';
  const when = fmtDate(detail.next_reset_at);
  const tail = when ? ` Ближайший слот освободится ${when}.` : '';
  const upgrade = detail.tier === 'free' ? ' Оформите тариф Pro, чтобы увеличить лимит.' : '';
  return `Достигнут месячный лимит ${what} (${detail.used}/${detail.limit}).${tail}${upgrade}`;
}

// Разбирает ответ fetch: если это 429-квота — возвращает готовое сообщение,
// иначе null (обрабатывайте как обычную ошибку).
export async function quotaMessageFromResponse(res: Response): Promise<string | null> {
  if (res.status !== 429) return null;
  const body = await res.json().catch(() => null);
  const detail = body?.detail;
  if (isQuotaExceeded(detail)) return formatQuotaError(detail);
  return null;
}

// Простой шина-событие, чтобы бейджи обновлялись после расхода/возврата слота.
const QUOTA_EVENT = 'mindesync:quota-changed';
export function notifyQuotaChanged(): void {
  window.dispatchEvent(new Event(QUOTA_EVENT));
}
export function onQuotaChanged(handler: () => void): () => void {
  window.addEventListener(QUOTA_EVENT, handler);
  return () => window.removeEventListener(QUOTA_EVENT, handler);
}
