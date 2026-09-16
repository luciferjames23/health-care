/*
 * Meridian Radiology integration bridge.
 *
 * This is intentionally additive: it hooks only the three approved prototype
 * pages (laboratory/Results & Critical Values, diagnostics, radiology) and
 * reads/writes the same in-memory prototype store so the Meridian shell,
 * navigation, mock data and unrelated modules remain untouched.
 */
(function () {
  'use strict';

  const API_BASE = window.__MERIDIAN_API_BASE__ || 'http://127.0.0.1:8000';
  const POLL_MS = 5000;
  let wired = false;
  let fileInput = null;

  const json = async (url, options) => {
    const response = await fetch(url, options);
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.detail || `HTTP ${response.status}`);
    return body;
  };

  function component() {
    return window.__meridianComponent;
  }

  function api() {
    const c = component();
    return c && c.api;
  }

  function formatPercent(v) {
    return `${Math.round(Number(v || 0) * 100)}%`;
  }

  function safePatientName(r) {
    return (r.metadata && r.metadata.patient_name) || 'DICOM patient';
  }

  function studyLabel(r) {
    return r.display_study_id || r.study_id;
  }

  function statusPriority(r) {
    return r.combined_assessment?.status || 'ROUTINE';
  }

  function priorityLabel(r) {
    return statusPriority(r) === 'ROUTINE' ? 'Routine' : statusPriority(r);
  }

  function mergeStudyIntoPrototype(record) {
    const a = api();
    if (!a) return;
    const S = a.S;
    const status = record.combined_assessment.status;
    const existing = S.radiology.find(x => x.radiologyStudyId === record.study_id || x.id === record.study_id);
    const radiology = existing || {
      id: record.study_id,
      radiologyStudyId: record.study_id,
      orderId: 'RAD-AI-' + record.study_id.slice(0, 8),
      patientId: record.metadata?.patient_id || 'DICOM-' + record.study_id.slice(0, 8),
      patient: safePatientName(record),
      modality: record.metadata?.modality || 'X-ray',
      study: record.metadata?.series_description || 'Chest X-ray',
      received: a.clock(),
      aiStatus: 'Screened',
      aiProb: record.triage.probability,
      priority: status === 'ROUTINE' ? 'Routine' : 'Priority',
      aiPriority: status,
      model: 'DenseNet121 + YOLO11n',
      radStatus: existing?.radStatus || 'Unread',
      final: existing?.final || '—',
      readBy: existing?.readBy,
      viewed: !!record.viewed,
      viewedAt: record.viewed_at,
      source: record.source,
      result: record,
      displayStudyId: studyLabel(record),
    };
    Object.assign(radiology, {
      patient: safePatientName(record),
      modality: record.metadata?.modality || radiology.modality,
      study: record.metadata?.series_description || radiology.study,
      aiStatus: 'Screened',
      aiProb: record.triage.probability,
      priority: status === 'ROUTINE' ? 'Routine' : 'Priority',
      aiPriority: status,
      model: 'DenseNet121 + YOLO11n',
      viewed: !!record.viewed,
      viewedAt: record.viewed_at,
      source: record.source,
      result: record,
      displayStudyId: studyLabel(record),
    });
    if (!existing) S.radiology.unshift(radiology);

    // Diagnostics: one order record pointing to the same stored study/result.
    if (!S.orders.some(x => x.radiologyStudyId === record.study_id)) {
      S.orders.unshift({
        id: radiology.orderId,
        radiologyStudyId: record.study_id,
        patientId: radiology.patientId,
        patient: radiology.patient,
        doctor: 'Radiology AI / Demo PACS',
        kind: 'Radiology',
        test: radiology.study,
        ts: a.clock(),
        status: 'Resulted',
        prep: 'As per guide',
      });
    }

    // Results & Critical Values: add attention rows only for AI review priority.
    // They are explicitly non-critical and use the existing laboratory renderer.
    if (status !== 'ROUTINE' && !S.labs.some(x => x.radiologyStudyId === record.study_id)) {
      S.labs.unshift({
        id: 'RAD-AI-' + record.study_id.slice(0, 10),
        radiologyStudyId: record.study_id,
        orderId: radiology.orderId,
        patientId: radiology.patientId,
        patient: radiology.patient,
        test: 'Radiology AI',
        analyte: 'Suspected lung opacity',
        value: formatPercent(record.triage.probability),
        unit: 'AI triage probability',
        flag: status,
        critical: false,
        acked: false,
        clinician: 'Radiologist review',
        ts: a.clock(),
        status: 'Final',
        aiAttention: true,
      });
    }
  }

  async function refresh() {
    const a = api();
    if (!a) return;
    try {
      const result = await json(`${API_BASE}/api/radiology/worklist`);
      (result.studies || []).forEach(mergeStudyIntoPrototype);
      a._h.emit();
    } catch (err) {
      // The rest of Meridian must remain usable if the optional Radiology API
      // is unavailable. Do not fabricate AI data as a fallback.
      window.__meridianRadiologyBridgeError = String(err.message || err);
    }
  }

  async function markViewed(studyId) {
    try {
      await json(`${API_BASE}/api/radiology/studies/${encodeURIComponent(studyId)}/viewed`, { method: 'POST' });
    } catch (err) {
      window.__meridianRadiologyBridgeError = String(err.message || err);
    }
  }

  async function openStudy(studyId) {
    const result = await json(`${API_BASE}/api/radiology/studies/${encodeURIComponent(studyId)}`);
    mergeStudyIntoPrototype(result);
    const a = api();
    if (a) a._h.emit();
    return result;
  }

  function ensureFileInput() {
    if (fileInput) return fileInput;
    fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.dcm,.dicom,application/dicom';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      try {
        const form = new FormData();
        form.append('file', file);
        const result = await json(`${API_BASE}/api/radiology/analyze`, { method: 'POST', body: form });
        mergeStudyIntoPrototype(result);
        const a = api();
        if (a) {
          a._h.emit();
          setTimeout(() => a.S.radiology.find(x => x.radiologyStudyId === result.study_id) && a._h.emit(), 20);
        }
        // Open the same Meridian drawer as a worklist row; no second inference.
        const c = component();
        if (c) c.setState({ drawer: { kind: 'radiology', id: result.study_id } });
      } catch (err) {
        const c = component();
        if (c && c.api) c.api.notify('Radiology analysis failed', String(err.message || err), 'High', 'Radiology AI', { page: 'radiology' });
      }
    });
    return fileInput;
  }

  function makeFilters(ctx) {
    return ['All', 'HIGH PRIORITY', 'REVIEW FLAG', 'ROUTINE'].map(label => ({
      label,
      active: (ctx.filter || 'All') === label,
      on: () => ctx.setFilter(label),
      bg: (ctx.filter || 'All') === label ? '#15181b' : '#fff',
      c: (ctx.filter || 'All') === label ? '#fff' : '#52585e',
    }));
  }

  function buildRadiologyList(original, ctx, base) {
    const a = api();
    const S = a.S;
    const L = original('radiology');
    const records = S.radiology.filter(r => r.result && r.radiologyStudyId);
    const filter = ctx.filter || 'All';
    const q = String(ctx.q || '').toLowerCase();
    const filtered = records.filter(r => {
      const status = r.aiPriority || 'ROUTINE';
      const matchesFilter = filter === 'All' || status === filter;
      const hay = [r.displayStudyId, r.id, r.patient, r.study, r.modality, status].join(' ').toLowerCase();
      return matchesFilter && (!q || hay.includes(q));
    }).sort((x, y) => {
      const viewed = Number(!!x.viewed) - Number(!!y.viewed);
      if (viewed) return viewed;
      const rank = { 'HIGH PRIORITY': 0, 'REVIEW FLAG': 1, 'ROUTINE': 2 };
      const sr = (rank[x.aiPriority] ?? 3) - (rank[y.aiPriority] ?? 3);
      return sr || (y.aiProb || 0) - (x.aiProb || 0);
    });

    L.title = 'Radiology worklist';
    L.sub = 'AI SCREENING / PRIORITIZATION ONLY — one stored study/result feeds Radiology, Diagnostics and Results & Critical Values. Final interpretation belongs to the radiologist.';
    L.banner = { kind: 'warn', text: 'Orthanc is Demo PACS only. AI output is decision support: HIGH PRIORITY and REVIEW FLAG are triage/review states, not confirmed clinical critical results.', action: 'Refresh Demo PACS', on: async () => { try { await json(`${API_BASE}/api/pacs/studies`); await refresh(); } catch (err) { window.__meridianRadiologyBridgeError = String(err.message || err); } } };
    L.hasUpload = true;
    L.upload = () => ensureFileInput().click();
    L.filters = makeFilters(ctx);
    L.stats = [
      ['Total Analyzed', records.length],
      ['High Priority', records.filter(r => r.aiPriority === 'HIGH PRIORITY').length],
      ['Review Flag', records.filter(r => r.aiPriority === 'REVIEW FLAG').length],
      ['Routine', records.filter(r => r.aiPriority === 'ROUTINE').length],
    ].map(([k, v]) => ({ k, v, c: '' }));
    L.cols = [['Study', 120], ['Patient', 160], ['Modality', 70], ['Study', 130], ['Received', 100], ['AI status', 90], ['Priority', 100], ['AI probability', 100], ['Radiologist', 90], ['Final status', 160]];
    L.rows = filtered.map(r => ({
      id: r.radiologyStudyId,
      cells: [
        { t: r.displayStudyId || r.id, m: true },
        { t: r.patient, b: true },
        { t: r.modality },
        { t: r.study },
        { t: r.result.analyzed_at ? new Date(r.result.analyzed_at).toLocaleString() : '—', m: true },
        { t: 'Screened', ...a._h ? {} : {} },
        { t: priorityLabel(r), ...pillFor(priorityLabel(r)) },
        { t: formatPercent(r.aiProb), m: true },
        { t: r.radStatus || 'Unread', ...pillFor(r.radStatus || 'Unread') },
        { t: (r.final && r.final !== '—' ? r.final + ' · ' : '') + 'View Analysis' },
      ],
      go: async () => {
        await markViewed(r.radiologyStudyId);
        const local = S.radiology.find(x => x.radiologyStudyId === r.radiologyStudyId);
        if (local) { local.viewed = true; local.viewedAt = new Date().toISOString(); }
        await openStudy(r.radiologyStudyId).catch(() => null);
        component().setState({ drawer: { kind: 'radiology', id: r.radiologyStudyId } });
      },
    }));
    return L;
  }

  function pillFor(text) {
    if (text === 'HIGH PRIORITY') return { pill: true, bg: '#f6d8d8', fg: '#9a1f1f' };
    if (text === 'REVIEW FLAG') return { pill: true, bg: '#fff1d6', fg: '#8a5a00' };
    if (text === 'ROUTINE') return { pill: true, bg: '#e9f5ed', fg: '#25613b' };
    return { pill: true, bg: '#eef0f1', fg: '#52585e' };
  }

  function buildDiagnosticsList(original, ctx, base) {
    const L = original('diagnostics');
    const a = api();
    const radiologyOrders = a.S.orders.filter(o => o.radiologyStudyId);
    if (!radiologyOrders.length) return L;
    const q = String(ctx.q || '').toLowerCase();
    const normalRows = (L.rows || []).filter(row => !a.S.orders.find(o => o.id === row.id && o.radiologyStudyId));
    const rows = radiologyOrders.filter(o => !q || [o.id, o.patient, o.test, o.kind].join(' ').toLowerCase().includes(q)).map(o => {
      const r = a.S.radiology.find(x => x.radiologyStudyId === o.radiologyStudyId);
      const result = r && r.result;
      return {
        id: o.id,
        cells: [
          { t: o.id, m: true }, { t: o.patient, b: true }, { t: o.test }, { t: 'Radiology' },
          { t: o.prep }, { t: result?.metadata?.study_date || 'DICOM' }, { t: 'Completed' }, { t: 'Resulted', pill: true, bg: '#e9f5ed', fg: '#25613b' },
        ],
        go: () => component().setState({ drawer: { kind: 'order', id: o.id } }),
      };
    });
    L.rows = rows.concat(normalRows);
    L.sub = 'Diagnostic coordination · radiology studies use the same stored AI result shown in Radiology and Results & Critical Values. No repeat inference on navigation.';
    return L;
  }

  function buildLabList(original, ctx, base) {
    const L = original('laboratory');
    const a = api();
    const attention = a.S.labs.filter(l => l.aiAttention && l.radiologyStudyId);
    if (!attention.length) return L;
    const rows = (L.rows || []).filter(row => !attention.some(x => x.id === row.id));
    const extra = attention.filter(l => {
      const q = String(ctx.q || '').toLowerCase();
      return !q || [l.id, l.patient, l.test, l.analyte, l.flag].join(' ').toLowerCase().includes(q);
    }).map(l => ({
      id: l.id,
      cells: [
        { t: l.id, m: true }, { t: l.patient, b: true }, { t: l.test }, { t: l.analyte },
        { t: l.value + ' · ' + l.unit, m: true }, { t: l.flag, ...pillFor(l.flag) }, { t: 'Radiologist review' },
        { t: '—' }, { t: new Date().toLocaleString(), m: true }, { t: 'Final', pill: true, bg: '#e9f5ed', fg: '#25613b' },
      ],
      go: async () => {
        await markViewed(l.radiologyStudyId);
        await openStudy(l.radiologyStudyId).catch(() => null);
        component().setState({ drawer: { kind: 'lab', id: l.id } });
      },
    }));
    L.rows = extra.concat(rows);
    L.sub = 'Results & Critical Values · AI-assisted radiology attention items are shown for HIGH PRIORITY / REVIEW FLAG only. These are not confirmed clinical critical values.';
    return L;
  }

  function buildDetail(kind, id, original, ctx, base) {
    const a = api();
    const S = a.S;
    if (kind === 'radiology') {
      const r = S.radiology.find(x => x.radiologyStudyId === id || x.id === id);
      if (!r || !r.result) return original(kind, id, ctx, base);
      const x = r.result;
      const status = x.combined_assessment.status;
      const D = original(kind, id, ctx, base);
      D.title = `${x.metadata?.series_description || 'Chest X-ray'} · ${safePatientName(x)}`;
      D.sub = `${studyLabel(x)} · ${x.metadata?.modality || 'X-ray'} · ${x.analyzed_at ? new Date(x.analyzed_at).toLocaleString() : 'analysis complete'}`;
      D.badges = [
        { t: 'Screened', ...pillFor('Screened') },
        { t: status, ...pillFor(status) },
        { t: r.viewed ? 'Viewed' : 'Unviewed', ...pillFor(r.viewed ? 'Viewed' : 'Unread') },
      ];
      D.image = 'Radiology AI result';
      D.imageSrc = `data:image/png;base64,${x.images.original}`;
      D.facts = [
        { k: 'Study ID', v: studyLabel(x) },
        { k: 'DICOM patient', v: safePatientName(x) + (x.metadata?.patient_id ? ' · ' + x.metadata.patient_id : '') },
        { k: 'Modality', v: x.metadata?.modality || '—' },
        { k: 'Study status', v: 'AI analysis complete' },
        { k: 'AI processing', v: 'DenseNet121 + YOLO11n complete' },
        { k: 'AI triage', v: status },
        { k: 'Radiologist review', v: r.radStatus || 'Unread' },
        { k: 'DenseNet probability', v: formatPercent(x.triage.probability) + ' · threshold 20%' },
        { k: 'YOLO localization', v: x.localization.opacity_detected ? `${x.localization.number_of_regions} region(s) · threshold 10%` : 'No qualifying region · threshold 10%' },
      ];
      D.sections = [
        { title: 'Combined Assessment', items: [
          { k: 'Status', v: status },
          { k: 'Agreement', v: x.combined_assessment.agreement ? 'Agreement' : 'Disagreement' },
          { k: 'Reason', v: x.combined_assessment.reason },
        ]},
        { title: 'AI Localization', items: x.localization.regions.map((reg, i) => ({ k: `Region ${i + 1}`, v: `${formatPercent(reg.confidence)} · (${Math.round(reg.x1)}, ${Math.round(reg.y1)}) → (${Math.round(reg.x2)}, ${Math.round(reg.y2)})` })) },
        { title: 'Clinical wording', items: [
          { k: 'Finding', v: x.interpretation.finding },
          { k: 'Action', v: x.interpretation.recommended_action },
          { k: 'Boundary', v: 'AI-assisted triage/decision support only. Final interpretation belongs to a qualified radiologist.' },
        ]},
      ];
      D.ai = { title: 'AI-assisted review priority', text: status === 'ROUTINE' ? 'No qualifying AI triage/localization signal requiring elevated review priority.' : 'Suspected lung opacity · radiologist review recommended. This is not a confirmed clinical critical result or AI diagnosis.', meta: `DenseNet121 threshold 0.20 · YOLO11n threshold 0.10 · ${x.preprocessing_confirmed ? 'preprocessing confirmed' : 'preprocessing not confirmed'}` };
      D.actions = [];
      if (r.source?.study_instance_uid) {
        D.actions.push({ label: 'Open in OHIF · Demo PACS', primary: false, on: () => window.open(`http://localhost:3000/viewer?StudyInstanceUIDs=${encodeURIComponent(r.source.study_instance_uid)}`, '_blank') });
      }
      if (r.radStatus !== 'Read') {
        D.actions.push({ label: 'Finalise: no acute finding', on: () => a.radiologistFinal(r.id, 'No acute finding', ctx.role), primary: false });
        D.actions.push({ label: 'Finalise: finding not confirmed', on: () => a.radiologistFinal(r.id, 'Finding not confirmed', ctx.role), primary: false });
      }
      D.related = [
        { label: 'Diagnostics', on: () => component().go('diagnostics') },
        { label: 'Results & Critical Values', on: () => component().go('laboratory') },
      ];
      return D;
    }
    if (kind === 'order') {
      const o = S.orders.find(x => x.id === id);
      if (o && o.radiologyStudyId) {
        const r = S.radiology.find(x => x.radiologyStudyId === o.radiologyStudyId);
        if (r?.result) {
          const x = r.result;
          const D = original(kind, id, ctx, base);
          D.title = `${o.test} · ${o.patient}`;
          D.sub = `${o.id} · Radiology · same stored study/result`;
          D.badges = [{ t: 'Resulted', ...pillFor('Resulted') }, { t: x.combined_assessment.status, ...pillFor(x.combined_assessment.status) }];
          D.facts = [
            { k: 'Study ID', v: studyLabel(x) },
            { k: 'Patient', v: safePatientName(x) },
            { k: 'Modality', v: x.metadata?.modality || '—' },
            { k: 'Study status', v: 'Resulted' },
            { k: 'AI processing', v: 'Complete' },
            { k: 'AI triage status', v: x.combined_assessment.status },
            { k: 'Radiologist review', v: r.radStatus || 'Unread' },
          ];
          D.ai = { title: 'Shared Radiology AI result', text: 'This Diagnostics record references the same stored Radiology study. Navigation does not trigger another inference.', meta: `DenseNet ${formatPercent(x.triage.probability)} · YOLO regions ${x.localization.number_of_regions}` };
          D.related = [{ label: 'Radiology', on: () => component().setState({ drawer: { kind: 'radiology', id: o.radiologyStudyId } }) }];
          return D;
        }
      }
    }
    if (kind === 'lab') {
      const l = S.labs.find(x => x.id === id);
      if (l?.aiAttention && l.radiologyStudyId) {
        const r = S.radiology.find(x => x.radiologyStudyId === l.radiologyStudyId);
        const x = r?.result;
        if (x) {
          const D = original(kind, id, ctx, base);
          D.title = `AI-assisted review priority · ${safePatientName(x)}`;
          D.sub = `${studyLabel(x)} · Results & Critical Values · Radiology AI`;
          D.badges = [{ t: x.combined_assessment.status, ...pillFor(x.combined_assessment.status) }, { t: 'Not a clinical critical value', ...pillFor('Review') }];
          D.facts = [
            { k: 'Study ID', v: studyLabel(x) },
            { k: 'Patient', v: safePatientName(x) },
            { k: 'Finding', v: 'Suspected lung opacity' },
            { k: 'AI triage probability', v: formatPercent(x.triage.probability) },
            { k: 'AI localization', v: x.localization.opacity_detected ? `${x.localization.number_of_regions} region(s)` : 'No qualifying region' },
            { k: 'Clinical status', v: 'Not a confirmed clinical critical result' },
            { k: 'Recommended action', v: 'Radiologist review recommended' },
          ];
          D.ai = { title: 'AI-assisted review priority', text: 'This item is an AI triage/review flag surfaced for attention. It is not a confirmed clinical critical value and should not be presented as an AI diagnosis.', meta: 'Shared with Radiology and Diagnostics from the same stored study.' };
          D.related = [{ label: 'Radiology study', on: () => component().setState({ drawer: { kind: 'radiology', id: l.radiologyStudyId } }) }];
          return D;
        }
      }
    }
    return original(kind, id, ctx, base);
  }

  function wire() {
    if (wired || !component()?.api || !component()?.V4) return false;
    const c = component();
    const v4 = c.V4;
    const originalList = v4.buildList4.bind(v4);
    const originalDetail = v4.buildDetail4.bind(v4);
    v4.buildList4 = function (page, a, ctx, base) {
      const original = p => originalList(p, a, ctx, base);
      if (page === 'radiology') return buildRadiologyList(original, ctx, base);
      if (page === 'diagnostics') return buildDiagnosticsList(original, ctx, base);
      if (page === 'laboratory') return buildLabList(original, ctx, base);
      return originalList(page, a, ctx, base);
    };
    v4.buildDetail4 = function (kind, id, a, ctx, base) {
      return buildDetail(kind, id, (k, i, x, b) => originalDetail(k, i, a, x, b), ctx, base);
    };

    // Ensure opening any of the three shared contexts always uses the stored state.
    const originalOpen = c.ctx.bind(c);
    const originalGo = c.go.bind(c);
    c.go = function (page, id) {
      if (page === 'radiology' || page === 'diagnostics' || page === 'laboratory') refresh();
      return originalGo(page, id);
    };
    // Patch context-open used by list rows/details; only radiology-backed IDs are marked viewed.
    const originalCtx = c.ctx;
    c.ctx = function () {
      const out = originalCtx.call(c);
      const oldOpen = out.open;
      out.open = (kind, id) => {
        if (kind === 'radiology') markViewed(id);
        return oldOpen(kind, id);
      };
      return out;
    };
    wired = true;
    refresh();
    setInterval(refresh, POLL_MS);
    return true;
  }

  // componentDidMount exposes the current prototype controller; then we hook it.
  const timer = setInterval(() => {
    if (wire()) clearInterval(timer);
  }, 100);
})();
