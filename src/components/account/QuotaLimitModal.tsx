import React from 'react';
import { QuotaExceededDetail, formatResetDate } from '../../utils/quota';

interface QuotaLimitModalProps {
  detail: QuotaExceededDetail;
  isLightTheme: boolean;
  onClose: () => void;
}

// Красивое модальное окно «лимит исчерпан» вместо браузерного alert().
const QuotaLimitModal: React.FC<QuotaLimitModalProps> = ({ detail, isLightTheme, onClose }) => {
  const what = detail.kind === 'explain' ? 'объяснений' : 'генераций';
  const reset = formatResetDate(detail.next_reset_at);
  const accent = '#6366f1';

  const headingColor = isLightTheme ? '#2a1e1f' : '#f5ede8';
  const mutedColor = isLightTheme ? 'rgba(42,30,31,0.65)' : 'rgba(245,237,232,0.6)';
  const cardBorder = isLightTheme ? '1px solid rgba(0,0,0,0.08)' : '1px solid rgba(255,255,255,0.08)';
  const btnBg = isLightTheme ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.08)';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl p-6 max-w-md w-full"
        style={{
          background: isLightTheme ? 'rgba(255,255,240,.98)' : 'rgba(33,24,25,.97)',
          border: cardBorder,
          boxShadow: '0 40px 140px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Иконка + заголовок */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{ width: 44, height: 44, background: 'rgba(99,102,241,0.12)', color: accent }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 26 }}>bolt</span>
          </div>
          <div>
            <h2 className="text-lg font-semibold leading-tight" style={{ color: headingColor }}>
              Лимит {what} исчерпан
            </h2>
            <p className="text-xs mt-0.5" style={{ color: mutedColor }}>
              Тариф {detail.tier === 'pro' ? 'Pro' : 'Free'}
            </p>
          </div>
        </div>

        {/* Счётчик использования */}
        <div className="mb-4">
          <div className="flex justify-between items-baseline mb-1.5">
            <span className="text-sm" style={{ color: headingColor }}>Использовано в этом периоде</span>
            <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>
              {detail.used} / {detail.limit}
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: btnBg }}>
            <div className="h-full rounded-full" style={{ width: '100%', background: '#ef4444' }} />
          </div>
        </div>

        {/* Когда освободится слот */}
        {reset && (
          <p className="text-sm mb-2" style={{ color: mutedColor }}>
            <span className="material-symbols-outlined align-middle mr-1" style={{ fontSize: 16 }}>schedule</span>
            Ближайший слот освободится <span style={{ color: headingColor, fontWeight: 600 }}>{reset}</span>
          </p>
        )}

        {/* Подсказка про Pro */}
        {detail.tier === 'free' && (
          <div
            className="rounded-xl p-3 mb-5 text-sm"
            style={{ background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.25)', color: headingColor }}
          >
            <span className="font-semibold" style={{ color: accent }}>Нужно больше?</span>{' '}
            Тариф Pro повышает лимит. Обратитесь к администратору, чтобы его подключить.
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-lg text-sm font-medium transition-all"
          style={{ background: accent, color: '#fff' }}
        >
          Понятно
        </button>
      </div>
    </div>
  );
};

export default QuotaLimitModal;
