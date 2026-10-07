import { getAuthDb } from '../../../utils/db'
import auth from '../../../utils/auth'
import { createAppError } from '../../../utils/errors'
import { gunzipSync } from 'node:zlib'

export default defineEventHandler(async (event) => {
	await auth(event)

	const userId = parseInt(event.context.userId)
	const databaseId = parseInt(getRouterParam(event, 'id') || '')

	if (!userId || !databaseId) {
		throw createAppError({
			statusCode: 400,
			message: 'Invalid request',
			tag: 'api.database.ui_state.validation_error',
		})
	}

	const prisma = getAuthDb()

	try {
		const body = await readBody(event)

		if (!body || typeof body !== 'object') {
			throw createAppError({
				statusCode: 400,
				message: 'Invalid UI state data',
				tag: 'api.database.ui_state.validation_error',
			})
		}

		let uiState: unknown
		if (typeof body.compressed === 'string') {
			const buf = Buffer.from(body.compressed, 'base64')
			const decompressed = gunzipSync(buf)
			uiState = JSON.parse(decompressed.toString('utf-8'))
		} else {
			uiState = body
		}

		if (!uiState || typeof uiState !== 'object') {
			throw createAppError({
				statusCode: 400,
				message: 'Invalid UI state data',
				tag: 'api.database.ui_state.validation_error',
			})
		}

		const database = await prisma.database.findFirst({
			where: { id: databaseId, userId },
			select: { id: true, metadata: true }
		})

		if (!database) {
			throw createAppError({
				statusCode: 404,
				message: 'Database not found',
				tag: 'api.database.ui_state.not_found'
			})
		}

		const version = typeof body.version === 'number' ? body.version : 1

		const existingMetadata = (database.metadata as Record<string, unknown> | null) ?? {}
		const existingPnlTracker = (existingMetadata.pnltracker as Record<string, unknown> | null) ?? {}
		const updatedMetadata = {
			...existingMetadata,
			pnltracker: {
				...existingPnlTracker,
				uiState: uiState,
				uiStateVersion: version,
				uiStateSavedAt: new Date().toISOString(),
			},
		}

		await prisma.database.update({
			where: { id: databaseId },
			data: { metadata: updatedMetadata }
		})

		return { success: true }
	} catch (error) {
		const err = error as { statusCode?: number; data?: { tag?: string } }
		if (err.statusCode && err.data?.tag) {
			throw error
		}

		throw createAppError({
			statusCode: 500,
			message: 'An error occurred while saving UI state',
			tag: 'api.database.ui_state.server_error',
			error
		})
	}
})
