import { getAuthDb } from '../../utils/db'

export default defineEventHandler(async (event) => {
	// Utiliser l'auth standard (cookie JWT ou x-api-token)
	const { default: auth } = await import('../../utils/auth')
	await auth(event)

	const userId = event.context.userId
	if (!userId) {
		throw createError({ statusCode: 401, message: 'Unauthorized' })
	}

	// Récupérer le token API de l'utilisateur
	const db = getAuthDb()
	const user = await db.user.findUnique({
		where: { id: Number(userId) },
		select: { token: true },
	})

	const requestUrl = getRequestURL(event)

	return {
		mcpUrl: `${requestUrl.origin}/mcp`,
		token: user?.token || '',
		instructions: 'Configurez votre client MCP avec cette URL et le token en en-tête Authorization: Bearer',
	}
})
