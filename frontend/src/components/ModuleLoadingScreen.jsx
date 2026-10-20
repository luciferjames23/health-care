import React, { useState, useEffect } from 'react';

/**
 * State-of-the-art Clinical Operations Loading Screen
 * Combines an active ECG/telemetry heartbeat monitor, dynamic data pipeline status,
 * and high-fidelity ambient frosted glass skeletons.
 */

export function TableSkeleton({ rows = 6, columns = 6 }) {
  const columnHeaders = ['Patient / UHID', 'Department / Ward', 'Attending Consultant', 'Status', 'Vitals / Care', 'Timeline'];
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.95)',
      border: '1px solid rgba(226, 232, 240, 0.8)',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.04)'
    }}>
      {/* Header skeleton with actual realistic clinical column labels */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: '12px',
        padding: '11px 18px',
        background: '#f8fafc',
        borderBottom: '1px solid #e2e8f0',
        alignItems: 'center'
      }}>
        {Array.from({ length: columns }).map((_, i) => (
          <span
            key={i}
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}
          >
            {columnHeaders[i % columnHeaders.length]}
          </span>
        ))}
      </div>

      {/* Row skeletons with soft, high-frequency subtle shimmer */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {Array.from({ length: rows }).map((_, rIdx) => (
          <div
            key={rIdx}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
              gap: '12px',
              padding: '14px 18px',
              borderBottom: rIdx === rows - 1 ? 'none' : '1px solid #f1f5f9',
              alignItems: 'center',
              background: rIdx % 2 === 0 ? '#ffffff' : '#fafbfc'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="hx-soft-shimmer" style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flex: 1 }}>
                <div className="hx-soft-shimmer" style={{ width: '75%', height: '12px', borderRadius: '4px' }} />
                <div className="hx-soft-shimmer" style={{ width: '45%', height: '9px', borderRadius: '3px' }} />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="hx-soft-shimmer" style={{ width: '65%', height: '12px', borderRadius: '4px' }} />
              <div className="hx-soft-shimmer" style={{ width: '40%', height: '9px', borderRadius: '3px' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="hx-soft-shimmer" style={{ width: '70%', height: '12px', borderRadius: '4px' }} />
            </div>

            <div>
              <div className="hx-soft-shimmer" style={{ width: '74px', height: '22px', borderRadius: '12px' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div className="hx-soft-shimmer" style={{ width: '55%', height: '12px', borderRadius: '4px' }} />
            </div>

            <div>
              <div className="hx-soft-shimmer" style={{ width: '50px', height: '11px', borderRadius: '4px' }} />
            </div>
          </div>
        ))}
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
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '10px',
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.03)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="hx-soft-shimmer" style={{ width: '80px', height: '12px', borderRadius: '4px' }} />
            <div className="hx-soft-shimmer" style={{ width: '24px', height: '24px', borderRadius: '6px' }} />
          </div>
          <div className="hx-soft-shimmer" style={{ width: '55%', height: '26px', borderRadius: '6px' }} />
          <div style={{ display: 'flex', gap: '6px' }}>
            <div className="hx-soft-shimmer" style={{ width: '40px', height: '14px', borderRadius: '4px' }} />
            <div className="hx-soft-shimmer" style={{ width: '60px', height: '14px', borderRadius: '4px' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ModuleLoadingScreen({
  title = "Loading Executive Dashboard...",
  subtitle = "Synthesising hospital census, ward occupancy, and operational metrics...",
  badgeText = "Live Operations Sync",
  showKpis = true,
  statCount = 5,
  layout = "table", // 'table' | 'cards' | 'compact'
  tableRows = 6,
  tableColumns = 6
}) {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    { label: 'Clinical Lakehouse Connection', status: 'Telemetry Active · 100%' },
    { label: 'Hospital Census & Bed Capacities', status: 'Synchronising live records...' },
    { label: 'Real-time AI Analytics & Forecasting', status: 'Assembling decision support...' }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep(prev => (prev + 1) % steps.length);
    }, 1800);
    return () => clearInterval(timer);
  }, [steps.length]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        animation: 'hx-fade-in 0.3s ease-out',
        width: '100%',
        paddingBottom: '24px'
      }}
    >
      <style>{`
        @keyframes hx-fade-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hx-soft-sweep {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes hx-heartbeat-glow {
          0%, 100% {
            box-shadow: 0 0 0 0 rgba(13, 148, 136, 0.4), 0 4px 14px rgba(13, 148, 136, 0.2);
            transform: scale(1);
          }
          50% {
            box-shadow: 0 0 0 10px rgba(13, 148, 136, 0), 0 6px 18px rgba(13, 148, 136, 0.35);
            transform: scale(1.04);
          }
        }
        @keyframes hx-radar-pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes hx-ecg-dash {
          0% { stroke-dashoffset: 400; }
          100% { stroke-dashoffset: 0; }
        }
        @keyframes hx-gradient-flow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .hx-soft-shimmer {
          background: linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%) !important;
          background-size: 200% 100% !important;
          animation: hx-soft-sweep 1.6s ease-in-out infinite !important;
        }
      `}</style>

      {/* Hero Clinical Telemetry Glassmorphic Card */}
      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 60%, #f0fdfa 100%)',
          border: '1px solid rgba(13, 148, 136, 0.25)',
          borderRadius: '14px',
          padding: '20px 24px',
          boxShadow: '0 8px 30px -4px rgba(13, 148, 136, 0.08), 0 2px 8px -2px rgba(15, 23, 42, 0.04)',
          overflow: 'hidden'
        }}
      >
        {/* Subtle background SVG ECG cardiogram waveform */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            bottom: 0,
            width: '45%',
            opacity: 0.18,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            overflow: 'hidden'
          }}
        >
          <svg
            viewBox="0 0 500 120"
            fill="none"
            style={{ width: '100%', height: '85px' }}
          >
            <path
              d="M0 60 L120 60 L140 30 L160 95 L180 15 L200 85 L220 60 L320 60 L340 30 L360 95 L380 15 L400 85 L420 60 L500 60"
              stroke="#0d9488"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="400"
              style={{ animation: 'hx-ecg-dash 3s linear infinite' }}
            />
          </svg>
        </div>

        {/* Top Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Glowing Medical Pulse Hub */}
            <div style={{ position: 'relative', width: '46px', height: '46px', flexShrink: 0 }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '12px',
                  background: 'rgba(13, 148, 136, 0.3)',
                  animation: 'hx-radar-pulse 2s cubic-bezier(0, 0, 0.2, 1) infinite'
                }}
              />
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  animation: 'hx-heartbeat-glow 2.2s infinite ease-in-out'
                }}
              >
                <svg
                  width="24"
                  height="24"
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
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.01em' }}>
                  {title}
                </h3>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '12.5px', color: '#64748b', lineHeight: 1.4 }}>
                {subtitle}
              </p>
            </div>
          </div>

          {/* Live Operations Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '20px',
                background: '#f0fdf4',
                border: '1px solid #86efac',
                fontSize: '11.5px',
                fontWeight: 600,
                color: '#15803d',
                boxShadow: '0 1px 3px rgba(34, 197, 94, 0.15)'
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 8px #22c55e',
                  display: 'inline-block'
                }}
              />
              {badgeText}
            </span>
          </div>
        </div>

        {/* Live Multi-Stage Telemetry Strip */}
        <div
          style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid rgba(226, 232, 240, 0.8)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            position: 'relative',
            zIndex: 1
          }}
        >
          {steps.map((st, idx) => {
            const isCurrent = activeStep === idx;
            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: isCurrent ? 'rgba(240, 253, 250, 0.95)' : 'rgba(255, 255, 255, 0.6)',
                  border: isCurrent ? '1px solid #99f6e4' : '1px solid #f1f5f9',
                  transition: 'all 0.3s ease'
                }}
              >
                <div
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: isCurrent ? '#0d9488' : '#cbd5e1',
                    boxShadow: isCurrent ? '0 0 8px #0d9488' : 'none'
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 600, color: isCurrent ? '#0f766e' : '#334155' }}>
                    {st.label}
                  </div>
                  <div style={{ fontSize: '10.5px', color: isCurrent ? '#0d9488' : '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {st.status}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Vibrant Gradient Progress Line */}
        <div style={{ marginTop: '14px', width: '100%', height: '4px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
          <div
            style={{
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, #0d9488 0%, #0284c7 50%, #38bdf8 100%)',
              backgroundSize: '200% 100%',
              animation: 'hx-soft-sweep 1.8s ease-in-out infinite'
            }}
          />
        </div>
      </div>

      {/* KPI Cards Strip Skeleton with Soft Ambient Tinting */}
      {showKpis && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(auto-fit, minmax(190px, 1fr))`,
            gap: '12px'
          }}
        >
          {[
            { label: 'Total Inpatients', color: '#0d9488' },
            { label: 'Bed Occupancy', color: '#0284c7' },
            { label: 'Scheduled Discharges', color: '#f59e0b' },
            { label: 'Emergency Arrivals', color: '#ef4444' },
            { label: 'Operating Capacity', color: '#8b5cf6' }
          ].slice(0, statCount).map((item, idx) => (
            <div
              key={idx}
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(226, 232, 240, 0.85)',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: '0 2px 8px -2px rgba(15, 23, 42, 0.03)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>{item.label}</span>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, opacity: 0.7 }} />
              </div>
              <div className="hx-soft-shimmer" style={{ width: '50%', height: '24px', borderRadius: '4px' }} />
              <div className="hx-soft-shimmer" style={{ width: '75%', height: '10px', borderRadius: '3px' }} />
            </div>
          ))}
        </div>
      )}

      {/* Main Content Area: High-Fidelity Table or Cards Skeleton */}
      {layout === 'table' ? (
        <TableSkeleton rows={tableRows} columns={tableColumns} />
      ) : layout === 'cards' ? (
        <CardGridSkeleton count={statCount || 5} />
      ) : (
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: '10px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          <div className="hx-soft-shimmer" style={{ width: '60%', height: '16px', borderRadius: '4px' }} />
          <div className="hx-soft-shimmer" style={{ width: '90%', height: '12px', borderRadius: '3px' }} />
          <div className="hx-soft-shimmer" style={{ width: '75%', height: '12px', borderRadius: '3px' }} />
        </div>
      )}
    </div>
  );
}
