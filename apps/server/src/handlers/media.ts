import { MediaService } from '../services/MediaService'

const mediaService = new MediaService()

export async function uploadMedia(request: any, reply: any) {
  const file = await request.file({
    limits: {
      fileSize: Number(process.env.UPLOAD_MAX_SIZE_MB ?? 10) * 1024 * 1024,
    },
  })

  if (!file) {
    throw { statusCode: 400, message: 'No file field in request' }
  }

  const result = await mediaService.upload(file)
  return reply.status(201).send({ data: result })
}

export async function deleteMedia(request: any, reply: any) {
  await mediaService.delete(request.params.key)
  return reply.send({ data: null })
}
