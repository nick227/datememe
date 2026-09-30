import { db } from '@project/db'

// Existing accounts predate the new-user profile landing. Step 0 now means
// "send this person to profile edit on login", so mark current profiles done.
async function main() {
  const result = await db.profile.updateMany({ where: { onboardingStep: 0 }, data: { onboardingStep: 1 } })
  console.log(`onboarding backfill: ${result.count} profiles marked complete`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 }).finally(() => db.$disconnect())
