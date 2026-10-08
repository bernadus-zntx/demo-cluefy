export type FindingStatus = 'Draft' | 'In Review' | 'Approved' | 'Rejected' | 'Distributed';
export type FindingValidationStatus = 'Draft' | 'In Review' | 'Approved' | 'Rejected';
export type FindingDisposition = 'Undecided' | 'Monitoring' | 'Broadcasted' | 'Escalated' | 'Closed';
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export type Sentiment = 'Positive' | 'Neutral' | 'Negative';
export type CommunicationFormat = 'Press Release' | 'Talking Points' | 'Social Media Brief';

export type Evidence = {
  id: string;
  source: string;
  author: string;
  sourceUrl?: string;
  publishedAt?: string;
  capturedAt: string;
  mediaType: 'text' | 'image' | 'video' | 'audio';
  mediaUrl?: string;
  captionsUrl?: string;
  segment?: { startSeconds: number; endSeconds: number };
  transcript: string;
  translation?: string;
  frameUrl?: string;
};

export type AnalysisRevision = {
  id: string;
  number: number;
  title: string;
  analysis: string;
  summary: string;
  recommendation: string;
  issue: string;
  location: string;
  entities: string[];
  sentiment: Sentiment;
  emotion: string;
  severity: Severity;
  confidence: number;
  reason: string;
  createdBy: string;
  createdAt: string;
  evidenceIds: string[];
};

export type ReviewDecision = {
  id: string;
  revisionId: string;
  reviewer: string;
  decision: 'Approved' | 'Rejected';
  note: string;
  createdAt: string;
};

export type AuditSnapshot = {
  status: FindingStatus;
  validationStatus: FindingValidationStatus;
  disposition: FindingDisposition;
  activeRevisionId: string;
  title: string;
  issue: string;
  entities: string[];
  sentiment: Sentiment;
  severity: Severity;
  watchlisted: boolean;
};

export type AuditEvent = {
  id: string;
  actor: string;
  action: 'created' | 'evidence_added' | 'corrected' | 'submitted' | 'approved' | 'rejected' | 'commented' | 'watchlisted' | 'watchlist_removed' | 'monitoring' | 'distributed' | 'escalated' | 'communication_drafted';
  createdAt: string;
  note: string;
  before: AuditSnapshot | null;
  after: AuditSnapshot;
};

export type Finding = {
  id: string;
  workspaceId: 'government';
  title: string;
  issue: string;
  entities: string[];
  sentiment: Sentiment;
  severity: Severity;
  location: string;
  status: FindingStatus;
  validationStatus: FindingValidationStatus;
  disposition: FindingDisposition;
  watchlisted: boolean;
  relatedCaseIds: string[];
  activeRevisionId: string;
  evidence: Evidence[];
  revisions: AnalysisRevision[];
  reviewDecisions: ReviewDecision[];
  distributions: Array<{ id: string; revisionId: string; destination: string; message: string; createdAt: string }>;
  communicationDrafts: Array<{ id: string; revisionId: string; format: CommunicationFormat; content: string; createdBy: string; createdAt: string }>;
  auditEvents: AuditEvent[];
};

export type EvidenceInput = Omit<Evidence, 'id' | 'capturedAt' | 'mediaType' | 'transcript' | 'segment'> & {
  text: string;
  startSeconds?: number;
  endSeconds?: number;
  videoUrl?: string;
};

export type Command =
  | { type: 'attach'; evidence: EvidenceInput; reason: string }
  | { type: 'correct'; title: string; analysis: string; summary?: string; recommendation?: string; issue: string; location?: string; entities: string[]; sentiment: Sentiment; emotion?: string; severity: Severity; confidence?: number; reason: string }
  | { type: 'submit' | 'approve' | 'reject'; reason: string }
  | { type: 'comment'; reason: string }
  | { type: 'monitor'; reason: string }
  | { type: 'watchlist'; enabled: boolean; reason: string }
  | { type: 'escalate'; reason: string; caseId: string }
  | { type: 'distribute'; reason: string; destination: string; message: string }
  | { type: 'draft_communication'; reason: string; format: CommunicationFormat; content: string };

const reviewer = 'Budi Santoso · reviewer demo';

export function activeRevision(finding: Finding): AnalysisRevision {
  const revision = finding.revisions.find(item => item.id === finding.activeRevisionId);
  if (!revision) throw new Error('Revisi aktif tidak ditemukan.');
  return revision;
}

function snapshot(finding: Finding): AuditSnapshot {
  return {
    status: finding.status,
    validationStatus: finding.validationStatus,
    disposition: finding.disposition,
    activeRevisionId: finding.activeRevisionId,
    title: finding.title,
    issue: finding.issue,
    entities: finding.entities,
    sentiment: finding.sentiment,
    severity: finding.severity,
    watchlisted: finding.watchlisted,
  };
}

function auditId(finding: Finding): string {
  return `${finding.id}-AUD-${String(finding.auditEvents.length + 1).padStart(3, '0')}`;
}

export function transition(finding: Finding, command: Command, at: string): Finding {
  const before = snapshot(finding);
  let next: Finding;
  let action: AuditEvent['action'];
  let note = command.reason.trim();

  if (command.type === 'attach') {
    const duplicate = finding.evidence.some(item => item.author === command.evidence.author && item.transcript === command.evidence.text);
    if (duplicate) throw new Error('Aspirasi ini sudah menjadi evidence pada Finding tersebut.');
    const evidenceId = `${finding.id}-EVD-${String(finding.evidence.length + 1).padStart(3, '0')}`;
    const input = command.evidence;
    const evidence: Evidence = {
      id: evidenceId,
      source: input.source,
      author: input.author,
      sourceUrl: input.sourceUrl,
      publishedAt: input.publishedAt,
      capturedAt: at,
      mediaType: input.videoUrl || input.frameUrl || input.startSeconds !== undefined ? 'video' : 'text',
      mediaUrl: input.videoUrl,
      captionsUrl: input.captionsUrl,
      segment: input.startSeconds === undefined || input.endSeconds === undefined ? undefined : { startSeconds: input.startSeconds, endSeconds: input.endSeconds },
      transcript: input.text,
      translation: input.translation,
      frameUrl: input.frameUrl,
    };
    const revision = activeRevision(finding);
    const updatedRevision: AnalysisRevision = {...revision,id:`${finding.id}-REV-${String(finding.revisions.length + 1).padStart(3, '0')}`,number:finding.revisions.length+1,reason:note||`Supporting evidence ${evidenceId} ditambahkan.`,createdBy:reviewer,createdAt:at,evidenceIds:[...revision.evidenceIds,evidenceId]};
    next = {...finding,status:'Draft',validationStatus:'Draft',disposition:finding.relatedCaseIds.length?'Escalated':'Undecided',activeRevisionId:updatedRevision.id,evidence:[...finding.evidence,evidence],revisions:[...finding.revisions,updatedRevision]};
    action = 'evidence_added';
    note ||= `${input.author} ditambahkan sebagai supporting evidence.`;
  } else if (command.type === 'correct') {
    if (![command.title, command.analysis, command.issue, command.reason].every(value => value.trim())) {
      throw new Error('Judul, analisis, isu, dan alasan koreksi wajib diisi.');
    }
    const revision: AnalysisRevision = {
      id: `${finding.id}-REV-${String(finding.revisions.length + 1).padStart(3, '0')}`,
      number: finding.revisions.length + 1,
      title: command.title.trim(),
      analysis: command.analysis.trim(),
      summary: command.summary?.trim() || command.analysis.trim(),
      recommendation: command.recommendation?.trim() || activeRevision(finding).recommendation,
      issue: command.issue.trim(),
      location: command.location?.trim() || activeRevision(finding).location,
      entities: command.entities.map(value => value.trim()).filter(Boolean),
      sentiment: command.sentiment,
      emotion: command.emotion?.trim() || activeRevision(finding).emotion,
      severity: command.severity,
      confidence: command.confidence ?? activeRevision(finding).confidence,
      reason: note,
      createdBy: reviewer,
      createdAt: at,
      evidenceIds: activeRevision(finding).evidenceIds,
    };
    next = {
      ...finding,
      title: revision.title,
      issue: revision.issue,
      entities: revision.entities,
      sentiment: revision.sentiment,
      severity: revision.severity,
      location: revision.location,
      status: 'Draft',
      validationStatus: 'Draft',
      disposition: finding.relatedCaseIds.length ? 'Escalated' : 'Undecided',
      activeRevisionId: revision.id,
      revisions: [...finding.revisions, revision],
    };
    action = 'corrected';
  } else if (command.type === 'submit') {
    if (finding.status !== 'Draft' && finding.status !== 'Rejected') {
      throw new Error('Hanya draft atau hasil ditolak yang bisa diajukan.');
    }
    next = { ...finding, status: 'In Review', validationStatus: 'In Review' };
    action = 'submitted';
    note ||= 'Diajukan untuk review.';
  } else if (command.type === 'approve' || command.type === 'reject') {
    if (finding.status !== 'In Review') throw new Error('Finding harus diajukan untuk review terlebih dahulu.');
    if (!note) throw new Error('Catatan keputusan wajib diisi.');
    const decision: ReviewDecision = {
      id: `${finding.id}-DEC-${String(finding.reviewDecisions.length + 1).padStart(3, '0')}`,
      revisionId: finding.activeRevisionId,
      reviewer,
      decision: command.type === 'approve' ? 'Approved' : 'Rejected',
      note,
      createdAt: at,
    };
    next = { ...finding, status: decision.decision, validationStatus: decision.decision, reviewDecisions: [...finding.reviewDecisions, decision] };
    action = command.type === 'approve' ? 'approved' : 'rejected';
  } else if (command.type === 'comment') {
    if (!note) throw new Error('Komentar review wajib diisi.');
    next = { ...finding };
    action = 'commented';
  } else if (command.type === 'watchlist') {
    next = { ...finding, watchlisted: command.enabled };
    action = command.enabled ? 'watchlisted' : 'watchlist_removed';
    note ||= command.enabled ? 'Finding ditambahkan ke Watchlist.' : 'Finding dihapus dari Watchlist.';
  } else if (command.type === 'monitor') {
    if (finding.validationStatus !== 'Approved') throw new Error('Hanya finding terverifikasi yang dapat dimonitor.');
    next = { ...finding, disposition: 'Monitoring' };
    action = 'monitoring';
    note ||= 'Finding masuk pemantauan tanpa membuat Case.';
  } else if (command.type === 'escalate') {
    if (finding.validationStatus !== 'Approved') throw new Error('Hanya finding terverifikasi yang dapat dieskalasi menjadi Case.');
    if (!command.caseId.trim()) throw new Error('Case tujuan wajib tersedia.');
    next = { ...finding, disposition: 'Escalated', relatedCaseIds: Array.from(new Set([...finding.relatedCaseIds, command.caseId.trim()])) };
    action = 'escalated';
    note ||= `Dieskalasi ke ${command.caseId.trim()}.`;
  } else if (command.type === 'distribute') {
    if (finding.validationStatus !== 'Approved') throw new Error('Hanya finding yang disetujui yang dapat didistribusikan.');
    if (!command.destination.trim() || !command.message.trim()) throw new Error('Tujuan dan isi distribusi wajib diisi.');
    const distribution = { id: `${finding.id}-DST-${String(finding.distributions.length + 1).padStart(3, '0')}`, revisionId: finding.activeRevisionId, destination: command.destination.trim(), message: command.message.trim(), createdAt: at };
    next = { ...finding, status: 'Distributed', disposition: finding.disposition==='Escalated'?'Escalated':'Broadcasted', distributions: [...finding.distributions, distribution] };
    action = 'distributed';
    note ||= `Dikirim ke ${distribution.destination}.`;
  } else if (command.type === 'draft_communication') {
    if (finding.validationStatus !== 'Approved') throw new Error('Hanya finding terverifikasi yang dapat menjadi dasar komunikasi publik.');
    if (!command.content.trim()) throw new Error('Isi communication draft wajib tersedia.');
    const draft = { id: `${finding.id}-COM-${String(finding.communicationDrafts.length + 1).padStart(3, '0')}`, revisionId: finding.activeRevisionId, format: command.format, content: command.content.trim(), createdBy: reviewer, createdAt: at };
    next = { ...finding, communicationDrafts: [...finding.communicationDrafts, draft] };
    action = 'communication_drafted';
    note ||= `${draft.format} dibuat dari approved Finding.`;
  } else {
    throw new Error('Perintah finding tidak dikenali.');
  }

  return {
    ...next,
    auditEvents: [...finding.auditEvents, { id: auditId(finding), actor: reviewer, action, createdAt: at, note, before, after: snapshot(next) }],
  };
}

export function createFinding(id: string, input: EvidenceInput, issue: string, sentiment: Sentiment, at: string): Finding {
  const evidenceId = `${id}-EVD-001`;
  const evidence: Evidence = {
    id: evidenceId,
    source: input.source,
    author: input.author,
    sourceUrl: input.sourceUrl,
    publishedAt: input.publishedAt,
    capturedAt: at,
    mediaType: input.videoUrl || input.frameUrl || input.startSeconds !== undefined ? 'video' : 'text',
    mediaUrl: input.videoUrl,
    captionsUrl: input.captionsUrl,
    segment: input.startSeconds === undefined || input.endSeconds === undefined ? undefined : { startSeconds: input.startSeconds, endSeconds: input.endSeconds },
    transcript: input.text,
    translation: input.translation,
    frameUrl: input.frameUrl,
  };
  const title = `${issue} · ${input.author}`;
  const analysis = `Percakapan dari ${input.author} memuat isu ${issue.toLowerCase()}. Perlu verifikasi konteks sumber sebelum ditindaklanjuti.`;
  const revision: AnalysisRevision = {
    id: `${id}-REV-001`, number: 1, title, analysis, summary: analysis, recommendation: 'Verifikasi konteks sumber dan kondisi lapangan sebelum menentukan respons.', issue, location: 'Kabupaten Badung', entities: ['Pemkab Badung'], sentiment, emotion: sentiment === 'Negative' ? 'Frustration' : 'Concern', confidence: 84,
    severity: sentiment === 'Negative' ? 'High' : 'Medium',
    reason: 'Analisis AI simulasi; belum diverifikasi manusia.', createdBy: 'AI demo', createdAt: at, evidenceIds: [evidenceId],
  };
  const finding: Finding = {
    id, workspaceId: 'government', title, issue, entities: revision.entities, sentiment, severity: revision.severity, location: revision.location,
    status: 'Draft', validationStatus:'Draft', disposition:'Undecided', watchlisted:false, relatedCaseIds:[], activeRevisionId: revision.id, evidence: [evidence], revisions: [revision], reviewDecisions: [], distributions: [], communicationDrafts: [], auditEvents: [],
  };
  return {
    ...finding,
    auditEvents: [{ id: `${id}-AUD-001`, actor: 'AI demo', action: 'created', createdAt: at, note: revision.reason, before: null, after: snapshot(finding) }],
  };
}
