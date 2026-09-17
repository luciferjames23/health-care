import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { apiService, extractDischargedPatientIds } from '../services/api';

export default function BedDemandView({ onSelectPatient }) {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
  const [bedManagement, setBedManagement] = useState(null);
  const [wardList, setWardList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Filters
  const [selectedWardId, setSelectedWardId] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Occupied' | 'Available' | 'Maintenance'
  const [searchQuery, setSearchQuery] = useState('');

  const loadAllBedData = useCallback(async (isSilent = false) => {
    if (!isSilent && !bedManagement) {
      setLoading(true);
    }
    setError(null);
    try {
      // Fetch combined Ward -> Room -> Bed -> Patient data and Discharges from live APIs
      const [bmRes, wardsRes, dcRes] = await Promise.all([
        apiService.getBedManagementData({}, { forceRefresh: isSilent }).catch(() => null),
        apiService.getWards({ limit: 100 }).catch(() => ({ data: [] })),
        apiService.getDischargedPatients().catch(() => ({ data: [] }))
      ]);

      const dischargedTracker = extractDischargedPatientIds(dcRes?.data || []);

      // Reconcile bed status with discharge records
      if (bmRes?.wards) {
        bmRes.wards.forEach(w => {
          (w.rooms || []).forEach(r => {
            (r.beds || []).forEach(b => {
              const p = b.assigned_patient || b.patient;
              if (p) {
                b.patient = p;
                b.assigned_patient = p;
              }
              const pid = b.patient_id || p?.patient_id || p?.id;
              const pnum = b.patient_number || p?.patient_number;
              const aid = b.admission_id || p?.admission_id;

              const isDischarged = dischargedTracker.has({ patient_id: pid, patient_number: pnum, admission_id: aid });
              if (isDischarged || !p) {
                b.status = 'Available';
                b.is_occupied = false;
                b.assigned_patient = null;
                b.patient = null;
              } else {
                b.status = 'Occupied';
                b.is_occupied = true;
              }
            });
          });
        });
      }

      setBedManagement(bmRes);
      setWardList(wardsRes?.data || []);
    } catch (err) {
      console.error("Failed to load live bed management data:", err);
      setError(err.message || 'Failed to connect to Bed & Ward backend APIs');
    } finally {
      setLoading(false);
    }
  }, [bedManagement]);

  useEffect(() => {
    loadAllBedData();

    const timer = setInterval(() => {
      loadAllBedData(true);
    }, 6000);

    const handleUpdate = () => loadAllBedData(true);
    window.addEventListener('hc_api_updated', handleUpdate);

    return () => {
      clearInterval(timer);
      window.removeEventListener('hc_api_updated', handleUpdate);
    };
  }, [loadAllBedData]);

  // Derived KPIs dynamically calculated from actual bed states
  const kpis = useMemo(() => {
    if (!bedManagement?.wards || bedManagement.wards.length === 0) {
      return {
        total_wards: wardList.length || 0,
        total_rooms: 0,
        total_beds: 0,
        occupied_beds: 0,
        available_beds: 0,
        maintenance_beds: 0,
        occupancy_rate: 0
      };
    }

    let totalBeds = 0;
    let occupiedBeds = 0;
    let availableBeds = 0;
    let maintenanceBeds = 0;
    let totalRooms = 0;

    bedManagement.wards.forEach(w => {
      (w.rooms || []).forEach(r => {
        totalRooms += 1;
        (r.beds || []).forEach(b => {
          totalBeds += 1;
          if (b.status === 'Occupied' || b.is_occupied) {
            occupiedBeds += 1;
          } else if (b.status === 'Maintenance') {
            maintenanceBeds += 1;
          } else {
            availableBeds += 1;
          }
        });
      });
    });

    const occRate = totalBeds > 0 ? ((occupiedBeds / totalBeds) * 100).toFixed(1) : 0;

    return {
      total_wards: bedManagement.wards.length || wardList.length || 0,
      total_rooms: totalRooms || 0,
      total_beds: totalBeds,
      occupied_beds: occupiedBeds,
      available_beds: availableBeds,
      maintenance_beds: maintenanceBeds,
      occupancy_rate: occRate
    };
  }, [bedManagement, wardList]);

  // Filtered wards, rooms, and beds
  const filteredWards = useMemo(() => {
    if (!bedManagement?.wards) return [];

    return bedManagement.wards
      .filter(w => {
        if (selectedWardId !== 'All' && String(w.ward_id) !== String(selectedWardId)) {
          return false;
        }
        return true;
      })
      .map(w => {
        const rooms = (w.rooms || []).map(r => {
          const beds = (r.beds || []).filter(b => {
            // Status filter
            if (statusFilter === 'Occupied' && b.status !== 'Occupied') return false;
            if (statusFilter === 'Available' && b.status !== 'Available') return false;
            if (statusFilter === 'Maintenance' && b.status === 'Occupied') return false;

            // Search query
            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase();
              const matchBed = (b.bed_number || '').toLowerCase().includes(q);
              const matchRoom = (r.room_number || '').toLowerCase().includes(q);
              const matchWard = (w.ward_name || '').toLowerCase().includes(q);
              const matchPat = b.patient && (
                (b.patient.name || '').toLowerCase().includes(q) ||
                (b.patient.patient_name || '').toLowerCase().includes(q) ||
                (b.patient.diagnosis || '').toLowerCase().includes(q)
              );
              return matchBed || matchRoom || matchWard || matchPat;
            }
            return true;
          });

          return { ...r, beds };
        }).filter(r => r.beds.length > 0);

        return { ...w, rooms };
      }).filter(w => w.rooms.length > 0);
  }, [bedManagement, selectedWardId, statusFilter, searchQuery]);

  // Flattened bed list for table mode
  const allFlattenedBeds = useMemo(() => {
    const list = [];
    (bedManagement?.wards || []).forEach(w => {
      (w.rooms || []).forEach(r => {
        (r.beds || []).forEach(b => {
          // Filters
          if (selectedWardId !== 'All' && String(w.ward_id) !== String(selectedWardId)) return;
          if (statusFilter === 'Occupied' && b.status !== 'Occupied') return;
          if (statusFilter === 'Available' && b.status !== 'Available') return;
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchBed = (b.bed_number || '').toLowerCase().includes(q);
            const matchRoom = (r.room_number || '').toLowerCase().includes(q);
            const matchWard = (w.ward_name || '').toLowerCase().includes(q);
            const matchPat = b.patient && (
              (b.patient.name || '').toLowerCase().includes(q) ||
              (b.patient.diagnosis || '').toLowerCase().includes(q)
            );
            if (!matchBed && !matchRoom && !matchWard && !matchPat) return;
          }

          list.push({
            ...b,
            ward_name: w.ward_name,
            ward_type: w.ward_type,
            floor_number: w.floor_number,
            room_number: r.room_number,
            room_type: r.room_type,
            room_charge: r.daily_charge
          });
        });
      });
    });
    return list;
  }, [bedManagement, selectedWardId, statusFilter, searchQuery]);

  const handleExportCsv = () => {
    if (allFlattenedBeds.length === 0) return alert('No bed records to export');
    const headers = ['Bed Number', 'Ward Name', 'Room Number', 'Room Type', 'Bed Status', 'Assigned Patient', 'Primary Diagnosis', 'Daily Charge'];
    const rows = [headers.join(',')];
    allFlattenedBeds.forEach(b => {
      rows.push([
        `"${b.bed_number || ''}"`,
        `"${b.ward_name || ''}"`,
        `"${b.room_number || ''}"`,
        `"${b.room_type || ''}"`,
        `"${b.status || ''}"`,
        `"${b.patient?.name || b.patient?.patient_name || 'Vacant'}"`,
        `"${(b.patient?.diagnosis || '—').replace(/"/g, '""')}"`,
        `"₹${b.daily_charge || b.room_charge || 0}"`
      ].join(','));
    });
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bed_management_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Front Office & Patients</span> › <span>Bed Board & Ward Management</span>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 600 }}>
            Hospital Ward, Room & Bed Management
          </div>
          <div style={{ color: '#8a9096', fontSize: '11.5px', marginTop: '2px' }}>
            Real-time live telemetry connecting <strong style={{ color: 'oklch(0.4 0.1 200)' }}>Ward → Room → Bed → Patient</strong> across all hospital wards
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Mode Switcher */}
          <div style={{ display: 'flex', border: '1px solid #e3e6e8', borderRadius: '6px', overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              style={{
                height: '30px', padding: '0 12px', border: 0,
                background: viewMode === 'grid' ? '#15181b' : '#fff',
                color: viewMode === 'grid' ? '#fff' : '#15181b',
                fontWeight: 600, fontSize: '11.5px', cursor: 'pointer'
              }}
            >
              Bed Matrix
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              style={{
                height: '30px', padding: '0 12px', border: 0, borderLeft: '1px solid #e3e6e8',
                background: viewMode === 'table' ? '#15181b' : '#fff',
                color: viewMode === 'table' ? '#fff' : '#15181b',
                fontWeight: 600, fontSize: '11.5px', cursor: 'pointer'
              }}
            >
              Table View
            </button>
          </div>

          <button
            type="button"
            onClick={loadAllBedData}
            style={{
              height: '30px', padding: '0 12px', borderRadius: '6px',
              border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '11.5px',
              fontWeight: 500, color: '#15181b', display: 'flex', alignItems: 'center', gap: '6px'
            }}
          >
            <span>↻</span>
            <span>{loading ? 'Syncing...' : 'Sync Live APIs'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            style={{
              height: '30px', padding: '0 12px', borderRadius: '6px',
              border: '1px solid #e3e6e8', background: '#fff', cursor: 'pointer', fontSize: '11.5px',
              fontWeight: 500, color: '#15181b'
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', color: '#991b1b', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span><strong>Unable to load bed data:</strong> {error}</span>
          <button onClick={loadAllBedData} style={{ padding: '3px 8px', borderRadius: '4px', border: '1px solid #f87171', background: '#fff', cursor: 'pointer', fontSize: '11px' }}>
            Retry
          </button>
        </div>
      )}

      {/* Dynamic Overview Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        
        {/* Total Beds */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Total Hospital Beds</span>
            <span style={{ fontSize: '14px', color: 'oklch(0.5 0.1 200)' }}>🛏</span>
          </div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '26px', lineHeight: 1.1, color: '#15181b', marginTop: '6px', fontWeight: 600 }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid oklch(0.5 0.1 200)',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : kpis.total_beds.toLocaleString()}
          </div>
          <div style={{ color: '#8a9096', fontSize: '11px', marginTop: '4px' }}>
            Across {kpis.total_wards} active hospital wards
          </div>
        </div>

        {/* Occupied Beds */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Occupied Beds</span>
            <span style={{ fontSize: '14px', color: 'oklch(0.5 0.18 25)' }}>👥</span>
          </div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '26px', lineHeight: 1.1, color: 'oklch(0.5 0.18 25)', marginTop: '6px', fontWeight: 600 }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid oklch(0.5 0.18 25)',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : kpis.occupied_beds.toLocaleString()}
          </div>
          <div style={{ color: '#8a9096', fontSize: '11px', marginTop: '4px' }}>
            Admitted patients assigned
          </div>
        </div>

        {/* Available Ready Beds */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Available Ready Beds</span>
            <span style={{ fontSize: '14px', color: 'oklch(0.4 0.12 150)' }}>✓</span>
          </div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '26px', lineHeight: 1.1, color: 'oklch(0.4 0.12 150)', marginTop: '6px', fontWeight: 600 }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid oklch(0.4 0.12 150)',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : kpis.available_beds.toLocaleString()}
          </div>
          <div style={{ color: '#8a9096', fontSize: '11px', marginTop: '4px' }}>
            Vacant &amp; ready for intake
          </div>
        </div>

        {/* Maintenance / Blocked */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Maintenance / Blocked</span>
            <span style={{ fontSize: '14px', color: 'oklch(0.5 0.13 70)' }}>⚠</span>
          </div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '26px', lineHeight: 1.1, color: 'oklch(0.5 0.13 70)', marginTop: '6px', fontWeight: 600 }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid oklch(0.5 0.13 70)',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : kpis.maintenance_beds.toLocaleString()}
          </div>
          <div style={{ color: '#8a9096', fontSize: '11px', marginTop: '4px' }}>
            Cleaning or reserved status
          </div>
        </div>

        {/* Occupancy Rate */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#8a9096', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.04em' }}>Occupancy Rate</span>
            <span style={{ fontSize: '14px', color: 'oklch(0.4 0.1 200)' }}>📈</span>
          </div>
          <div style={{ fontFamily: 'Newsreader, Georgia, serif', fontSize: '26px', lineHeight: 1.1, color: 'oklch(0.4 0.1 200)', marginTop: '6px', fontWeight: 600 }}>
            {loading ? <span style={{display:'inline-block',width:'14px',height:'14px',border:'2px solid #e3e6e8',borderTop:'2px solid oklch(0.5 0.18 25)',borderRadius:'50%',animation:'kpi-spin 0.7s linear infinite',verticalAlign:'middle'}} /> : `${kpis.occupancy_rate}%`}
          </div>
          <div style={{ color: '#8a9096', fontSize: '11px', marginTop: '4px' }}>
            Hospital operational threshold
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Ward Select */}
          <select
            value={selectedWardId}
            onChange={e => setSelectedWardId(e.target.value)}
            style={{
              height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8',
              background: '#fff', fontSize: '12px', color: '#15181b', outline: 'none', cursor: 'pointer',
              fontWeight: 500
            }}
          >
            <option value="All">All Hospital Wards (8 Wards)</option>
            {wardList.map(w => (
              <option key={w.ward_id} value={w.ward_id}>
                {w.ward_name} · Floor {w.floor_number}
              </option>
            ))}
          </select>

          {/* Status Filter Buttons */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {['All', 'Occupied', 'Available'].map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  height: '30px', padding: '0 12px', borderRadius: '6px',
                  border: statusFilter === st ? '1px solid oklch(0.5 0.1 200)' : '1px solid #e3e6e8',
                  background: statusFilter === st ? 'oklch(0.95 0.03 200)' : '#fff',
                  color: statusFilter === st ? 'oklch(0.4 0.1 200)' : '#52585e',
                  fontWeight: statusFilter === st ? 600 : 400,
                  fontSize: '11.5px', cursor: 'pointer'
                }}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search bed, room, patient name, ward..."
          style={{
            height: '30px', width: '280px', border: '1px solid #e3e6e8',
            borderRadius: '6px', padding: '0 10px', background: '#fff', fontSize: '12px', outline: 'none'
          }}
        />
      </div>

      {/* 1. GRID / MATRIX VIEW */}
      {viewMode === 'grid' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loading && !bedManagement ? (
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>Loading Live Ward &amp; Bed Matrix...</div>
              <div style={{ fontSize: '12px' }}>Fetching ward, room & bed data from clinical data system…</div>
            </div>
          ) : filteredWards.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px' }}>No Wards or Beds Match Current Filter</div>
              <div style={{ fontSize: '12px' }}>Try selecting a different ward or status filter.</div>
            </div>
          ) : (
            filteredWards.map(ward => {
              const totalWardBeds = (ward.rooms || []).reduce((acc, r) => acc + (r.beds?.length || 0), 0);
              const occupiedWardBeds = (ward.rooms || []).reduce((acc, r) => acc + (r.beds?.filter(b => b.status === 'Occupied').length || 0), 0);
              const wardRate = totalWardBeds > 0 ? Math.round((occupiedWardBeds / totalWardBeds) * 100) : 0;

              return (
                <div
                  key={ward.ward_id}
                  style={{
                    background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px',
                    padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
                  }}
                >
                  {/* Ward Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #eef0f1', paddingBottom: '10px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 600, color: '#15181b' }}>{ward.ward_name}</span>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', background: '#f2f3f4', fontSize: '10.5px', color: '#52585e' }}>
                          Floor {ward.floor_number} · {ward.ward_type}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#8a9096', marginTop: '2px' }}>
                        {ward.rooms?.length || 0} Rooms · {totalWardBeds} Total Beds
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{
                        padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600,
                        background: wardRate > 80 ? 'oklch(0.96 0.05 25)' : 'oklch(0.95 0.04 150)',
                        color: wardRate > 80 ? 'oklch(0.5 0.18 25)' : 'oklch(0.4 0.12 150)'
                      }}>
                        {occupiedWardBeds} / {totalWardBeds} Occupied ({wardRate}%)
                      </span>
                    </div>
                  </div>

                  {/* Rooms and Beds Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                    {(ward.rooms || []).map(room => (
                      <div
                        key={room.room_id}
                        style={{
                          background: '#f9fafa', border: '1px solid #eef0f1', borderRadius: '6px',
                          padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px'
                        }}
                      >
                        {/* Room info header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '12px', color: '#15181b' }}>
                            Room {room.room_number}
                          </span>
                          <span style={{ fontSize: '10.5px', color: '#8a9096' }}>
                            {room.room_type} · ₹{room.daily_charge}/day
                          </span>
                        </div>

                        {/* Beds in Room */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '6px' }}>
                          {(room.beds || []).map(bed => {
                            const isOccupied = bed.status === 'Occupied';
                            const pName = bed.patient?.name || bed.patient?.patient_name;

                            return (
                              <div
                                key={bed.bed_id}
                                onClick={() => {
                                  if (isOccupied && onSelectPatient && bed.patient) {
                                    onSelectPatient(bed.patient);
                                  }
                                }}
                                style={{
                                  padding: '8px 10px', borderRadius: '6px',
                                  background: isOccupied ? 'oklch(0.95 0.04 150)' : '#fff',
                                  border: isOccupied ? '1px solid oklch(0.85 0.08 150)' : '1px dashed #cbd5e1',
                                  cursor: isOccupied ? 'pointer' : 'default',
                                  transition: 'transform 0.1s, box-shadow 0.1s'
                                }}
                                onMouseEnter={e => {
                                  if (isOccupied) {
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                    e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.06)';
                                  }
                                }}
                                onMouseLeave={e => {
                                  if (isOccupied) {
                                    e.currentTarget.style.transform = 'none';
                                    e.currentTarget.style.boxShadow = 'none';
                                  }
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 700, fontSize: '11.5px', color: isOccupied ? 'oklch(0.35 0.12 150)' : '#15181b' }}>
                                    {bed.bed_number}
                                  </span>
                                  <span style={{
                                    fontSize: '9.5px', fontWeight: 600, padding: '1px 4px', borderRadius: '3px',
                                    background: isOccupied ? 'oklch(0.4 0.12 150)' : '#e2e8f0',
                                    color: isOccupied ? '#fff' : '#64748b'
                                  }}>
                                    {isOccupied ? 'Occupied' : 'Ready'}
                                  </span>
                                </div>

                                {isOccupied && pName ? (
                                  <div style={{ marginTop: '4px' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {pName}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {bed.patient?.diagnosis || 'Inpatient Stay'}
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '10.5px', color: '#94a3b8', marginTop: '4px' }}>
                                    Vacant &amp; Clean
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. TABLE VIEW */}
      {viewMode === 'table' && (
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #eef0f1', color: '#8a9096', fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                <th style={{ padding: '9px 12px' }}>Bed Number</th>
                <th style={{ padding: '9px 12px' }}>Ward</th>
                <th style={{ padding: '9px 12px' }}>Room</th>
                <th style={{ padding: '9px 12px' }}>Status</th>
                <th style={{ padding: '9px 12px' }}>Assigned Patient</th>
                <th style={{ padding: '9px 12px' }}>Diagnosis</th>
                <th style={{ padding: '9px 12px' }}>Daily Charge</th>
              </tr>
            </thead>
            <tbody>
              {allFlattenedBeds.map((b, idx) => {
                const isOccupied = b.status === 'Occupied';
                return (
                  <tr
                    key={b.bed_id || idx}
                    style={{ borderBottom: '1px solid #f2f3f4', cursor: isOccupied ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (isOccupied && onSelectPatient && b.patient) {
                        onSelectPatient(b.patient);
                      }
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f9fafa'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '10px 12px', fontWeight: 700, fontFamily: 'monospace', color: 'oklch(0.5 0.1 200)' }}>
                      {b.bed_number}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#15181b' }}>{b.ward_name}</div>
                      <div style={{ fontSize: '10.5px', color: '#8a9096' }}>Floor {b.floor_number} · {b.ward_type}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      Room {b.room_number} ({b.room_type})
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        padding: '2px 6px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                        background: isOccupied ? 'oklch(0.95 0.04 150)' : '#f2f3f4',
                        color: isOccupied ? 'oklch(0.4 0.12 150)' : '#52585e'
                      }}>
                        {b.status}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: isOccupied ? '#15181b' : '#94a3b8' }}>
                      {b.patient?.name || b.patient?.patient_name || 'Vacant / Ready'}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#52585e' }}>
                      {b.patient?.diagnosis || '—'}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>
                      ₹{b.daily_charge || b.room_charge || 0}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
