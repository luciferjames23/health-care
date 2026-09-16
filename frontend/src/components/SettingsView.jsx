import React from 'react';
import { 
  Sliders, 
  Database, 
  RefreshCw, 
  Globe
} from 'lucide-react';

export default function SettingsView({ healthInfo, onRefresh, loading }) {
  const isConnected = healthInfo?.isConnected !== false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            HOSPITAL OPERATING PLATFORM · INFRASTRUCTURE CONFIGURATION
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '2px 0 0', color: '#15181b', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders style={{ width: '22px', height: '22px', color: 'oklch(0.5 0.1 200)' }} />
            Databricks &amp; System Configuration
          </h1>
          <div style={{ color: '#52585e', fontSize: '12px', marginTop: '2px' }}>
            View active connection properties for Databricks Lakehouse and FastAPI REST services.
          </div>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          style={{
            height: '32px', padding: '0 16px', borderRadius: '6px',
            border: 0, background: 'oklch(0.5 0.1 200)',
            color: '#ffffff', fontSize: '12px', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <RefreshCw style={{ width: '13px', height: '13px', animation: loading ? 'kpi-spin 1s linear infinite' : 'none' }} />
          <span>Test System Connection</span>
        </button>
      </div>

      {/* Connection Status Card */}
      <div style={{ background: '#ffffff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: isConnected ? '#10b981' : '#f59e0b',
              boxShadow: isConnected ? '0 0 0 3px rgba(16, 185, 129, 0.2)' : 'none'
            }} />
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#0f172a' }}>
                {isConnected ? 'FastAPI Backend Online & Connected' : 'Local Prototype Engine Active'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                {isConnected ? 'Connected to http://localhost:8000/api/v1/health' : 'Serving rich offline mock data for Databricks Gold schema'}
              </div>
            </div>
          </div>
          <span style={{
            fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, padding: '3px 10px',
            borderRadius: '12px', background: isConnected ? '#dcfce7' : '#fef3c7',
            color: isConnected ? '#15803d' : '#b45309'
          }}>
            {isConnected ? 'HTTP 200 OK' : 'LOCAL FALLBACK'}
          </span>
        </div>
      </div>

      {/* Databricks Connector Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        
        {/* Card 1: Databricks Properties */}
        <div style={{ background: '#ffffff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Database style={{ width: '18px', height: '18px', color: '#0284c7' }} />
            <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>
              Databricks Gold Layer Metadata
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontFamily: 'monospace', fontSize: '12px' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontFamily: 'inherit', marginBottom: '2px' }}>Databricks Host</div>
              <div style={{ color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                dbc-478013da-49af.cloud.databricks.com
              </div>
            </div>

            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontFamily: 'inherit', marginBottom: '2px' }}>HTTP Warehouse Path</div>
              <div style={{ color: '#0f172a', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                /sql/1.0/warehouses/769f9abf1dd202a2
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontFamily: 'inherit', marginBottom: '2px' }}>Catalog</div>
                <div style={{ color: '#0284c7', fontWeight: 700 }}>health_care</div>
              </div>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px 12px' }}>
                <div style={{ fontSize: '10px', color: '#64748b', textTransform: 'uppercase', fontFamily: 'inherit', marginBottom: '2px' }}>Schema</div>
                <div style={{ color: '#10b981', fontWeight: 700 }}>gold</div>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: REST API Endpoints */}
        <div style={{ background: '#ffffff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Globe style={{ width: '18px', height: '18px', color: '#10b981' }} />
            <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a' }}>
              FastAPI REST Service Endpoints
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontFamily: 'monospace', fontSize: '11.5px', maxHeight: '250px', overflowY: 'auto' }}>
            {[
              { path: 'GET /api/v1/health', label: 'Health Check' },
              { path: 'GET /api/v1/gold/summary', label: 'Gold Summary KPIs' },
              { path: 'GET /api/v1/gold/revenue-predictions', label: 'Revenue Projections' },
              { path: 'GET /api/v1/gold/tables', label: 'Table Metadata' },
              { path: 'GET /api/v1/gold/schema/{table}', label: 'Schema Definitions' },
              { path: 'GET /api/v1/gold/table/{table}', label: 'Dynamic Grid Query' }
            ].map((ep, i) => (
              <div key={i} style={{ padding: '8px 12px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#0284c7', fontWeight: 600 }}>{ep.path}</span>
                <span style={{ color: '#64748b', fontSize: '10.5px' }}>{ep.label}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
