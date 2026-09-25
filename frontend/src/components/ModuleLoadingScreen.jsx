import React from 'react';

/**
 * Modern, rich, glassmorphic loading screen and skeleton component for all modules
 * Provides an engaging clinical animation, pulsating metric placeholders,
 * and realistic shimmering table/card skeletons while data is being fetched.
 */

export function TableSkeleton({ rows = 6, columns = 7 }) {
  return (
    <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
      <style>{`
        @keyframes hx-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .hx-shimmer {
          background: linear-gradient(90deg, #e2e8f0 25%, #cbd5e1 50%, #e2e8f0 75%) !important;
          background-size: 200% 100% !important;
          animation: hx-shimmer 1.4s ease-in-out infinite !important;
        }
      `}</style>
      {/* Header skeleton */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: '12px',
        padding: '12px 16px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        alignItems: 'center'
      }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="hx-shimmer"
            style={{
              height: '11px',
              borderRadius: '4px',
              width: i === 0 ? '60%' : i === columns - 1 ? '40%' : '75%'
            }}
          />
        ))}
      </div>

      {/* Row skeletons */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {Array.from({ length: rows }).map((_, rIdx) => {
          const widths = ['70%', '85%', '50%', '65%', '80%', '45%', '90%', '60%'];
          return (
            <div
              key={rIdx}
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: '12px',
                padding: '13px 16px',
                borderBottom: rIdx === rows - 1 ? 'none' : '1px solid #f1f5f9',
                alignItems: 'center',
                background: rIdx % 2 === 0 ? '#ffffff' : '#fafafa'
              }}
            >
              {Array.from({ length: columns }).map((_, cIdx) => {
                const isFirst = cIdx === 0;
                const isStatus = cIdx === columns - 1;
                const isAvatar = cIdx === 1;

                if (isFirst) {
                  return (
                    <div key={cIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="hx-shimmer" style={{ width: '80px', height: '14px', borderRadius: '4px' }} />
                    </div>
                  );
                }

                if (isAvatar) {
                  return (
                    <div key={cIdx} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="hx-shimmer" style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                        <div className="hx-shimmer" style={{ width: '85%', height: '13px', borderRadius: '4px' }} />
                        <div className="hx-shimmer" style={{ width: '50%', height: '10px', borderRadius: '3px' }} />
                      </div>
                    </div>
                  );
                }

                if (isStatus) {
                  return (
                    <div key={cIdx} style={{ display: 'flex', justifyContent: 'flex-start' }}>
                      <div className="hx-shimmer" style={{ width: '70px', height: '22px', borderRadius: '12px' }} />
                    </div>
                  );
                }

                return (
                  <div
                    key={cIdx}
                    className="hx-shimmer"
                    style={{
                      height: '13px',
                      borderRadius: '4px',
                      width: widths[(rIdx + cIdx) % widths.length]
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 5 }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(210px, 1fr))`,
      gap: '12px'
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="hx-shimmer" style={{ width: '70px', height: '18px', borderRadius: '4px' }} />
            <div className="hx-shimmer" style={{ width: '24px', height: '16px', borderRadius: '4px' }} />
          </div>
          <div className="hx-shimmer" style={{ width: '100%', height: '56px', borderRadius: '6px' }} />
          <div className="hx-shimmer" style={{ width: '100%', height: '56px', borderRadius: '6px' }} />
        </div>
      ))}
    </div>
  );
}

export default function ModuleLoadingScreen({
  title = "Loading Module Data...",
  subtitle = "Retrieving live clinical & operational records...",
  badgeText = "Live Data Sync",
  showKpis = true,
  statCount = 4,
  layout = "table", // 'table' | 'cards' | 'compact'
  tableRows = 6,
  tableColumns = 7
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        animation: 'fadeIn 0.25s ease-in-out',
        width: '100%',
        paddingBottom: '24px'
      }}
    >
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.9; box-shadow: 0 0 0 0 rgba(2, 132, 199, 0.4); }
          50% { transform: scale(1.04); opacity: 1; box-shadow: 0 0 0 8px rgba(2, 132, 199, 0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spinSlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .hx-shimmer {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite ease-in-out;
        }
      `}</style>

      {/* Top Banner with Hospital Pulsing Spinner and Live Status */}
      <div
        style={{
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Animated Medical Cross / Heartbeat Pulse Icon */}
          <div
            style={{
              position: 'relative',
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)',
              animation: 'pulseGlow 2s infinite ease-in-out',
              flexShrink: 0
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                {title}
              </h3>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
              {subtitle}
            </p>
          </div>
        </div>

        {/* Live Status Pill & Indeterminate Progress Bar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '20px',
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              fontSize: '11px',
              fontWeight: 600,
              color: '#15803d'
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 6px #22c55e',
                display: 'inline-block'
              }}
            />
            {badgeText}
          </div>
          <div style={{ width: '120px', height: '3px', background: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
            <div
              className="hx-shimmer"
              style={{
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, #0284c7 0%, #38bdf8 50%, #0284c7 100%)'
              }}
            />
          </div>
        </div>
      </div>

      {/* KPI Cards Skeleton Strip */}
      {showKpis && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))`,
            gap: '12px'
          }}
        >
          {Array.from({ length: statCount }).map((_, idx) => (
            <div
              key={idx}
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="hx-shimmer" style={{ width: '55%', height: '11px', borderRadius: '3px' }} />
                <div className="hx-shimmer" style={{ width: '16px', height: '16px', borderRadius: '4px' }} />
              </div>
              <div className="hx-shimmer" style={{ width: '40%', height: '24px', borderRadius: '4px' }} />
              <div className="hx-shimmer" style={{ width: '70%', height: '10px', borderRadius: '3px' }} />
            </div>
          ))}
        </div>
      )}

      {/* Filter / Search Bar Skeleton */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '10px 14px'
        }}
      >
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flex: '1 1 240px' }}>
          <div className="hx-shimmer" style={{ width: '100%', maxWidth: '280px', height: '32px', borderRadius: '6px' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="hx-shimmer" style={{ width: '80px', height: '30px', borderRadius: '6px' }} />
          <div className="hx-shimmer" style={{ width: '90px', height: '30px', borderRadius: '6px' }} />
          <div className="hx-shimmer" style={{ width: '70px', height: '30px', borderRadius: '6px' }} />
        </div>
      </div>

      {/* Main Content Skeleton Area */}
      {layout === 'table' ? (
        <TableSkeleton rows={tableRows} columns={tableColumns} />
      ) : layout === 'cards' ? (
        <CardGridSkeleton count={statCount || 5} />
      ) : (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div className="hx-shimmer" style={{ width: '60%', height: '16px', borderRadius: '4px' }} />
          <div className="hx-shimmer" style={{ width: '90%', height: '12px', borderRadius: '3px' }} />
          <div className="hx-shimmer" style={{ width: '80%', height: '12px', borderRadius: '3px' }} />
        </div>
      )}
    </div>
  );
}
