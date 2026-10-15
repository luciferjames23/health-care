import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';

export function toYMD(d) {
  if (!d) return '';
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatFriendlyDate(ymd) {
  if (!ymd) return '';
  const parts = String(ymd).split('-');
  if (parts.length !== 3) return ymd;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function calculateDateRange(preset, customFrom, customTo) {
  const now = new Date();
  const todayYMD = toYMD(now);

  switch (preset) {
    case 'all_time':
      return { from: '', to: '', label: 'All Time' };
    case 'today':
      return { from: todayYMD, to: todayYMD, label: `Today (${formatFriendlyDate(todayYMD)})` };
    case 'yesterday': {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const yYMD = toYMD(y);
      return { from: yYMD, to: yYMD, label: `Yesterday (${formatFriendlyDate(yYMD)})` };
    }
    case 'tomorrow': {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      const tYMD = toYMD(t);
      return { from: tYMD, to: tYMD, label: `Tomorrow (${formatFriendlyDate(tYMD)})` };
    }
    case 'this_week': {
      const day = now.getDay();
      const diff = (day + 6) % 7;
      const monday = new Date(now);
      monday.setDate(monday.getDate() - diff);
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const f = toYMD(monday);
      const to = toYMD(sunday);
      return { from: f, to, label: `This Week (${formatFriendlyDate(f)} – ${formatFriendlyDate(to)})` };
    }
    case 'last_week': {
      const day = now.getDay();
      const diff = (day + 6) % 7;
      const lastMonday = new Date(now);
      lastMonday.setDate(lastMonday.getDate() - diff - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastSunday.getDate() + 6);
      const f = toYMD(lastMonday);
      const to = toYMD(lastSunday);
      return { from: f, to, label: `Last Week (${formatFriendlyDate(f)} – ${formatFriendlyDate(to)})` };
    }
    case 'this_month': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const f = toYMD(first);
      const to = toYMD(last);
      return { from: f, to, label: `This Month (${formatFriendlyDate(f)} – ${formatFriendlyDate(to)})` };
    }
    case 'last_month': {
      const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const last = new Date(now.getFullYear(), now.getMonth(), 0);
      const f = toYMD(first);
      const to = toYMD(last);
      return { from: f, to, label: `Last Month (${formatFriendlyDate(f)} – ${formatFriendlyDate(to)})` };
    }
    case 'next_7_days': {
      const next7 = new Date(now);
      next7.setDate(next7.getDate() + 7);
      const f = todayYMD;
      const to = toYMD(next7);
      return { from: f, to, label: `Next 7 Days (${formatFriendlyDate(f)} – ${formatFriendlyDate(to)})` };
    }
    case 'next_30_days': {
      const next30 = new Date(now);
      next30.setDate(next30.getDate() + 30);
      const f = todayYMD;
      const to = toYMD(next30);
      return { from: f, to, label: `Next 30 Days (${formatFriendlyDate(f)} – ${formatFriendlyDate(to)})` };
    }
    case 'custom':
    default: {
      const f = customFrom || todayYMD;
      const to = customTo || todayYMD;
      return { from: f, to, label: `Custom (${formatFriendlyDate(f)} – ${formatFriendlyDate(to)})` };
    }
  }
}

export function isDateInRange(itemDateStr, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  if (!itemDateStr) return false;
  let ymd = '';
  if (typeof itemDateStr === 'string') {
    ymd = itemDateStr.slice(0, 10);
  } else if (itemDateStr instanceof Date) {
    ymd = toYMD(itemDateStr);
  }
  if (!ymd || ymd.length < 10) return false;
  if (dateFrom && ymd < dateFrom) return false;
  if (dateTo && ymd > dateTo) return false;
  return true;
}

export const DateRangeFilter = ({
  initialPreset = 'all_time',
  initialFrom = '',
  initialTo = '',
  onChange,
  className = '',
  style = {}
}) => {
  const [preset, setPreset] = useState(initialPreset || 'all_time');
  const [customFrom, setCustomFrom] = useState(initialFrom || toYMD(new Date()));
  const [customTo, setCustomTo] = useState(initialTo || toYMD(new Date()));

  useEffect(() => {
    const { from, to, label } = calculateDateRange(preset, customFrom, customTo);
    if (onChange) {
      onChange({
        dateFrom: from,
        dateTo: to,
        preset,
        displayLabel: label,
      });
    }
  }, [preset, customFrom, customTo]);

  return (
    <div
      className={`date-range-filter-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        ...style
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: '#f6f7f8',
          border: '1px solid #e3e6e8',
          borderRadius: '6px',
          padding: '0 8px',
          height: '30px',
        }}
      >
        <Calendar size={13} style={{ color: 'oklch(0.5 0.1 200)' }} />
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'oklch(0.4 0.1 200)' }}>Date:</span>
        <select
          value={preset || 'all_time'}
          onChange={(e) => setPreset(e.target.value)}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: '12px',
            color: '#15181b',
            outline: 'none',
            cursor: 'pointer',
            fontWeight: 500,
            fontFamily: "var(--sans, 'Public Sans', sans-serif)",
          }}
        >
          <option value="all_time">All Time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="tomorrow">Tomorrow</option>
          <option value="this_week">This Week</option>
          <option value="last_week">Last Week</option>
          <option value="this_month">This Month</option>
          <option value="last_month">Last Month</option>
          <option value="next_7_days">Next 7 Days</option>
          <option value="next_30_days">Next 30 Days</option>
          <option value="custom">Custom Date Range</option>
        </select>
      </div>

      {preset === 'custom' && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            style={{
              height: '30px',
              padding: '0 8px',
              border: '1px solid #e3e6e8',
              borderRadius: '6px',
              fontSize: '12px',
              background: '#fff',
              color: '#15181b',
              outline: 'none',
              fontFamily: "var(--sans, 'Public Sans', sans-serif)",
            }}
          />
          <span style={{ fontSize: '11px', color: '#8a9096' }}>→</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            style={{
              height: '30px',
              padding: '0 8px',
              border: '1px solid #e3e6e8',
              borderRadius: '6px',
              fontSize: '12px',
              background: '#fff',
              color: '#15181b',
              outline: 'none',
              fontFamily: "var(--sans, 'Public Sans', sans-serif)",
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
