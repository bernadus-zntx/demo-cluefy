import assert from 'node:assert/strict';
import test from 'node:test';
import { activeRevision, createFinding, transition } from '../app/intelligence/model.ts';

const initial = () => createFinding(
  'FND-TEST-001',
  { source: 'Demo', author: 'Warga', text: 'Keluhan', startSeconds: 4, endSeconds: 12 },
  'Layanan',
  'Negative',
  '2026-10-04T00:00:00Z',
);
const at = '2026-10-04T01:00:00Z';

test('creation produces the five related data entities', () => {
  const finding = initial();
  assert.equal(finding.workspaceId, 'government');
  assert.equal(finding.evidence.length, 1);
  assert.equal(finding.revisions.length, 1);
  assert.equal(finding.reviewDecisions.length, 0);
  assert.equal(finding.auditEvents.length, 1);
  assert.deepEqual(activeRevision(finding).evidenceIds, [finding.evidence[0].id]);
  assert.deepEqual(finding.evidence[0].segment, { startSeconds: 4, endSeconds: 12 });
});

test('approval is tied to the reviewed revision and requires a note', () => {
  assert.throws(() => transition(initial(), { type: 'approve', reason: 'verified' }, at));
  const review = transition(initial(), { type: 'submit', reason: '' }, at);
  assert.throws(() => transition(review, { type: 'approve', reason: ' ' }, at));
  const approved = transition(review, { type: 'approve', reason: 'Evidence reviewed' }, at);
  assert.equal(approved.status, 'Approved');
  assert.equal(approved.reviewDecisions.length, 1);
  assert.equal(approved.reviewDecisions[0].revisionId, approved.activeRevisionId);
  assert.equal(approved.auditEvents.at(-1)?.action, 'approved');
});

test('correction creates a revision and invalidates prior approval', () => {
  const original = initial();
  const approved = transition(transition(original, { type: 'submit', reason: '' }, at), { type: 'approve', reason: 'Reviewed' }, at);
  const corrected = transition(approved, {
    type: 'correct',
    title: 'Permintaan pencegahan banjir',
    analysis: 'Warga meminta tindakan pencegahan.',
    issue: 'Drainase',
    entities: ['Dinas PUPR'],
    sentiment: 'Neutral',
    severity: 'Medium',
    reason: 'Konteks diperjelas',
  }, at);
  assert.equal(corrected.status, 'Draft');
  assert.equal(corrected.revisions.length, 2);
  assert.equal(activeRevision(corrected).createdBy, 'Budi Santoso · reviewer demo');
  assert.deepEqual(activeRevision(corrected).evidenceIds, original.revisions[0].evidenceIds);
  assert.equal(corrected.reviewDecisions.length, 1);
  assert.equal(approved.revisions.length, 1);
  assert.throws(() => transition(corrected, { type: 'approve', reason: 'Shortcut' }, at));
});

test('audit records before and after snapshots', () => {
  const review = transition(initial(), { type: 'submit', reason: '' }, at);
  const event = review.auditEvents.at(-1);
  assert.equal(event?.before?.status, 'Draft');
  assert.equal(event?.after.status, 'In Review');
  assert.equal(event?.before?.activeRevisionId, event?.after.activeRevisionId);
});

test('rejection and resubmission preserve decision history', () => {
  const rejected = transition(transition(initial(), { type: 'submit', reason: '' }, at), { type: 'reject', reason: 'Bukti belum cukup' }, at);
  const review = transition(rejected, { type: 'submit', reason: 'Mohon review ulang' }, at);
  assert.equal(review.status, 'In Review');
  assert.equal(review.reviewDecisions[0].note, 'Bukti belum cukup');
});

test('empty corrections are rejected', () => assert.throws(() => transition(initial(), {
  type: 'correct', title: '', analysis: 'a', issue: 'a', entities: [], sentiment: 'Neutral', severity: 'Low', reason: 'a',
}, at)));

test('distribution uses the approved revision and cannot bypass approval', () => {
  const draft = initial();
  assert.throws(() => transition(draft, { type: 'distribute', reason: 'demo', destination: 'Management', message: 'Alert' }, at));
  const approved = transition(transition(draft, { type: 'submit', reason: '' }, at), { type: 'approve', reason: 'Evidence verified' }, at);
  const distributed = transition(approved, { type: 'distribute', reason: 'Approved demo distribution', destination: 'Management Monitoring Group', message: 'Approved intelligence' }, at);
  assert.equal(distributed.status, 'Distributed');
  assert.equal(distributed.distributions[0].revisionId, approved.activeRevisionId);
  assert.equal(distributed.auditEvents.at(-1)?.action, 'distributed');
});

test('adding another aspiration preserves history and returns an approved finding to Draft', () => {
  const approved = transition(
    transition(initial(), { type: 'submit', reason: '' }, at),
    { type: 'approve', reason: 'Evidence verified' },
    at,
  );
  const previousRevision = activeRevision(approved);
  const expanded = transition(approved, {
    type: 'attach',
    evidence: {
      source: 'Facebook',
      sourceUrl: 'https://www.facebook.com/example/posts/2',
      author: 'Warga Kedua',
      text: 'Keluhan serupa dari lokasi berbeda',
      publishedAt: '2026-10-04T00:30:00Z',
    },
    reason: 'Aspirasi terkait ditambahkan ke Finding yang sama',
  }, at);

  assert.equal(expanded.evidence.length, 2);
  assert.equal(expanded.revisions.length, 2);
  assert.equal(activeRevision(expanded).evidenceIds.length, 2);
  assert.equal(expanded.status, 'Draft');
  assert.equal(expanded.reviewDecisions.length, 1);
  assert.equal(expanded.auditEvents.at(-1)?.action, 'evidence_added');
  assert.deepEqual(previousRevision.evidenceIds, [approved.evidence[0].id]);
  assert.deepEqual(approved.revisions[0].evidenceIds, [approved.evidence[0].id]);
});

test('validation and operational disposition are tracked separately', () => {
  const draft = initial();
  assert.equal(draft.validationStatus, 'Draft');
  assert.equal(draft.disposition, 'Undecided');
  assert.throws(() => transition(draft, { type: 'monitor', reason: 'Pantau' }, at));

  const approved = transition(
    transition(draft, { type: 'submit', reason: 'Ready' }, at),
    { type: 'approve', reason: 'Evidence verified' },
    at,
  );
  const monitored = transition(approved, { type: 'monitor', reason: 'Pantau evidence baru' }, at);
  assert.equal(monitored.validationStatus, 'Approved');
  assert.equal(monitored.disposition, 'Monitoring');
  assert.equal(monitored.auditEvents.at(-1)?.action, 'monitoring');
});

test('an approved finding can be escalated to a case without changing validation', () => {
  const approved = transition(
    transition(initial(), { type: 'submit', reason: 'Ready' }, at),
    { type: 'approve', reason: 'Evidence verified' },
    at,
  );
  const escalated = transition(approved, { type: 'escalate', reason: 'Perlu PIC dan SLA', caseId: 'CASE-BDG-009' }, at);
  assert.equal(escalated.validationStatus, 'Approved');
  assert.equal(escalated.disposition, 'Escalated');
  assert.deepEqual(escalated.relatedCaseIds, ['CASE-BDG-009']);
  assert.equal(escalated.auditEvents.at(-1)?.action, 'escalated');
});
