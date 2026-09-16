import React, { useEffect } from 'react';

export default function DetailDrawer({ drawer, onClose, onAction }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!drawer) return null;

  const {
    title = 'Record Details',
    sub = 'Governed Clinical / Operational Record',
    badges = [],
    facts = [],
    sections = [],
    actions = [],
    image = null
  } = drawer;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(21, 24, 27, 0.32)',
          backdropFilter: 'blur(2px)',
          zIndex: 1050,
          animation: 'fadeIn 0.18s ease-out'
        }}
      />

      {/* Slide-over Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(540px, 94vw)',
          background: '#ffffff',
          borderLeft: '1px solid #e3e6e8',
          zIndex: 1051,
          overflowY: 'auto',
          padding: '20px 24px 44px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          boxShadow: '-10px 0 32px rgba(15, 23, 42, 0.14)',
          animation: 'drawerSlideIn 0.22s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', lineHeight: 1.25, letterSpacing: '-0.01em' }}>
              {title}
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginTop: '3px', fontWeight: 500 }}>
              {sub}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              height: '30px',
              width: '30px',
              borderRadius: '6px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#64748b',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            ✕
          </button>
        </div>

        {/* Badges */}
        {badges.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {badges.map((b, i) => (
              <span
                key={i}
                style={{
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: 700,
                  background: b.bg || '#eef2f6',
                  color: b.fg || '#1e293b',
                  letterSpacing: '0.02em'
                }}
              >
                {b.t || b.text || b.label}
              </span>
            ))}
          </div>
        )}

        {/* Optional Image or Visual Preview */}
        {image && (
          <div
            style={{
              height: '180px',
              borderRadius: '8px',
              background: '#15181b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#e2e8f0',
              fontSize: '12px',
              fontWeight: 600,
              fontFamily: 'ui-monospace, Menlo, monospace',
              overflow: 'hidden',
              border: '1px solid #334155'
            }}
          >
            {image}
          </div>
        )}

        {/* Key-Value Facts Grid */}
        {facts.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '130px minmax(0, 1fr)',
              gap: '8px 12px',
              fontSize: '12.5px',
              background: '#f8fafc',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}
          >
            {facts.map((f, i) => (
              <React.Fragment key={i}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>{f.k || f.label}:</span>
                <span style={{ color: f.c || '#0f172a', fontWeight: f.b ? 700 : 500, wordBreak: 'break-word', lineHeight: 1.4 }}>
                  {f.v || f.value || '—'}
                </span>
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Additional Sections */}
        {sections.map((sec, idx) => (
          <div
            key={idx}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '14px',
              background: '#ffffff'
            }}
          >
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>🔹</span> {sec.title}
            </div>
            {sec.text && (
              <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
                {sec.text}
              </div>
            )}
            {sec.items && Array.isArray(sec.items) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                {sec.items.map((item, itemIdx) => (
                  <div key={itemIdx} style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px dashed #f1f5f9' }}>
                    <span style={{ color: '#64748b' }}>{item.k || item.label || item}</span>
                    <span style={{ fontWeight: 600, color: item.c || '#0f172a' }}>{item.v || item.value || ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Drawer Actions */}
        {actions.length > 0 && (
          <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {actions.map((act, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (act.on) act.on();
                  if (onAction) onAction(act);
                }}
                disabled={act.disabled}
                style={{
                  height: '34px',
                  padding: '0 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: act.disabled ? 'not-allowed' : 'pointer',
                  opacity: act.disabled ? 0.6 : 1,
                  border: act.primary ? 'none' : '1px solid #cbd5e1',
                  background: act.danger ? '#ef4444' : act.primary ? 'oklch(0.5 0.1 200)' : '#ffffff',
                  color: act.primary || act.danger ? '#ffffff' : '#334155',
                  boxShadow: act.primary ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
                }}
              >
                {act.label}
              </button>
            ))}
          </div>
        )}
      </aside>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes drawerSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
