import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, Loader2 } from 'lucide-react';

export type DatePreset =
  | 'all_time'
  | 'today'
  | 'yesterday'
  | 'tomorrow'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'next_7_days'
  | 'next_30_days'
  | 'custom';

export interface DateRangeValue {
  dateFrom: string;
  dateTo: string;
  preset: DatePreset;
  displayLabel: string;
}

interface DateRangeFilterProps {
  initialPreset?: DatePreset;
  initialFrom?: string;
  initialTo?: string;
  onChange: (value: DateRangeValue) => void;
  className?: string;
  loading?: boolean;
}

export function toYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatFriendlyDate(ymd: string): string {
  if (!ymd) return '';
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function calculateDateRange(preset: DatePreset, customFrom?: string, customTo?: string): { from: string; to: string; label: string } {
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
      const diff = (day + 6) % 7; // distance from Monday
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

export function normalizeToYMD(val?: string | Date | null): string {
  if (!val) return '';
  if (val instanceof Date) return toYMD(val);
  const s = String(val).trim();
  if (!s) return '';

  // 1. Matches YYYY-MM-DD
  const ymdMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const y = ymdMatch[1];
    const m = String(ymdMatch[2]).padStart(2, '0');
    const d = String(ymdMatch[3]).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // 2. Matches DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) {
    const d = String(dmyMatch[1]).padStart(2, '0');
    const m = String(dmyMatch[2]).padStart(2, '0');
    const y = dmyMatch[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Matches DD Mon YYYY (e.g. "15 Oct 2026", "16 Oct 2026", "15-Oct-2026")
  const dMonYMatch = s.match(/^(\d{1,2})[\s\-]+([A-Za-z]{3,})[\s\-]+(\d{4})/);
  if (dMonYMatch) {
    const months: Record<string, string> = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    const m = months[dMonYMatch[2].slice(0, 3).toLowerCase()];
    if (m) {
      const d = String(dMonYMatch[1]).padStart(2, '0');
      return `${dMonYMatch[3]}-${m}-${d}`;
    }
  }

  // 4. Try standard Date parsing
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return toYMD(parsed);
  }

  return '';
}

export function isDateInRange(itemDateStr?: string | Date | null, dateFrom?: string, dateTo?: string): boolean {
  if (!dateFrom && !dateTo) return true;
  if (!itemDateStr) return false;
  const ymd = normalizeToYMD(itemDateStr);
  if (!ymd) return false;
  if (dateFrom && ymd < dateFrom) return false;
  if (dateTo && ymd > dateTo) return false;
  return true;
}

export const DateRangeFilter: React.FC<DateRangeFilterProps> = ({
  initialPreset = 'all_time',
  initialFrom,
  initialTo,
  onChange,
  className = '',
  loading = false,
}) => {
  const [preset, setPreset] = useState<DatePreset>(initialPreset || 'all_time');
  const [customFrom, setCustomFrom] = useState<string>(initialFrom || toYMD(new Date()));
  const [customTo, setCustomTo] = useState<string>(initialTo || toYMD(new Date()));

  useEffect(() => {
    const { from, to, label } = calculateDateRange(preset, customFrom, customTo);
    onChange({
      dateFrom: from,
      dateTo: to,
      preset,
      displayLabel: label,
    });
  }, [preset, customFrom, customTo]);

  return (
    <div
      className={`date-range-filter-container ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: loading ? 'rgba(2, 132, 199, 0.05)' : '#f6f7f8',
          border: loading ? '1px solid #7dd3fc' : '1px solid #e3e6e8',
          borderRadius: '6px',
          padding: '0 8px',
          height: '30px',
          transition: 'all 0.2s ease',
        }}
      >
        {loading ? (
          <Loader2 size={13} style={{ color: '#0284c7', animation: 'spin 0.8s linear infinite' }} />
        ) : (
          <Calendar size={13} style={{ color: 'oklch(0.5 0.1 200)' }} />
        )}
        <span style={{ fontSize: '11px', fontWeight: 600, color: loading ? '#0284c7' : 'oklch(0.4 0.1 200)' }}>
          Date:
        </span>
        <select
          value={preset || 'all_time'}
          disabled={loading}
          onChange={(e) => setPreset(e.target.value as DatePreset)}
          style={{
            border: 'none',
            background: 'transparent',
            fontSize: '12px',
            color: '#15181b',
            outline: 'none',
            cursor: loading ? 'wait' : 'pointer',
            fontWeight: 500,
            fontFamily: "var(--sans, 'Public Sans', sans-serif)",
            opacity: loading ? 0.7 : 1,
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
        {loading && (
          <span
            style={{
              fontSize: '10.5px',
              color: '#0284c7',
              fontWeight: 600,
              background: '#e0f2fe',
              padding: '1px 6px',
              borderRadius: '8px',
              letterSpacing: '0.02em',
            }}
          >
            Fetching...
          </span>
        )}
      </div>

      {preset === 'custom' && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <input
            type="date"
            value={customFrom}
            disabled={loading}
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
              cursor: loading ? 'wait' : 'text',
              opacity: loading ? 0.7 : 1,
            }}
          />
          <span style={{ fontSize: '11px', color: '#8a9096' }}>→</span>
          <input
            type="date"
            value={customTo}
            disabled={loading}
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
              cursor: loading ? 'wait' : 'text',
              opacity: loading ? 0.7 : 1,
            }}
          />
        </div>
      )}
    </div>
  );
};

export default DateRangeFilter;
