import { auditCatalog, writeQuality } from '../lib/catalogAudit'

// Quiet catalog audit: recomputes every active list's quality signals and
// writes the ones that changed. Enqueued on a timer (CATALOG_AUDIT_MINUTES)
// and after admin edits; idempotent.
export async function catalogAuditJob() {
  const { catalog, quality } = await auditCatalog()
  const written = await writeQuality(catalog, quality)
  const flagged = [...quality.values()].filter((q) => q.issues.some((i) => i.flagged)).length
  return { lists: catalog.lists.length, flagged, written }
}
