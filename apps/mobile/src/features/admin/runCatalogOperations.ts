import { catalogCommand, type CatalogOperation } from '@project/sdk'

export type CatalogRunSummary = { completed: number; failed: number }

// Executes enqueued catalog operations one at a time, calling `onProgress`
// after each so the admin screen can refresh as results land.
export async function runCatalogOperations(ops: CatalogOperation[], onProgress: () => Promise<unknown>): Promise<CatalogRunSummary> {
  let completed = 0
  let failed = 0
  for (const op of ops) {
    try {
      const result = await catalogCommand<CatalogOperation>({ action: 'execute', id: op.id })
      if (result.status === 'SUCCEEDED') completed++
      else failed++
    } catch {
      failed++
    }
    await onProgress()
  }
  return { completed, failed }
}

// Empty when everything succeeded, so the caller can clear its status line.
export function describeCatalogRun({ completed, failed }: CatalogRunSummary): string {
  return failed ? `${completed} done, ${failed} failed` : ''
}
