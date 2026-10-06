export function simplifyAnswer(answer = '') {
  return answer
    .replace(/authori[sz]ed/gi, 'approved')
    .replace(/verify|verification/gi, 'check')
    .replace(/compatibility checks?/gi, 'blood match checks')
    .replace(/discrepancies/gi, 'mismatches')
    .replace(/discrepancy/gi, 'mismatch')
    .replace(/precautions?/gi, 'safety steps')
    .replace(/escalate/gi, 'contact the responsible team');
}

export function answerSteps(answer = '') {
  return answer
    .split(/(?<=[.!?;])\s+|\s+(?=•\s*)|\s+(?=(?:Before|Confirm|Check|Review|If|Record|Document|Stop|Escalate|Perform|Use|Call|Activate|Ensure)\b)/)
    .map(part => part.replace(/^[•\s]+/, '').trim())
    .filter(Boolean)
    .map((step, index) => `${index + 1}. ${step}`)
    .join('\n');
}

export function buildRecallQuiz(answer, citation) {
  return {
    question: `According to ${citation?.section_title || 'the retrieved protocol section'}, which key points should you recall?`,
    answer,
  };
}

export function formatCitation(citation) {
  const sectionName = citation.section_title && !/^page\s+\d+$/i.test(citation.section_title)
    ? `: ${citation.section_title}`
    : '';
  return {
    title: citation.document_title,
    identity: `Document ID: ${citation.document_id} · Version ${citation.version}`,
    location: `${citation.department} · Section ${citation.section}${sectionName}${citation.page ? ` · Page ${citation.page}` : ''}`,
    status: citation.status,
  };
}
