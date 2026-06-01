import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { fetchQuota, onQuotaChanged, QuotaBucket, QuotaKind } from '../../utils/quota';

interface QuotaBadgeProps {
  kind: QuotaKind;
  className?: string;
}

const LABEL: Record<QuotaKind, string> = {
  generation: 'генераций',
  explain: 'объяснений',
};

// Маленький бейдж «осталось N/L генераций» со скользящим окном 30 дней.
// Сам подтягивает квоту и слушает событие mindesync:quota-changed.
const QuotaBadge: React.FC<QuotaBadgeProps> = ({ kind, className }) => {
  const { token, user } = useAuth();
  const [bucket, setBucket] = useState<QuotaBucket | null>(null);

  const refresh = useCallback(async () => {
    const q = await fetchQuota(token);
    if (q) setBucket(q[kind]);
  }, [token, kind]);

  useEffect(() => {
    refresh();
    return onQuotaChanged(refresh);
  }, [refresh]);

  // Админ — без лимита, бейдж не нужен.
  if (user?.role === 'admin' || !bucket || bucket.unlimited || bucket.limit === null) {
    return null;
  }

  const remaining = bucket.remaining ?? 0;
  const tier = user?.subscription_tier === 'pro' ? 'Pro' : 'Free';
  const danger = remaining <= 0;
  const warn = !danger && remaining <= 1;

  const color = danger
    ? { bg: 'rgba(239,68,68,0.12)', fg: '#ef4444', bd: 'rgba(239,68,68,0.3)' }
    : warn
    ? { bg: 'rgba(245,158,11,0.12)', fg: '#f59e0b', bd: 'rgba(245,158,11,0.3)' }
    : { bg: 'rgba(99,102,241,0.12)', fg: '#6366f1', bd: 'rgba(99,102,241,0.3)' };

  return (
    <span
      className={className}
      title={`Тариф ${tier}: осталось ${remaining} из ${bucket.limit} ${LABEL[kind]} (окно 30 дней)`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: color.bg,
        color: color.fg,
        border: `1px solid ${color.bd}`,
        whiteSpace: 'nowrap',
      }}
    >
      ⚡ {remaining}/{bucket.limit} {LABEL[kind]}
    </span>
  );
};

export default QuotaBadge;
