import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export interface TablePaginationProps {
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (newPage: number) => void;
  onPageSizeChange?: (newSize: number) => void;
  label?: string;
  pageSizeOptions?: number[];
  style?: React.CSSProperties;
}

/**
 * Standardized Unified Table Pagination Component
 * Matches the design across all clinical & administrative modules.
 */
export const TablePagination: React.FC<TablePaginationProps> = ({
  total = 0,
  page = 1,
  pageSize = 25,
  onPageChange,
  onPageSizeChange,
  label = 'records',
  pageSizeOptions = [15, 25, 50, 100],
  style = {}
}) => {
  const totalRows = Number(total) || 0;
  const size = Number(pageSize) || 25;
  const totalPages = Math.max(1, Math.ceil(totalRows / size));
  const currentPage = Math.min(Math.max(1, Number(page) || 1), totalPages);

  const startRecord = totalRows > 0 ? (currentPage - 1) * size + 1 : 0;
  const endRecord = Math.min(currentPage * size, totalRows);

  const handlePage = (p: number) => {
    const target = Math.min(totalPages, Math.max(1, p));
    if (target !== currentPage && typeof onPageChange === 'function') {
      onPageChange(target);
    }
  };

  const handleSize = (sz: number) => {
    if (typeof onPageSizeChange === 'function') {
      onPageSizeChange(sz);
    }
    if (typeof onPageChange === 'function') {
      onPageChange(1);
    }
  };

  return (
    <div
      style={{
        padding: '12px 18px',
        borderTop: '1px solid #eef0f1',
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        fontSize: '12px',
        color: '#64748b',
        borderBottomLeftRadius: '8px',
        borderBottomRightRadius: '8px',
        ...style
      }}
    >
      {/* Left side: Showing X-Y of Z & Page Size Selectors */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
        <span>
          Showing <strong>{startRecord}</strong>–<strong>{endRecord}</strong> of{' '}
          <strong>{totalRows.toLocaleString('en-IN')}</strong> {label}
        </span>

        {pageSizeOptions && pageSizeOptions.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '11.5px', color: '#8a9096' }}>Per page:</span>
            {pageSizeOptions.map((sz) => {
              const isActive = size === sz;
              return (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleSize(sz)}
                  style={{
                    height: '24px',
                    padding: '0 8px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: isActive ? '#0284c7' : '#e2e8f0',
                    background: isActive ? '#f0f9ff' : '#ffffff',
                    color: isActive ? '#0369a1' : '#64748b',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  {sz}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Right side: First / Prev / Page X of Y / Next / Last */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <button
          type="button"
          onClick={() => handlePage(1)}
          disabled={currentPage <= 1}
          title="First Page"
          style={{
            height: '28px',
            width: '28px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage <= 1 ? 0.35 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#334155',
            transition: 'opacity 0.15s ease'
          }}
        >
          <ChevronsLeft style={{ width: '14px', height: '14px' }} />
        </button>

        <button
          type="button"
          onClick={() => handlePage(currentPage - 1)}
          disabled={currentPage <= 1}
          title="Previous Page"
          style={{
            height: '28px',
            width: '28px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage <= 1 ? 0.35 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#334155',
            transition: 'opacity 0.15s ease'
          }}
        >
          <ChevronLeft style={{ width: '14px', height: '14px' }} />
        </button>

        <span style={{ padding: '0 8px', fontWeight: 600, color: '#0f172a', fontSize: '12px' }}>
          Page {currentPage} of {totalPages}
        </span>

        <button
          type="button"
          onClick={() => handlePage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          title="Next Page"
          style={{
            height: '28px',
            width: '28px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage >= totalPages ? 0.35 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#334155',
            transition: 'opacity 0.15s ease'
          }}
        >
          <ChevronRight style={{ width: '14px', height: '14px' }} />
        </button>

        <button
          type="button"
          onClick={() => handlePage(totalPages)}
          disabled={currentPage >= totalPages}
          title="Last Page"
          style={{
            height: '28px',
            width: '28px',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            background: '#ffffff',
            cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage >= totalPages ? 0.35 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#334155',
            transition: 'opacity 0.15s ease'
          }}
        >
          <ChevronsRight style={{ width: '14px', height: '14px' }} />
        </button>
      </div>
    </div>
  );
};

export default TablePagination;
