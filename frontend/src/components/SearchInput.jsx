import React from 'react';

/**
 * Universal Search Input with Live Loading Spinner and Clear button.
 * Provides clear visual feedback across all platform searches.
 */
export default function SearchInput({
  value = '',
  onChange,
  onClear,
  placeholder = 'Search...',
  loading = false,
  width = '280px',
  height = '32px',
  accentColor = '#0284c7',
  style = {},
  inputStyle = {},
  autoFocus = false,
  id,
  className
}) {
  const handleClear = () => {
    if (onClear) {
      onClear();
    } else if (onChange) {
      onChange({ target: { value: '' } });
    }
  };

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: width,
        maxWidth: '100%',
        ...style
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: '10px',
          color: '#94a3b8',
          fontSize: '13px',
          pointerEvents: 'none',
          lineHeight: 1,
          zIndex: 1
        }}
      >
        🔍
      </span>

      <input
        id={id}
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          height: height,
          width: '100%',
          border: loading ? `1px solid ${accentColor}` : '1px solid #cbd5e1',
          borderRadius: '6px',
          padding: '0 34px 0 30px',
          fontSize: '12px',
          outline: 'none',
          background: '#ffffff',
          color: '#1e293b',
          boxShadow: loading ? `0 0 0 2px ${accentColor}26` : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          ...inputStyle
        }}
      />

      {loading && (
        <span
          style={{
            position: 'absolute',
            right: value ? '26px' : '10px',
            display: 'inline-block',
            width: '14px',
            height: '14px',
            border: `2px solid ${accentColor}`,
            borderTopColor: 'transparent',
            borderRadius: '50%',
            animation: 'spin 0.6s linear infinite',
            zIndex: 2
          }}
          title="Searching database records..."
        />
      )}

      {value && (
        <button
          type="button"
          onClick={handleClear}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '2px 4px',
            lineHeight: 1,
            zIndex: 3
          }}
          title="Clear search"
          aria-label="Clear search"
        >
          ✕
        </button>
      )}
    </div>
  );
}
