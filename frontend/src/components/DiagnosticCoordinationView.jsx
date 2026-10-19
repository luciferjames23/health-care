import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiService } from '../services/api';
import { imagingOrdersApi } from '../services/imagingOrdersApi';
import { diagnosticPreparationApi } from '../services/diagnosticPreparationApi';
import { radiologyApi } from '../services/radiologyApi';
import { labCollectionEventsApi } from '../services/labCollectionEventsApi';
import { labCriticalAlertsApi } from '../services/labCriticalAlertsApi';
import TablePagination from './TablePagination';
import { TableSkeleton } from './ModuleLoadingScreen';
import {
  Card,
  PageHeading,
  StatusBadge,
  formatTableDateTime,
} from './RadiologyShared';

const REFRESH_MS = 15000;
const UNAVAILABLE = 'Data unavailable';
const LAB_STATUS_OPTIONS = ['All', 'Pending', 'Waiting for Acknowledgement', 'Completed'];
const BASE_TRACKER_SECTIONS = [
  { id: 'ag10-lab-section', label: 'Laboratory' },
  { id: 'ag10-critical-alerts-section', label: 'Critical result alerts' },
  { id: 'ag10-radiology-section', label: 'Radiology' },
];
const RADIOLOGY_RESULTS_SECTION = { id: 'ag10-radiology-results-section', label: 'Radiology studies and results' };
const INITIAL_PAGES = { lab: 1, imaging: 1, radiology: 1 };

function getPageWindow(rows, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), page: safePage };
}

function display(value) {
  if (value === null || value === undefined || String(value).trim() === '') return UNAVAILABLE;
  return String(value);
}

function isPlainChestXray(examination) {
  const normalized = String(examination || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return /^chest x-ray (?:pa|ap|pa \+ ap)$/.test(normalized);
}

const FINAL_RADIOLOGIST_REVIEW_STATUSES = new Set(['Confirmed', 'Confirmed (Finding Revised)']);

function getAg10RadiologyOrderStatus(order) {
  if (order.status !== 'Uploaded') return order.status;
  const studies = Array.isArray(order.studies) ? order.studies : [];
  const allStudiesFinalized = studies.length > 0 && studies.every((study) => (
    study.status === 'Uploaded'
    && FINAL_RADIOLOGIST_REVIEW_STATUSES.has(String(study.review_status || '').trim())
  ));
  return allStudiesFinalized ? 'Completed' : order.status;
}

function formatDate(value) {
  if (!value) return UNAVAILABLE;
  const formatted = formatTableDateTime(value);
  return formatted?.full || display(value);
}

function errorText(error) {
  return error?.message || 'Unable to load this data.';
}

function getAuthenticatedUserId(token) {
  if (!token || typeof atob !== 'function') return null;
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const userId = JSON.parse(atob(padded))?.user_id;
    return userId === null || userId === undefined ? null : String(userId);
  } catch {
    return null;
  }
}

export default function DiagnosticCoordinationView({
  onSelectPatient,
  userRole,
  currentUser,
  canOpenRadiology = false,
  onOpenRadiologyStudy,
  onOpenRadiologyOrders,
}) {
  const [labs, setLabs] = useState(null);
  const [imaging, setImaging] = useState(null);
  const [radiology, setRadiology] = useState(null);
  const [errors, setErrors] = useState({});
  const [collectionEventsByOrder, setCollectionEventsByOrder] = useState({});
  const [collectionEventsError, setCollectionEventsError] = useState(null);
  const [collectionEventsLoading, setCollectionEventsLoading] = useState(true);
  const [criticalAlerts, setCriticalAlerts] = useState(null);
  const [criticalAlertsError, setCriticalAlertsError] = useState(null);
  const [alertActionBusy, setAlertActionBusy] = useState(null);
  const [alertActionErrors, setAlertActionErrors] = useState({});
  const [alertActionNotices, setAlertActionNotices] = useState({});
  const [closureReasons, setClosureReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [pageSize, setPageSize] = useState(25);
  const [pages, setPages] = useState(INITIAL_PAGES);
  const [activeSection, setActiveSection] = useState(BASE_TRACKER_SECTIONS[0].id);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [doctorStudy, setDoctorStudy] = useState({ study: null, loading: false, data: null, error: null });
  const [fastingEvidenceByOrder, setFastingEvidenceByOrder] = useState({});
  const [fastingEvidenceError, setFastingEvidenceError] = useState(null);
  const [fastingEvidenceLoading, setFastingEvidenceLoading] = useState(true);
  const [fastingCapture, setFastingCapture] = useState(null);
  const [savingFastingOrder, setSavingFastingOrder] = useState(null);
  const isDoctor = String(userRole || '').trim().toLowerCase() === 'doctor';
  const isNurse = String(userRole || '').trim().toLowerCase() === 'nurse';
  const trackerSections = useMemo(() => (
    isDoctor ? BASE_TRACKER_SECTIONS : [...BASE_TRACKER_SECTIONS, RADIOLOGY_RESULTS_SECTION]
  ), [isDoctor]);
  const currentUserId = useMemo(() => getAuthenticatedUserId(currentUser?.token), [currentUser?.token]);

  const refreshCriticalAlerts = useCallback(async () => {
    try {
      const response = await labCriticalAlertsApi.list();
      setCriticalAlerts(response?.alerts || []);
      setCriticalAlertsError(null);
      return true;
    } catch (error) {
      setCriticalAlerts(null);
      setCriticalAlertsError(errorText(error));
      return false;
    }
  }, []);

  const loadCollectionEvents = useCallback(async (orders) => {
    const orderIds = Array.from(new Set((orders || []).map((order) => order.lab_order_id).filter(Boolean)));
    if (!orderIds.length) {
      setCollectionEventsByOrder({});
      setCollectionEventsError(null);
      setCollectionEventsLoading(false);
      return;
    }
    setCollectionEventsLoading(true);
    try {
      const response = await labCollectionEventsApi.getLatestForOrders(orderIds);
      setCollectionEventsByOrder(Object.fromEntries((response.data || []).map((item) => [item.lab_order_id, item.latest_event])));
      setCollectionEventsError(null);
    } catch (error) {
      setCollectionEventsByOrder({});
      setCollectionEventsError(errorText(error));
    } finally {
      setCollectionEventsLoading(false);
    }
  }, []);

  const loadFastingEvidence = useCallback(async (orders) => {
    const orderIds = Array.from(new Set((orders || []).map((order) => order.order_id).filter(Boolean)));
    if (!orderIds.length) {
      setFastingEvidenceByOrder({});
      setFastingEvidenceError(null);
      setFastingEvidenceLoading(false);
      return;
    }
    setFastingEvidenceLoading(true);
    try {
      const response = await diagnosticPreparationApi.getFastingEvidence(orderIds);
      const evidence = Object.fromEntries((response.data || []).map((item) => [item.order_id, item]));
      setFastingEvidenceByOrder(evidence);
      setFastingEvidenceError(null);
    } catch (error) {
      setFastingEvidenceByOrder({});
      setFastingEvidenceError(errorText(error));
    } finally {
      setFastingEvidenceLoading(false);
    }
  }, []);

  const refresh = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    const results = await Promise.allSettled([
      apiService.getPatientLabOrders({ limit: 200 }),
      imagingOrdersApi.list(),
      isDoctor ? Promise.resolve(null) : radiologyApi.getWorklist(),
      labCriticalAlertsApi.list(),
    ]);
    const nextErrors = {};

    if (results[0].status === 'fulfilled') {
      setLabs(results[0].value);
      await loadCollectionEvents(results[0].value?.data || []);
    } else {
      nextErrors.lab = errorText(results[0].reason);
      setCollectionEventsByOrder({});
      setCollectionEventsError(errorText(results[0].reason));
      setCollectionEventsLoading(false);
    }

    if (results[1].status === 'fulfilled') {
      setImaging(results[1].value);
      await loadFastingEvidence(results[1].value?.orders || []);
    } else {
      nextErrors.imaging = errorText(results[1].reason);
      setFastingEvidenceByOrder({});
      setFastingEvidenceError(errorText(results[1].reason));
      setFastingEvidenceLoading(false);
    }

    if (isDoctor) {
      // Doctors use their own imaging orders and the order-authorized study detail
      // endpoint on demand; AG-10 does not request the Radiologist worklist.
      setRadiology(null);
    } else if (results[2].status === 'fulfilled') setRadiology(results[2].value);
    else nextErrors.radiology = errorText(results[2].reason);

    if (results[3].status === 'fulfilled') {
      setCriticalAlerts(results[3].value?.alerts || []);
      setCriticalAlertsError(null);
    } else {
      setCriticalAlerts(null);
      setCriticalAlertsError(errorText(results[3].reason));
    }

    setErrors(nextErrors);
    setLastUpdated(new Date());
    setLoading(false);
  }, [isDoctor, loadFastingEvidence, loadCollectionEvents]);

  const submitFastingEvidence = useCallback(async (event) => {
    event.preventDefault();
    if (!fastingCapture || savingFastingOrder) return;
    const { orderId, assertion, sourceType, lastMealAt, fastingStartedAt } = fastingCapture;
    if (assertion === 'CONFIRMED' && !lastMealAt && !fastingStartedAt) {
      setFastingCapture((current) => ({ ...current, error: 'Enter the last meal time or fasting start time for a confirmation.' }));
      return;
    }
    const toUtcIso = (value) => value ? new Date(value).toISOString() : null;
    setSavingFastingOrder(orderId);
    try {
      const response = await diagnosticPreparationApi.createFastingEvidence(orderId, {
        assertion,
        last_meal_at: toUtcIso(lastMealAt),
        fasting_started_at: toUtcIso(fastingStartedAt),
        source_type: sourceType,
      });
      setFastingEvidenceByOrder((current) => ({
        ...current,
        [response.order_id]: {
          order_id: response.order_id,
          patient_id: response.patient_id,
          latest_evidence: response.evidence,
        },
      }));
      setFastingEvidenceError(null);
      setFastingCapture(null);
      await loadFastingEvidence(imaging?.orders || []);
    } catch (error) {
      setFastingCapture((current) => current ? ({ ...current, error: errorText(error) }) : current);
    } finally {
      setSavingFastingOrder(null);
    }
  }, [fastingCapture, savingFastingOrder, imaging, loadFastingEvidence]);

  const openDoctorStudy = useCallback(async (study) => {
    setDoctorStudy({ study, loading: true, data: null, error: null });
    try {
      const data = await radiologyApi.getStudy(study.study_id);
      setDoctorStudy({ study, loading: false, data, error: null });
    } catch (error) {
      setDoctorStudy({ study, loading: false, data: null, error: errorText(error) });
    }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => refresh({ showLoader: true }), 0);
    const timer = setInterval(refresh, REFRESH_MS);
    return () => {
      clearTimeout(initialLoad);
      clearInterval(timer);
    };
  }, [refresh]);

  const labFilter = LAB_STATUS_OPTIONS.includes(filter) ? filter : 'All';
  const labRows = useMemo(() => (labs?.data || []).filter((row) => {
    const q = query.trim().toLowerCase();
    const displayedStatus = getLabDisplayedStatus(row, criticalAlerts);
    const haystack = [
      row.patient_name, row.patient_code, row.patient_id, row.order_number,
      row.test_name, row.test_code, displayedStatus,
    ].map((part) => String(part ?? '')).join(' ').toLowerCase();
    return (!q || haystack.includes(q)) && (labFilter === 'All' || String(displayedStatus || '') === labFilter);
  }), [labs, query, labFilter, criticalAlerts]);

  const creatinineResultsByPatient = useMemo(() => {
    const latestByPatient = new Map();
    (labs?.data || []).forEach((order) => {
      const patientKeys = [order.patient_id, order.patient_code]
        .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
        .map(String);
      (Array.isArray(order.results) ? order.results : []).forEach((result) => {
        const parameter = String(result.parameter || '').trim();
        const isExplicitCreatinineOrEgfr = /\bcreatinine\b|\begfr\b|estimated\s+(?:glomerular\s+)?filtration\s+rate/i.test(parameter);
        if (!isExplicitCreatinineOrEgfr || result.value === null || result.value === undefined || String(result.value).trim() === '') return;

        const candidate = { ...result, order_number: order.order_number };
        const candidateTime = Date.parse(candidate.result_date || '') || 0;
        patientKeys.forEach((key) => {
          const current = latestByPatient.get(key);
          const currentTime = Date.parse(current?.result_date || '') || 0;
          if (!current || candidateTime > currentTime || (
            candidateTime === currentTime && Number(candidate.lab_result_id || 0) > Number(current.lab_result_id || 0)
          )) {
            latestByPatient.set(key, candidate);
          }
        });
      });
    });
    return Object.fromEntries(latestByPatient);
  }, [labs]);

  const imagingRows = useMemo(() => (imaging?.orders || []).filter((row) => {
    const q = query.trim().toLowerCase();
    const haystack = [
      row.patient_name, row.patient_code, row.patient_id, row.order_id,
      row.accession_number, row.examination, row.status, row.requested_by_name,
      ...(isDoctor && Array.isArray(row.studies) ? row.studies.flatMap((study) => [study.projection, study.status, study.review_status]) : []),
    ].map((part) => String(part ?? '')).join(' ').toLowerCase();
    const sourceStatuses = [row.status, ...(isDoctor && Array.isArray(row.studies) ? row.studies.flatMap((study) => [study.status, study.review_status]) : [])].filter(Boolean).map(String);
    return (!q || haystack.includes(q)) && (filter === 'All' || sourceStatuses.includes(filter));
  }), [imaging, query, filter, isDoctor]);

  const radiologyRows = useMemo(() => (radiology?.studies || []).filter((row) => {
    const q = query.trim().toLowerCase();
    const haystack = [
      row.patient_name, row.patient_code, row.patient_id, row.display_study_id,
      row.study_id, row.review_status, row.combined_assessment?.status,
      row.metadata?.modality,
    ].map((part) => String(part ?? '')).join(' ').toLowerCase();
    const sourceStatus = row.review_status || row.combined_assessment?.status || '';
    return (!q || haystack.includes(q)) && (filter === 'All' || String(sourceStatus) === filter);
  }), [radiology, query, filter]);

  const statusOptions = useMemo(() => {
    const statuses = new Set([
      ...(labs?.data || []).map((row) => row.status),
      ...(imaging?.orders || []).flatMap((row) => [row.status, ...(isDoctor && Array.isArray(row.studies) ? row.studies.flatMap((study) => [study.status, study.review_status]) : [])]),
      ...(radiology?.studies || []).map((row) => row.review_status || row.combined_assessment?.status),
    ].filter(Boolean).map(String));
    return ['All', ...Array.from(statuses).sort()];
  }, [labs, imaging, radiology, isDoctor]);

  const labPage = useMemo(() => getPageWindow(labRows, pages.lab, pageSize), [labRows, pages.lab, pageSize]);
  const imagingPage = useMemo(() => getPageWindow(imagingRows, pages.imaging, pageSize), [imagingRows, pages.imaging, pageSize]);
  const radiologyPage = useMemo(() => getPageWindow(radiologyRows, pages.radiology, pageSize), [radiologyRows, pages.radiology, pageSize]);
  const resetPages = () => setPages({ ...INITIAL_PAGES });
  const changePageSize = (size) => {
    setPageSize(size);
    resetPages();
  };

  return (
    <div>
      <PageHeading
        crumb="AG-10 · Diagnostic Coordination"
        title="Diagnostic Coordination Tracker"
        subtitle="Read-only view of existing laboratory and radiology data. Source statuses are shown as recorded."
      />
      <nav
        aria-label="Diagnostic tracker sections"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          gap: 8,
          padding: '8px 10px',
          marginBottom: 12,
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: 10,
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.06)',
        }}
      >
        {trackerSections.map((section) => (
          <button
            key={section.id}
            type="button"
            aria-current={activeSection === section.id ? 'page' : undefined}
            onClick={() => {
              const nextOptions = section.id === 'ag10-lab-section' ? LAB_STATUS_OPTIONS : statusOptions;
              if (!nextOptions.includes(filter)) {
                setFilter('All');
                resetPages();
              }
              setActiveSection(section.id);
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 34,
              padding: '0 12px',
              borderRadius: 7,
              border: activeSection === section.id ? '1px solid #1e3a5f' : '1px solid #e2e8f0',
              background: activeSection === section.id ? '#1e3a5f' : '#f1f5f9',
              color: activeSection === section.id ? '#ffffff' : '#1e3a5f',
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {section.label}
          </button>
        ))}
      </nav>
      <Card style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11.5, lineHeight: 1.55 }}>
          Lab and Radiology retain separate workflows. AG-10 may record separate, order-linked preparation evidence from authenticated Nurses; it does not change an order or decide readiness.
          {lastUpdated && <span> Last refreshed: {lastUpdated.toLocaleTimeString()}</span>}
        </div>
      </Card>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <input
          aria-label="Search diagnostic coordination records"
          value={query}
          onChange={(event) => { setQuery(event.target.value); resetPages(); }}
          placeholder="Search patient, order, test, or study"
          style={inputStyle}
        />
        <select
          aria-label="Filter by source status"
          value={activeSection === 'ag10-lab-section' && !LAB_STATUS_OPTIONS.includes(filter) ? 'All' : filter}
          onChange={(event) => { setFilter(event.target.value); resetPages(); }}
          style={inputStyle}
        >
          {(activeSection === 'ag10-lab-section' ? LAB_STATUS_OPTIONS : statusOptions).map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <button type="button" onClick={() => refresh({ showLoader: true })} style={buttonStyle}>Refresh</button>
      </div>
      {loading ? (
        <div role="status" aria-live="polite" style={{ display: 'grid', gap: 8 }}>
          <div style={{ color: '#64748b', fontSize: 12 }}>Loading {trackerSections.find((section) => section.id === activeSection)?.label || 'diagnostic records'}…</div>
          <TableSkeleton rows={6} columns={8} />
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16, marginTop: 12 }}>
          {activeSection === 'ag10-lab-section' && <section aria-labelledby="ag10-lab-heading">
            <SectionHeading id="ag10-lab-heading" title="Laboratory" count={labRows.length} />
            <Card style={{ marginBottom: 10, color: '#64748b', fontSize: 11 }}>
              PoC subset: this page shows up to 200 Lab orders from the existing API. Matching total: {display(labs?.total)}.
            </Card>
            {errors.lab ? <UnavailablePanel detail={errors.lab} /> : labs === null ? <UnavailablePanel /> : (
              <LabTable
                rows={labPage.rows}
                criticalAlerts={criticalAlerts}
                onSelectPatient={onSelectPatient}
                collectionEventsByOrder={collectionEventsByOrder}
                collectionEventsError={collectionEventsError}
                collectionEventsLoading={collectionEventsLoading}
                footer={labRows.length > 0 && <TablePagination
                  total={labRows.length}
                  page={labPage.page}
                  pageSize={pageSize}
                  onPageChange={(page) => setPages((current) => ({ ...current, lab: page }))}
                  onPageSizeChange={changePageSize}
                  label="Lab orders"
                />}
              />
            )}
          </section>}
          {activeSection === 'ag10-critical-alerts-section' && <section aria-labelledby="ag10-critical-alerts-heading">
            <SectionHeading id="ag10-critical-alerts-heading" title="Critical result alerts" count={criticalAlerts?.length || 0} />
            <Card style={{ marginBottom: 10, color: '#64748b', fontSize: 11 }}>
              Alert acknowledgement and closure record alert handling only. They do not change or clear the Lab result.
            </Card>
            {criticalAlertsError ? <UnavailablePanel detail={criticalAlertsError} /> : criticalAlerts === null ? <UnavailablePanel /> : (
              <CriticalAlertsTable
                alerts={criticalAlerts}
                onSelectPatient={onSelectPatient}
                isDoctor={isDoctor}
                currentUserId={currentUserId}
                busyAlertId={alertActionBusy}
                actionErrors={alertActionErrors}
                actionNotices={alertActionNotices}
                closureReasons={closureReasons}
                onClosureReasonChange={(alertId, value) => setClosureReasons((current) => ({ ...current, [alertId]: value }))}
                onAcknowledge={async (alert) => {
                  setAlertActionBusy(alert.alert_id);
                  setAlertActionErrors((current) => ({ ...current, [alert.alert_id]: null }));
                  setAlertActionNotices((current) => ({ ...current, [alert.alert_id]: null }));
                  try {
                    const response = await labCriticalAlertsApi.acknowledge(alert.alert_id);
                    await refreshCriticalAlerts();
                    setAlertActionNotices((current) => ({ ...current, [alert.alert_id]: response.status || 'ACKNOWLEDGED' }));
                  } catch (error) {
                    if (error.status === 409 || error.status === 404) {
                      await refreshCriticalAlerts();
                      setAlertActionNotices((current) => ({ ...current, [alert.alert_id]: 'Alert state changed. Latest state refreshed.' }));
                    } else {
                      setAlertActionErrors((current) => ({
                        ...current,
                        [alert.alert_id]: error.status === 401 || error.status === 403
                          ? 'Access denied: only the assigned Doctor can acknowledge this alert.'
                          : UNAVAILABLE,
                      }));
                    }
                  } finally {
                    setAlertActionBusy(null);
                  }
                }}
                onClose={async (alert) => {
                  const reason = String(closureReasons[alert.alert_id] || '').trim();
                  if (!reason) {
                    setAlertActionErrors((current) => ({ ...current, [alert.alert_id]: 'Enter a closure reason.' }));
                    return;
                  }
                  setAlertActionBusy(alert.alert_id);
                  setAlertActionErrors((current) => ({ ...current, [alert.alert_id]: null }));
                  setAlertActionNotices((current) => ({ ...current, [alert.alert_id]: null }));
                  try {
                    const response = await labCriticalAlertsApi.close(alert.alert_id, reason);
                    await refreshCriticalAlerts();
                    setAlertActionNotices((current) => ({ ...current, [alert.alert_id]: response.status || 'CLOSED' }));
                  } catch (error) {
                    if (error.status === 409 || error.status === 404) {
                      await refreshCriticalAlerts();
                      setAlertActionNotices((current) => ({ ...current, [alert.alert_id]: 'Alert state changed. Latest state refreshed.' }));
                    } else {
                      setAlertActionErrors((current) => ({
                        ...current,
                        [alert.alert_id]: error.status === 401 || error.status === 403
                          ? 'Access denied: only the assigned Doctor can close this alert.'
                          : UNAVAILABLE,
                      }));
                    }
                  } finally {
                    setAlertActionBusy(null);
                  }
                }}
              />
            )}
          </section>}
          {activeSection === 'ag10-radiology-section' && <section aria-labelledby="ag10-radiology-heading">
            <SectionHeading id="ag10-radiology-heading" title="Radiology" count={imagingRows.length + radiologyRows.length} />
            <Card style={{ marginBottom: 10, color: '#64748b', fontSize: 11 }}>
              {isDoctor
                ? 'Doctor coordination uses your existing imaging orders. Study details open through the existing order-authorized read endpoint.'
                : 'Imaging order status, acquired study status, and radiologist review status are displayed separately.'}
            </Card>
            {errors.imaging && <UnavailablePanel detail={'Imaging orders: ' + errors.imaging} />}
            {errors.radiology && <UnavailablePanel detail={'Radiology studies: ' + errors.radiology} />}
            {imaging === null && radiology === null ? <UnavailablePanel /> : (
              <>
                <h3 style={subheadingStyle}>Imaging orders</h3>
                {imaging === null ? <UnavailablePanel /> : (
                  <ImagingTable
                    rows={imagingPage.rows}
                    footer={imagingRows.length > 0 && <TablePagination
                      total={imagingRows.length}
                      page={imagingPage.page}
                      pageSize={pageSize}
                      onPageChange={(page) => setPages((current) => ({ ...current, imaging: page }))}
                      onPageSizeChange={changePageSize}
                      label="imaging orders"
                    />}
                    onSelectPatient={onSelectPatient}
                    isDoctor={isDoctor}
                    onOpenDoctorStudy={openDoctorStudy}
                    fastingEvidenceByOrder={fastingEvidenceByOrder}
                    fastingEvidenceError={fastingEvidenceError}
                    fastingEvidenceLoading={fastingEvidenceLoading}
                    creatinineResultsByPatient={creatinineResultsByPatient}
                    creatinineDataUnavailable={Boolean(errors.lab)}
                    isNurse={isNurse}
                    onRecordFastingEvidence={(orderId) => setFastingCapture({
                      orderId,
                      assertion: 'CONFIRMED',
                      sourceType: 'PATIENT_REPORT',
                      lastMealAt: '',
                      fastingStartedAt: '',
                      error: null,
                    })}
                    canOpenRadiology={canOpenRadiology}
                    onOpenRadiologyOrders={onOpenRadiologyOrders}
                    onOpenRadiologyStudy={onOpenRadiologyStudy}
                  />
                )}
              </>
            )}
          </section>}
          {activeSection === RADIOLOGY_RESULTS_SECTION.id && !isDoctor && <section aria-labelledby="ag10-radiology-results-heading">
            <SectionHeading id="ag10-radiology-results-heading" title="Radiology studies and results" count={radiologyRows.length} />
            {errors.radiology ? <UnavailablePanel detail={'Radiology studies: ' + errors.radiology} /> : radiology === null ? <UnavailablePanel /> : (
              <RadiologyTable
                rows={radiologyPage.rows}
                footer={radiologyRows.length > 0 && <TablePagination
                  total={radiologyRows.length}
                  page={radiologyPage.page}
                  pageSize={pageSize}
                  onPageChange={(page) => setPages((current) => ({ ...current, radiology: page }))}
                  onPageSizeChange={changePageSize}
                  label="radiology studies"
                />}
                onSelectPatient={onSelectPatient}
                canOpenRadiology={canOpenRadiology}
                onOpenRadiologyStudy={onOpenRadiologyStudy}
              />
            )}
          </section>}
        </div>
      )}
      {isDoctor && doctorStudy.study && (
        <DoctorStudySummary
          state={doctorStudy}
          onClose={() => setDoctorStudy({ study: null, loading: false, data: null, error: null })}
        />
      )}
      {isNurse && fastingCapture && (
        <FastingEvidenceModal
          capture={fastingCapture}
          saving={savingFastingOrder === fastingCapture.orderId}
          onChange={(field, value) => setFastingCapture((current) => ({ ...current, [field]: value, error: null }))}
          onSubmit={submitFastingEvidence}
          onClose={() => setFastingCapture(null)}
        />
      )}
    </div>
  );
}

function SectionHeading({ id, title, count }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0 10px' }}>
      <h2 id={id} style={{ margin: 0, fontSize: 16, color: '#17212b' }}>{title}</h2>
      <span style={{ color: '#64748b', fontSize: 11 }}>{count} records</span>
    </div>
  );
}

function UnavailablePanel({ detail }) {
  return (
    <Card style={{ color: '#64748b', fontSize: 12 }}>
      <div>{UNAVAILABLE}</div>
      {detail && <div style={{ marginTop: 4, color: '#8a5a57' }}>{detail}</div>}
    </Card>
  );
}

function NoRecordsPanel() {
  return <Card style={{ color: '#64748b', fontSize: 12 }}>No records found</Card>;
}

function TableFrame({ headers, children, footer }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760, fontSize: 11.5 }}>
          <thead>
            <tr>{headers.map((header) => (
              <th key={header} scope="col" style={thStyle}>{header}</th>
            ))}</tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
      {footer}
    </div>
  );
}

function DataCell({ children }) {
  return <td style={tdStyle}>{children ?? UNAVAILABLE}</td>;
}

function SourceStatus({ value }) {
  if (value === null || value === undefined || String(value).trim() === '') return <span>{UNAVAILABLE}</span>;
  return <StatusBadge status={String(value)} />;
}

function criticalAlertUiStatus(status) {
  if (status === 'CLOSED') return 'Completed';
  if (status === 'OPEN' || status === 'ACKNOWLEDGED') return 'Waiting for Acknowledgement';
  return 'Pending';
}

function getCriticalAlertJourneyStatus(row, alerts) {
  const results = Array.isArray(row.results) ? row.results : [];
  const resultIds = new Set(results.map((result) => result.lab_result_id)
    .filter((id) => id !== null && id !== undefined).map(String));
  const matchingAlert = (alerts || []).find((alert) => resultIds.has(String(alert.lab_result_id)));
  if (matchingAlert) return criticalAlertUiStatus(matchingAlert.status);

  const hasSyntheticQaResult = results.some((result) => ['AG10_CRITICAL_QA', 'AG17_CRITICAL_QA'].includes(result.result_source));
  if (row.critical_qa_eligible || hasSyntheticQaResult) return 'Pending';
  return null;
}

function getLabDisplayedStatus(row, alerts) {
  return getCriticalAlertJourneyStatus(row, alerts) ?? row.status;
}

function CollectionEventDisplay({ event, error, loading }) {
  if (error) return <span>{UNAVAILABLE}</span>;
  if (loading) return <span>Loading…</span>;
  if (!event) return <span>Collection not recorded</span>;
  const states = {
    COLLECTED: 'Collected',
    NOT_COLLECTED: 'Not collected',
    UNABLE_TO_COLLECT: 'Unable to collect',
  };
  return (
    <div style={{ display: 'grid', gap: 3 }}>
      <strong>{states[event.collection_state] || UNAVAILABLE}</strong>
      <span>Recorded: {formatDate(event.recorded_at)}</span>
      <span>Source: {display(event.source_type)}</span>
      <span>Actor: {display(event.actor_name)} · {display(event.actor_role)}</span>
    </div>
  );
}

function LabTable({ rows, criticalAlerts, onSelectPatient, footer, collectionEventsByOrder, collectionEventsError, collectionEventsLoading }) {
  if (!rows.length) return <NoRecordsPanel />;
  return (
    <TableFrame headers={['Patient', 'Test', 'Order ID', 'Lab order status', 'Specimen collection', 'Priority', 'Ordered', 'Results']} footer={footer}>
      {rows.map((row, index) => {
        const displayedStatus = getLabDisplayedStatus(row, criticalAlerts);
        return (
          <tr key={row.lab_order_id ?? row.order_number ?? index}>
            <DataCell><PatientLink row={row} onSelectPatient={onSelectPatient} /></DataCell>
            <DataCell>{display(row.test_name)}</DataCell>
            <DataCell>{display(row.order_number || row.lab_order_id)}</DataCell>
            <DataCell><SourceStatus value={displayedStatus} /></DataCell>
            <DataCell>
              <CollectionEventDisplay
                event={collectionEventsByOrder?.[row.lab_order_id]}
                error={collectionEventsError}
                loading={collectionEventsLoading}
              />
            </DataCell>
            <DataCell>{display(row.priority)}</DataCell>
            <DataCell>{formatDate(row.ordered_date)}</DataCell>
            <DataCell><ResultSummary results={row.results} /></DataCell>
          </tr>
        );
      })}
    </TableFrame>
  );
}

function CriticalAlertsTable({
  alerts,
  onSelectPatient,
  isDoctor,
  currentUserId,
  busyAlertId,
  actionErrors,
  actionNotices,
  closureReasons,
  onClosureReasonChange,
  onAcknowledge,
  onClose,
}) {
  if (!alerts.length) return <NoRecordsPanel />;
  return (
    <TableFrame headers={['Patient / Lab order', 'Parameter / value', 'Verified result time', 'Matched rule', 'Alert status', 'Intended recipient', 'Acknowledgement / actions']}>
      {alerts.map((alert) => {
        const recipients = Array.isArray(alert.recipients) ? alert.recipients : [];
        const acknowledgement = alert.acknowledgement;
        const assignedDoctor = isDoctor && currentUserId !== null && recipients.some((recipient) => (
          String(recipient.user_id) === currentUserId && String(recipient.recipient_type || '').toUpperCase() === 'ORDERING_DOCTOR'
        ));
        const isBusy = busyAlertId === alert.alert_id;
        const actionError = actionErrors?.[alert.alert_id];
        const actionNotice = actionNotices?.[alert.alert_id];
        return (
          <tr key={alert.alert_id}>
            <DataCell>
              <PatientLink row={alert} onSelectPatient={onSelectPatient} />
              <div>Lab order: {display(alert.lab_order_id)}</div>
            </DataCell>
            <DataCell>
              <strong>{display(alert.parameter_snapshot)}</strong>
              <div>{display(alert.result_value_snapshot)} {display(alert.unit_snapshot)}</div>
            </DataCell>
            <DataCell>{formatDate(alert.normalized_verified_result_time)}</DataCell>
            <DataCell>Rule {display(alert.rule_id)} · version {display(alert.rule_version)}</DataCell>
            <DataCell><StatusBadge status={criticalAlertUiStatus(alert.status)} /></DataCell>
            <DataCell>
              {alert.recipient_resolution_status === 'UNRESOLVED' || !recipients.length
                ? 'Unresolved'
                : recipients.map((recipient) => display(recipient.display_name) + ' · ' + display(recipient.role)).join(', ')}
            </DataCell>
            <DataCell>
              <div style={{ display: 'grid', gap: 7 }}>
                {acknowledgement
                  ? <>
                    <strong>Doctor action recorded</strong>
                    <span>{display(acknowledgement.actor_name || acknowledgement.actor_id)} · {display(acknowledgement.actor_role)}</span>
                    <span>{formatDate(acknowledgement.timestamp)}</span>
                  </>
                  : 'No Doctor action recorded yet'}
                {assignedDoctor && alert.status === 'OPEN' && (
                  <button type="button" disabled={isBusy} onClick={() => onAcknowledge(alert)} style={alertActionButtonStyle}>
                    {isBusy ? 'Saving…' : 'Acknowledge Critical Alert'}
                  </button>
                )}
                {assignedDoctor && alert.status === 'ACKNOWLEDGED' && (
                  <div style={{ display: 'grid', gap: 6 }}>
                    <label style={{ display: 'grid', gap: 4 }}>
                      <span>Closure reason (required)</span>
                      <textarea
                        aria-label={`Closure reason for alert ${alert.alert_id}`}
                        value={closureReasons?.[alert.alert_id] || ''}
                        onChange={(event) => onClosureReasonChange(alert.alert_id, event.target.value)}
                        placeholder="Reviewed result and initiated clinical follow-up"
                        maxLength={2000}
                        rows={3}
                        style={closureReasonStyle}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={isBusy || !String(closureReasons?.[alert.alert_id] || '').trim()}
                      onClick={() => onClose(alert)}
                      style={alertActionButtonStyle}
                    >
                      {isBusy ? 'Saving…' : 'Close Alert'}
                    </button>
                  </div>
                )}
                {actionError && <span role="alert" style={{ color: '#9f2d2d' }}>{actionError}</span>}
                {actionNotice && <span role="status" aria-live="polite">
                  {actionNotice === 'ACKNOWLEDGED' || actionNotice === 'OPEN'
                    ? 'Waiting for Acknowledgement'
                    : actionNotice === 'CLOSED' ? 'Completed' : actionNotice}
                </span>}
              </div>
            </DataCell>
          </tr>
        );
      })}
    </TableFrame>
  );
}

function ImagingTable({ rows, footer, onSelectPatient, isDoctor, onOpenDoctorStudy, fastingEvidenceByOrder, fastingEvidenceError, fastingEvidenceLoading, creatinineResultsByPatient, creatinineDataUnavailable, isNurse, onRecordFastingEvidence, canOpenRadiology, onOpenRadiologyOrders, onOpenRadiologyStudy }) {
  if (!rows.length) return <NoRecordsPanel />;
  return (
    <TableFrame headers={['Patient', isDoctor ? 'Modality / examination' : 'Examination', 'Accession', 'Order status', 'Priority', 'Requested', 'Fasting/NPO evidence', 'Creatinine/eGFR', isDoctor ? 'Study / report status' : 'Acquired study status']} footer={footer}>
      {rows.map((row, index) => {
        const notApplicable = isPlainChestXray(row.examination);
        const orderDisplayStatus = getAg10RadiologyOrderStatus(row);
        return (
          <tr key={row.order_id || index}>
          <DataCell><PatientLink row={row} onSelectPatient={onSelectPatient} /></DataCell>
          <DataCell>{display(row.examination)}</DataCell>
          <DataCell>
            <div>{display(row.accession_number)}</div>
            {canOpenRadiology && row.order_id && onOpenRadiologyOrders && (
              <TextLink onClick={onOpenRadiologyOrders}>Open Radiology orders</TextLink>
            )}
          </DataCell>
          <DataCell><SourceStatus value={orderDisplayStatus} /></DataCell>
          <DataCell>{display(row.priority)}</DataCell>
          <DataCell>{formatDate(row.created_at)}</DataCell>
          <DataCell>
            <FastingEvidenceDisplay
              item={fastingEvidenceByOrder[row.order_id]}
              error={fastingEvidenceError}
              loading={fastingEvidenceLoading}
              isNurse={isNurse}
              orderId={row.order_id}
              onRecord={onRecordFastingEvidence}
              notApplicable={notApplicable}
            />
          </DataCell>
          <DataCell>
            <CreatinineEvidenceDisplay
              result={creatinineResultsByPatient?.[String(row.patient_id)] || creatinineResultsByPatient?.[String(row.patient_code)]}
              unavailable={creatinineDataUnavailable}
              notApplicable={notApplicable}
            />
          </DataCell>
          <DataCell>
            <StudyStatuses
              studies={row.studies}
              orderStatus={orderDisplayStatus}
              isDoctor={isDoctor}
              onOpenDoctorStudy={onOpenDoctorStudy}
              canOpenRadiology={canOpenRadiology}
              onOpenRadiologyStudy={onOpenRadiologyStudy}
            />
          </DataCell>
        </tr>
        );
      })}
    </TableFrame>
  );
}

function CreatinineEvidenceDisplay({ result, unavailable, notApplicable }) {
  if (notApplicable) return <div aria-disabled="true" style={notApplicableEvidenceStyle}>Not required for plain X-ray</div>;
  if (unavailable || !result) return <span>{UNAVAILABLE}</span>;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      <strong>{display(result.parameter)}</strong>
      <span>{display(result.value)} {display(result.unit)}</span>
      <span>Verification: {display(result.verification_status)}</span>
      {result.result_date && <span>Result time: {formatDate(result.result_date)}</span>}
    </div>
  );
}

function RadiologyTable({ rows, footer, onSelectPatient, canOpenRadiology, onOpenRadiologyStudy }) {
  if (!rows.length) return <NoRecordsPanel />;
  return (
    <TableFrame headers={['Patient', 'Study', 'Modality / View', 'AI assessment status', 'Radiologist review status', 'Report / finding', 'Analyzed']} footer={footer}>
      {rows.map((row, index) => (
        <tr key={row.study_id || row.display_study_id || index}>
          <DataCell><PatientLink row={row} onSelectPatient={onSelectPatient} /></DataCell>
          <DataCell>
            {canOpenRadiology && row.study_id && onOpenRadiologyStudy
              ? <TextLink onClick={() => onOpenRadiologyStudy(row.study_id)}>{display(row.display_study_id || row.study_id)}</TextLink>
              : display(row.display_study_id || row.study_id)}
          </DataCell>
          <DataCell>{[row.metadata?.modality, row.metadata?.view_position].filter(Boolean).join(' / ') || UNAVAILABLE}</DataCell>
          <DataCell><SourceStatus value={row.combined_assessment?.status} /></DataCell>
          <DataCell><SourceStatus value={row.review_status} /></DataCell>
          <DataCell>{display(row.radiologist_report || row.scan_report || row.radiologist_finding)}</DataCell>
          <DataCell>{formatDate(row.analyzed_at || row.created_at)}</DataCell>
        </tr>
      ))}
    </TableFrame>
  );
}

function ResultSummary({ results }) {
  if (!Array.isArray(results) || results.length === 0) return <span>{UNAVAILABLE}</span>;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {results.map((result, index) => (
        <div key={result.lab_result_id ?? index}>
          {display(result.parameter)}: {display(result.value)} {display(result.unit)}
          {' · Reference: '}{display(result.reference_range)}
          {' · Abnormal flag: '}{result.is_abnormal === true ? 'Yes' : result.is_abnormal === false ? 'No' : UNAVAILABLE}
          {' · Verification: '}{display(result.verification_status)}
          {result.result_label && <div>{result.result_label}</div>}
        </div>
      ))}
    </div>
  );
}

function StudyStatuses({ studies, orderStatus, isDoctor, onOpenDoctorStudy, canOpenRadiology, onOpenRadiologyStudy }) {
  if (!Array.isArray(studies) || studies.length === 0) return <span>{UNAVAILABLE}</span>;
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {studies.map((study, index) => (
        <div key={study.study_key || index}>
          {study.projection || UNAVAILABLE}: {display(study.status)}
              {isDoctor ? ' · Report/review: ' : ' · Review: '}{display(study.review_status)}
          {orderStatus === 'Completed'
            && FINAL_RADIOLOGIST_REVIEW_STATUSES.has(String(study.review_status || '').trim())
            && String(study.reviewed_by || '').trim()
            && (
              <div>
                Reviewed by: {study.reviewed_by}
                {study.reviewed_at ? ` · Reviewed on: ${formatDate(study.reviewed_at)}` : ''}
              </div>
            )}
          {isDoctor && study.study_id && onOpenDoctorStudy && (
            <div><TextLink onClick={() => onOpenDoctorStudy({ ...study, order_status: orderStatus })}>View read-only result summary</TextLink></div>
          )}
          {canOpenRadiology && study.study_id && onOpenRadiologyStudy && (
            <div><TextLink onClick={() => onOpenRadiologyStudy(study.study_id)}>Open study</TextLink></div>
          )}
        </div>
      ))}
    </div>
  );
}

function PatientLink({ row, onSelectPatient }) {
  const patientId = row.patient_id ?? row.metadata?.patient_id_mapped;
  const patientName = row.patient_name || row.metadata?.patient_name;
  const patientCode = row.patient_code || row.metadata?.patient_code;
  if (!patientId || !onSelectPatient) {
    return <>{display(patientName)} · {display(patientCode || patientId)}</>;
  }
  return (
    <TextLink onClick={() => onSelectPatient({
      id: patientId,
      patient_id: patientId,
      patient_number: patientCode,
      patient_code: patientCode,
      name: patientName,
      patient_name: patientName,
      uhid: patientCode,
    })}>
      {display(patientName)} · {display(patientCode || patientId)}
    </TextLink>
  );
}

function TextLink({ children, onClick }) {
  return (
    <button type="button" onClick={onClick} style={textLinkStyle}>
      {children}
    </button>
  );
}

function FastingEvidenceDisplay({ item, error, loading, isNurse, orderId, onRecord, notApplicable }) {
  if (notApplicable) return <div aria-disabled="true" style={notApplicableEvidenceStyle}>Not required for plain X-ray</div>;
  if (error) return <div>{UNAVAILABLE}<div style={{ color: '#8a5a57', marginTop: 3 }}>{error}</div></div>;
  if (loading) return <span>Loading…</span>;

  const evidence = item?.latest_evidence;
  const assertionLabels = {
    CONFIRMED: 'Fasting/NPO: Confirmed',
    NOT_CONFIRMED: 'Fasting/NPO: Not confirmed',
    UNABLE_TO_CONFIRM: 'Fasting/NPO: Unable to confirm',
  };
  const sourceLabels = {
    PATIENT_REPORT: 'Patient report',
    CAREGIVER_REPORT: 'Caregiver report',
    CHART_REVIEW: 'Chart review',
    OTHER: 'Other',
  };
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {evidence ? (
        <>
          <strong>{assertionLabels[evidence.assertion] || UNAVAILABLE}</strong>
          <span>Source: {sourceLabels[evidence.source_type] || display(evidence.source_type)}</span>
          <span>Actor: {display(evidence.recorded_by_name)} · {display(evidence.recorded_by_role)}</span>
          <span>Recorded: {formatDate(evidence.recorded_at)}</span>
          {evidence.last_meal_at && <span>Last meal: {formatDate(evidence.last_meal_at)}</span>}
          {evidence.fasting_started_at && <span>Fasting started: {formatDate(evidence.fasting_started_at)}</span>}
        </>
      ) : <strong>Manual verification required</strong>}
      {isNurse && orderId && (
        <button type="button" onClick={() => onRecord(orderId)} style={textLinkStyle}>
          Record new evidence
        </button>
      )}
    </div>
  );
}

function FastingEvidenceModal({ capture, saving, onChange, onSubmit, onClose }) {
  return (
    <div role="presentation" onClick={saving ? undefined : onClose} style={modalBackdropStyle}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="fasting-evidence-heading"
        onClick={(event) => event.stopPropagation()}
        style={modalStyle}
      >
        <h2 id="fasting-evidence-heading" style={{ margin: '0 0 8px', fontSize: 16 }}>Record fasting/NPO evidence</h2>
        <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: 12 }}>
          This appends a source statement to this imaging order. It does not determine or approve clinical readiness.
        </p>
        <form onSubmit={onSubmit} style={{ display: 'grid', gap: 12 }}>
          <label style={formLabelStyle}>
            Recorded assertion
            <select value={capture.assertion} onChange={(event) => onChange('assertion', event.target.value)} style={inputStyle}>
              <option value="CONFIRMED">Confirmed</option>
              <option value="NOT_CONFIRMED">Not confirmed</option>
              <option value="UNABLE_TO_CONFIRM">Unable to confirm</option>
            </select>
          </label>
          <label style={formLabelStyle}>
            Evidence source
            <select value={capture.sourceType} onChange={(event) => onChange('sourceType', event.target.value)} style={inputStyle} required>
              <option value="PATIENT_REPORT">Patient report</option>
              <option value="CAREGIVER_REPORT">Caregiver report</option>
              <option value="CHART_REVIEW">Chart review</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label style={formLabelStyle}>
            Last meal time (optional)
            <input type="datetime-local" value={capture.lastMealAt} onChange={(event) => onChange('lastMealAt', event.target.value)} style={inputStyle} />
          </label>
          <label style={formLabelStyle}>
            Fasting start time (optional)
            <input type="datetime-local" value={capture.fastingStartedAt} onChange={(event) => onChange('fastingStartedAt', event.target.value)} style={inputStyle} />
          </label>
          {capture.assertion === 'CONFIRMED' && <div style={{ color: '#64748b', fontSize: 11 }}>A confirmation requires at least one of the two times above.</div>}
          {capture.error && <div role="alert" style={{ color: '#9f2d2d', fontSize: 12 }}>{capture.error}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button type="button" onClick={onClose} disabled={saving} style={buttonStyle}>Cancel</button>
            <button type="submit" disabled={saving} style={{ ...buttonStyle, background: '#0f5b66', color: '#fff' }}>
              {saving ? 'Recording…' : 'Record evidence'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function DoctorStudySummary({ state, onClose }) {
  const { study, loading, data, error } = state;
  const confirmedStatuses = new Set(['Confirmed', 'Confirmed (Finding Revised)']);
  const reviewStatus = data?.review_status ?? study?.review_status;
  const report = confirmedStatuses.has(String(reviewStatus || ''))
    ? (data?.radiologist_report || data?.scan_report)
    : null;
  return (
    <div role="presentation" onClick={onClose} style={modalBackdropStyle}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="doctor-radiology-summary-heading"
        onClick={(event) => event.stopPropagation()}
        style={modalStyle}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <h2 id="doctor-radiology-summary-heading" style={{ margin: 0, fontSize: 16 }}>Radiology result summary</h2>
          <button type="button" onClick={onClose} style={buttonStyle}>Close</button>
        </div>
        {loading ? <p>{UNAVAILABLE} while loading.</p> : error ? <UnavailablePanel detail={error} /> : (
          <dl style={definitionListStyle}>
            <SummaryField label="Accession" value={data?.display_study_id} />
            <SummaryField label="Modality / type" value={[data?.metadata?.modality, data?.projection || data?.metadata?.view_position].filter(Boolean).join(' / ')} />
            <SummaryField label="Order status" value={study?.order_status} />
            <SummaryField label="Study / procedure status" value={study?.status} />
            <SummaryField label="Report / review status" value={reviewStatus} />
            <SummaryField label="Study date" value={data?.analyzed_at} date />
            <SummaryField label="Report date" value={data?.reviewed_at} date />
            <SummaryField label="Final report summary" value={report} />
          </dl>
        )}
      </section>
    </div>
  );
}

function SummaryField({ label, value, date = false }) {
  return <>
    <dt style={summaryLabelStyle}>{label}</dt>
    <dd style={summaryValueStyle}>{date ? formatDate(value) : display(value)}</dd>
  </>;
}

const thStyle = {
  textAlign: 'left',
  padding: '10px 11px',
  color: '#52606d',
  background: '#f8fafc',
  borderBottom: '1px solid #e2e8f0',
  whiteSpace: 'nowrap',
};
const tdStyle = {
  textAlign: 'left',
  verticalAlign: 'top',
  padding: '10px 11px',
  borderBottom: '1px solid #eef2f6',
  color: '#24313d',
};
const subheadingStyle = {
  fontSize: 12,
  color: '#475569',
  margin: '12px 0 8px',
};
const inputStyle = {
  height: 34,
  minWidth: 220,
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  padding: '0 9px',
  fontSize: 12,
  background: '#fff',
};
const buttonStyle = {
  height: 34,
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  padding: '0 12px',
  background: '#fff',
  color: '#24313d',
  fontSize: 12,
  cursor: 'pointer',
};
const alertActionButtonStyle = {
  ...buttonStyle,
  width: 'fit-content',
  minHeight: 34,
  height: 'auto',
  padding: '7px 10px',
  background: '#f8fafc',
  color: '#1e3a5f',
  fontWeight: 600,
};
const closureReasonStyle = {
  minWidth: 190,
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  padding: 8,
  font: 'inherit',
  resize: 'vertical',
};
const notApplicableEvidenceStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '5px 8px',
  border: '1px solid #d1d5db',
  borderRadius: 6,
  background: '#f3f4f6',
  color: '#6b7280',
  fontSize: 10.5,
  fontWeight: 600,
};
const textLinkStyle = {
  border: 0,
  padding: 0,
  background: 'transparent',
  color: '#0f5b66',
  fontSize: 'inherit',
  fontFamily: 'inherit',
  textAlign: 'left',
  textDecoration: 'underline',
  textUnderlineOffset: 2,
  cursor: 'pointer',
};
const modalBackdropStyle = {
  position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15, 23, 42, .42)',
  display: 'grid', placeItems: 'center', padding: 16,
};
const modalStyle = {
  width: 'min(640px, 100%)', maxHeight: '85vh', overflow: 'auto', background: '#fff',
  borderRadius: 10, padding: 18, boxShadow: '0 18px 50px rgba(15, 23, 42, .25)',
};
const definitionListStyle = {
  display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 2fr', gap: '8px 14px', margin: '18px 0 0',
};
const summaryLabelStyle = { color: '#52606d', fontSize: 12 };
const summaryValueStyle = { margin: 0, color: '#24313d', fontSize: 12, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
const formLabelStyle = { display: 'grid', gap: 5, color: '#334155', fontSize: 12, fontWeight: 600 };
