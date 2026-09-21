/** Age is always computed server-side from Profile.birthdate — the birthdate itself is never serialized. */
export function computeAge(birthdate: Date): number {
  const today = new Date()
  let age = today.getFullYear() - birthdate.getFullYear()
  const hasHadBirthdayThisYear =
    today.getMonth() > birthdate.getMonth() ||
    (today.getMonth() === birthdate.getMonth() && today.getDate() >= birthdate.getDate())
  if (!hasHadBirthdayThisYear) age -= 1
  return age
}
