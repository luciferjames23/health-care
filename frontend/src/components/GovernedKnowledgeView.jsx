import React, { useState } from 'react';

const KNOWLEDGE_DOCS = [
  {
    id: 'KB-001',
    title: 'Critical Value Policy & Escalation Matrix',
    dept: 'Laboratory',
    v: '1.4',
    eff: '15 Aug 2026',
    review: '15 Aug 2027',
    chunks: 48,
    retrievals: 142,
    lang: 'EN',
    status: 'Published',
    text: 'Critical laboratory values are phoned and pushed to the treating clinician within 5 minutes of verification. Acknowledgement is required within 15 minutes; otherwise the department head is notified. The AI platform notifies and times acknowledgement; it does not interpret values.'
  },
  {
    id: 'KB-002',
    title: 'Discharge Turnaround Policy & SLA',
    dept: 'Operations',
    v: '2.0',
    eff: '01 Jan 2026',
    review: '01 Jan 2027',
    chunks: 64,
    retrievals: 310,
    lang: 'EN',
    status: 'Published',
    text: 'Standard discharge SLA target is 3 hours from physician intent marking to physical bed clearance. All dependency milestones (discharge summary, pharmacy clearance, billing reconciliation, TPA approval) must be timestamped.'
  },
  {
    id: 'KB-003',
    title: 'Medication Safety & High-Alert Double Check',
    dept: 'Nursing',
    v: '4.0',
    eff: '01 Feb 2026',
    review: '01 Feb 2027',
    chunks: 52,
    retrievals: 88,
    lang: 'EN',
    status: 'Published',
    text: 'High-alert medications (IV insulin, concentrated potassium, heparin/enoxaparin, chemotherapy) mandate a second-nurse verification on the electronic MAR prior to administration.'
  },
  {
    id: 'KB-004',
    title: 'Star Health Preauthorisation Guidelines',
    dept: 'Insurance Desk',
    v: '4.2',
    eff: '01 Jul 2026',
    review: '01 Jul 2027',
    chunks: 96,
    retrievals: 175,
    lang: 'EN',
    status: 'Published',
    text: 'Emergency admissions must submit preauth within 24 hours. Elective procedures require 48 hours advance submission with clinical notes, estimate breakdown, and conservative treatment history.'
  },
  {
    id: 'KB-005',
    title: 'Hospital Tariff FY26-27 & Package Manual',
    dept: 'Billing',
    v: '1.3',
    eff: '01 Apr 2026',
    review: '31 Mar 2027',
    chunks: 120,
    retrievals: 420,
    lang: 'EN',
    status: 'Published',
    text: 'Comprehensive room rents, consultation charges, OT surgical packages, and consumable markup policies. NPPA price caps strictly enforced for cardiac stents and orthopedic implants.'
  },
  {
    id: 'KB-006',
    title: 'NABH Clinical Documentation & Discharge Standards',
    dept: 'Quality',
    v: '5.0',
    eff: '01 Jan 2026',
    review: '01 Jan 2027',
    chunks: 85,
    retrievals: 290,
    lang: 'EN',
    status: 'Published',
    text: 'NABH 5th Edition standards for discharge summary completion, medication reconciliation, patient education in vernacular language, and follow-up appointment scheduling.'
  }
];

export default function GovernedKnowledgeView() {
  const [docs, setDocs] = useState(KNOWLEDGE_DOCS);
  const [selectedDoc, setSelectedDoc] = useState(KNOWLEDGE_DOCS[0]);
  const [searchQ, setSearchQ] = useState('');

  const filteredDocs = docs.filter(d => {
    if (!searchQ) return true;
    return d.title.toLowerCase().includes(searchQ.toLowerCase()) || d.dept.toLowerCase().includes(searchQ.toLowerCase()) || d.id.toLowerCase().includes(searchQ.toLowerCase());
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#8a9096', marginBottom: '4px' }}>
            <span>Hospital AI Platform</span> › <span>GOVERNED KNOWLEDGE BASE</span>
          </div>
          <div style={{ fontSize: '22px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
            Governed Enterprise Knowledge Base
            <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '12px', background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)' }}>
              {docs.length} Governed Documents
            </span>
          </div>
          <div style={{ color: '#52585e', fontSize: '12px', marginTop: '2px' }}>
            Pipeline: Upload → Parse → Chunk → Embed → Index → Available to RAG. Every AI answer cites document, section, version and effective date.
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => alert('Document ingestion upload modal opened')}
            style={{
              height: '32px', padding: '0 14px', borderRadius: '6px', border: 0,
              background: 'oklch(0.5 0.1 200)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer'
            }}
          >
            + Ingest New SOP Document
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>Published & Active</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.4 0.12 150)', marginTop: '4px' }}>{docs.length}</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>Total Indexed Chunks</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#15181b', marginTop: '4px' }}>485 chunks</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>RAG Retrievals Today</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#15181b', marginTop: '4px' }}>1,425 queries</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', color: '#8a9096' }}>Conflicts / Expired</div>
          <div style={{ fontSize: '22px', fontWeight: 700, color: 'oklch(0.4 0.12 150)', marginTop: '4px' }}>0 Conflicts</div>
        </div>
      </div>

      {/* Main Grid: Document List + Document Inspector */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px', alignItems: 'start' }}>
        
        {/* Document Table */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #eef0f1', background: '#fafbfc' }}>
            <input
              type="text"
              placeholder="Search policy title, department, or ID..."
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              style={{ width: '100%', height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid #e3e6e8', fontSize: '11.5px', boxSizing: 'border-box' }}
            />
          </div>

          <div style={{ maxHeight: '520px', overflowY: 'auto' }}>
            {filteredDocs.map(doc => {
              const isSelected = selectedDoc.id === doc.id;
              return (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid #f2f3f4', cursor: 'pointer',
                    background: isSelected ? 'oklch(0.96 0.04 200)' : 'transparent',
                    borderLeft: isSelected ? '3px solid oklch(0.5 0.1 200)' : '3px solid transparent'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, fontSize: '12.5px', color: isSelected ? 'oklch(0.3 0.1 200)' : '#15181b' }}>
                      {doc.title}
                    </span>
                    <span style={{ fontSize: '10.5px', fontFamily: 'monospace', color: '#8a9096' }}>v{doc.v}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', fontSize: '11px', color: '#52585e', marginTop: '4px' }}>
                    <span>{doc.id}</span>
                    <span>•</span>
                    <span>{doc.dept}</span>
                    <span>•</span>
                    <span>{doc.chunks} chunks</span>
                    <span>•</span>
                    <span>{doc.retrievals} retrievals</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Document Inspector */}
        <div style={{ background: '#fff', border: '1px solid #e3e6e8', borderRadius: '8px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{selectedDoc.title}</div>
              <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#8a9096', marginTop: '2px' }}>
                {selectedDoc.id} · v{selectedDoc.v} · Owner: {selectedDoc.dept}
              </div>
            </div>
            <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600, background: 'oklch(0.95 0.04 150)', color: 'oklch(0.4 0.12 150)' }}>
              {selectedDoc.status}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '12px 0', padding: '10px', borderRadius: '6px', background: '#f8fafc', fontSize: '11.5px' }}>
            <div>Effective Date: <strong>{selectedDoc.eff}</strong></div>
            <div>Review Due: <strong>{selectedDoc.review}</strong></div>
            <div>Indexed Chunks: <strong>{selectedDoc.chunks}</strong></div>
            <div>Retrievals (Session): <strong>{selectedDoc.retrievals}</strong></div>
          </div>

          <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '6px' }}>Authoritative Policy Text (Extract)</div>
          <div style={{ background: '#fafbfc', border: '1px solid #eef0f1', borderRadius: '6px', padding: '12px', fontSize: '12px', lineHeight: 1.6, color: '#15181b', marginBottom: '14px' }}>
            "{selectedDoc.text}"
          </div>

          <div style={{ fontSize: '11px', color: '#8a9096', lineHeight: 1.4 }}>
            Policy note: Governed documents are retired or deactivated, never deleted. Past AI assistant answers maintain immutable citations to this specific version and effective date.
          </div>
        </div>

      </div>
    </div>
  );
}
