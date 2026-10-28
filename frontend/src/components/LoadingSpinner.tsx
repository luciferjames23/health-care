import React from 'react';

export interface LoadingSpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  color?: string;
  trackColor?: string;
  thickness?: number;
  text?: string;
  label?: string;
  textPosition?: 'bottom' | 'right';
  inline?: boolean;
  overlay?: boolean;
  fullPage?: boolean;
  className?: string;
  style?: React.CSSProperties;
  textStyle?: React.CSSProperties;
  ariaLabel?: string;
}

const SIZE_MAP: Record<string, number> = {
  xs: 14,
  sm: 18,
  md: 28,
  lg: 40,
  xl: 56,
};

/**
 * Enterprise Medical-Grade Circular Loading Spinner
 * Unified, responsive, accessible, and high-performance SVG circular progress.
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  color = 'var(--primary, #0284c7)',
  trackColor = 'rgba(0, 0, 0, 0.08)',
  thickness,
  text,
  label,
  textPosition,
  inline = false,
  overlay = false,
  fullPage = false,
  className = '',
  style = {},
  textStyle = {},
  ariaLabel = 'Loading...',
}) => {
  const displayText = text || label;
  const pixelSize = typeof size === 'number' ? size : SIZE_MAP[size] || 28;

  // Auto-tune stroke thickness based on pixel dimensions
  const strokeWidth = thickness ?? (
    pixelSize <= 16 ? 2.2 :
    pixelSize <= 24 ? 2.8 :
    pixelSize <= 36 ? 3.4 : 4.0
  );

  const radius = 20;
  const circumference = 2 * Math.PI * radius; // ~125.66

  const resolvedTextPos = textPosition || (inline || pixelSize <= 20 ? 'right' : 'bottom');

  const spinnerSvg = (
    <svg
      viewBox="0 0 50 50"
      width={pixelSize}
      height={pixelSize}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        flexShrink: 0,
        animation: 'spin 0.8s linear infinite',
      }}
      aria-hidden="true"
    >
      {/* Background track circle */}
      <circle
        cx="25"
        cy="25"
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
      />
      {/* Dynamic rotating arc */}
      <circle
        cx="25"
        cy="25"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * 0.3} // ~70% active arc
      />
    </svg>
  );

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={`unified-loading-spinner ${className}`}
      style={{
        display: inline ? 'inline-flex' : 'flex',
        flexDirection: resolvedTextPos === 'bottom' ? 'column' : 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: resolvedTextPos === 'bottom' ? '10px' : '8px',
        ...style,
      }}
    >
      {spinnerSvg}
      {displayText ? (
        <span
          style={{
            fontSize: pixelSize <= 16 ? '12px' : pixelSize <= 28 ? '13px' : '14px',
            fontWeight: 500,
            color: 'var(--text-secondary, #475569)',
            letterSpacing: '0.01em',
            lineHeight: 1.3,
            ...textStyle,
          }}
        >
          {displayText}
        </span>
      ) : (
        <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0 }}>
          {ariaLabel}
        </span>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(3px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {content}
      </div>
    );
  }

  if (overlay) {
    return (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(255, 255, 255, 0.72)',
          backdropFilter: 'blur(1.5px)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 'inherit',
          padding: '16px',
        }}
      >
        {content}
      </div>
    );
  }

  return content;
};

/**
 * Convenient in-button spinner helper
 */
export const ButtonSpinner: React.FC<{ size?: number; color?: string; style?: React.CSSProperties }> = ({
  size = 14,
  color = 'currentColor',
  style = {},
}) => (
  <LoadingSpinner
    inline
    size={size}
    color={color}
    trackColor="rgba(255, 255, 255, 0.25)"
    style={{ marginRight: 6, ...style }}
  />
);

/**
 * Convenient table/card overlay spinner helper
 */
export const TableLoadingOverlay: React.FC<{ text?: string; size?: 'sm' | 'md' | 'lg' }> = ({
  text = 'Loading records...',
  size = 'md',
}) => (
  <LoadingSpinner
    overlay
    size={size}
    text={text}
  />
);

export default LoadingSpinner;
