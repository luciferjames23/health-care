export function scanAssessmentStatus(scan) {
  const status = scan?.combined_assessment?.status || scan?.combined_status;
  return ['HIGH PRIORITY', 'REVIEW FLAG', 'ROUTINE'].includes(status) ? status : 'Assessment unavailable';
}

export function studyVersion(order, orders = []) {
  const version = `V${order.study_version || 1}`;
  if (!order.follow_up_of && !order.root_order_id) return `${version} · Baseline`;
  const parent = orders.find(item => item.order_id === order.follow_up_of);
  const parentVersion = parent?.study_version ?? order.follow_up_version;
  const parentAccession = parent?.accession_number || order.follow_up_accession;
  const reference = [parentVersion ? `V${parentVersion}` : null, parentAccession].filter(Boolean).join(' · ');
  return `${version} · Follow-up of ${reference || 'linked prior study'}`;
}

export function scanStudyLabel(scan, orders) {
  const order = orders.find(item => scan.order_id && item.order_id === scan.order_id);
  const metadata = order || scan;
  const accession = metadata.accession_number || `Scan #${scan.scan_id}`;
  const version = metadata.study_version ? studyVersion(metadata, orders) : 'Version unavailable';
  return `${accession} · ${version} · ${scan.projection || scan.metadata?.view_position || 'View unverified'} · Scan #${scan.scan_id}`;
}

// An order match alone never establishes which requested projection an image fulfils.
export function orderViewResults(order, scans = []) {
  const requested = [...new Set((order.examination || '').toUpperCase().match(/\b(PA|AP)\b/g) || [])];
  const projections = [...new Set([...requested, ...(order.studies || []).map(s => s.projection).filter(Boolean)])];
  return (projections.length ? projections : ['View unverified']).map(projection => {
    const study = (order.studies || []).find(s => s.projection === projection);
    const scan = scans.find(s => {
      const view = s.projection || s.metadata?.view_position;
      if (view && view !== projection) return false;
      if (study?.study_instance_uid && s.study_instance_uid) return study.study_instance_uid === s.study_instance_uid;
      return s.order_id === order.order_id && view === projection;
    });
    const uid = study?.study_instance_uid || scan?.study_instance_uid;
    const result = scan ? (scan.target === 1 ? 'Opacity detected' : scan.target === 0 ? 'No opacity detected' : 'Result unavailable') : null;
    return { projection, scan, uid, status: result ? `${scanAssessmentStatus(scan)} · ${scan.reviewed_at ? 'Reviewed' : 'Preliminary AI'}: ${result}` : uid ? 'Image available · Result pending' : 'No verified image available' };
  });
}

export function groupImagingOrders(orders) {
  const groups = new Map();
  orders.forEach(order => {
    const id = order.root_order_id || order.order_id;
    if (!groups.has(id)) groups.set(id, { id, problem: order.clinical_problem || order.indication, studies: [] });
    groups.get(id).studies.push(order);
  });
  return [...groups.values()].map(group => ({ ...group, studies: group.studies.sort((a, b) => (a.study_version || 1) - (b.study_version || 1)) }));
}
