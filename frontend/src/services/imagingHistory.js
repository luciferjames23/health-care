export const studyVersion = order => `V${order.study_version || 1} · ${order.root_order_id ? 'Follow-up' : 'Baseline'}`;

export function groupImagingOrders(orders) {
  const groups = new Map();
  orders.forEach(order => {
    const id = order.root_order_id || order.order_id;
    if (!groups.has(id)) groups.set(id, { id, problem: order.clinical_problem || order.indication, studies: [] });
    groups.get(id).studies.push(order);
  });
  return [...groups.values()].map(group => ({ ...group, studies: group.studies.sort((a, b) => (a.study_version || 1) - (b.study_version || 1)) }));
}
