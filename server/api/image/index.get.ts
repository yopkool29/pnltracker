import { createReadStream } from 'node:fs'
import { resolve } from 'node:path'
import { stat } from 'node:fs/promises'
import { createAppError } from '../../utils/errors'
import auth from '../../utils/auth'


export default defineEventHandler(async (event) => {
    try {
        const { path: imagePath } = getQuery(event)

        if (!imagePath || typeof imagePath !== 'string') {
            throw createAppError({
                statusCode: 400,
                message: 'URL is required',
                tag: 'api.image.get.missing_url'
            })
        }

        await auth(event)
        const userId = Number(event.context.userId)
        const dbName = event.context.dbName

        if (!userId || !dbName) {
            throw createAppError({
                statusCode: 401,
                message: 'User not authenticated or database not selected',
                tag: 'api.image.get.unauthorized'
            })
        }

        const userUploadDir = resolve(process.cwd(), 'upload', `user_${userId}_data`, dbName)
        const filePath = resolve(userUploadDir, imagePath)

        if (!filePath.startsWith(userUploadDir) || filePath === userUploadDir) {
            throw createAppError({
                statusCode: 400,
                message: 'Invalid image path',
                tag: 'api.image.get.invalid_path'
            })
        }

        const stats = await stat(filePath)
        if (!stats.isFile()) {
            throw createAppError({
                statusCode: 404,
                message: 'File not found',
                tag: 'api.image.get.file_not_found'
            })
        }

        const mimeType = getMimeType(filePath)
        const stream = createReadStream(filePath)
        setResponseHeader(event, 'Content-Type', mimeType)
        const cacheControl = 'public, max-age=31536000'
        setResponseHeader(event, 'Cache-Control', cacheControl)

        return sendStream(event, stream)
    } catch (error) {
        const err = error as { statusCode?: number; data?: { tag?: string } }
        if (err.statusCode && err.data?.tag) {
            throw error
        }

        throw createAppError({
            statusCode: 500,
            message: 'Failed to fetch image',
            tag: 'api.image.get.fetch_error',
            error
        })
    }
})


const getMimeType = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml'
    }
    return mimeTypes[extension as keyof typeof mimeTypes] || 'application/octet-stream'
}