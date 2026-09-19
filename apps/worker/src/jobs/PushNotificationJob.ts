import { db } from '@project/db'
// In a real app we would use expo-server-sdk
// import { Expo } from 'expo-server-sdk'

// const expo = new Expo()

interface PushNotificationPayload {
  recipientProfileId: string
  title: string
  body: string
  data?: any
}

export async function pushNotificationJob(payload: PushNotificationPayload) {
  const { recipientProfileId, title, body, data } = payload
  
  // 1. Fetch all push tokens for this user
  const profile = await db.profile.findUnique({
    where: { id: recipientProfileId },
    select: { userId: true }
  })
  if (!profile) return

  const tokens = await db.pushToken.findMany({
    where: { userId: profile.userId }
  })

  if (tokens.length === 0) {
    console.log(`No push tokens found for profile ${recipientProfileId}`)
    return
  }

  // 2. Dispatch to Expo
  // In this MVP we just log it as a simulation
  console.log(`[PUSH NOTIFICATION] Sending to ${tokens.length} devices for profile ${recipientProfileId}`)
  console.log(`Title: ${title}`)
  console.log(`Body: ${body}`)
  
  /* Real implementation:
  const messages = []
  for (const pushToken of tokens) {
    if (!Expo.isExpoPushToken(pushToken.token)) {
      continue
    }
    messages.push({
      to: pushToken.token,
      sound: 'default',
      title,
      body,
      data,
    })
  }
  const chunks = expo.chunkPushNotifications(messages)
  for (const chunk of chunks) {
    await expo.sendPushNotificationsAsync(chunk)
  }
  */
}
