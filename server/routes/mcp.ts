import { getHeader, toWebRequest } from 'h3'
import { getAuthDb } from '~/server/utils/db'
import { createAppError } from '../utils/errors'
import { handleMcpHttpRequest } from '../utils/mcpHttp'

const unauthorized = () => createAppError({
	statusCode: 401,
	tag: 'api.auth.verify.unauthorized',
	message: 'Unauthorized',
})

// Endpoint MCP streamable-http servi directement par Nitro (process #254).
// Auth : Authorization: Bearer <token> (ou x-api-token) validé contre User.token,
// même secret que l'auth API existante.
export default defineEventHandler(async (event) => {
	const authorization = getHeader(event, 'authorization')
	const token = authorization?.startsWith('Bearer ')
		? authorization.slice('Bearer '.length).trim()
		: getHeader(event, 'x-api-token')
	if (!token) throw unauthorized()

	const user = await getAuthDb().user.findUnique({
		where: { token },
		select: { id: true },
	})
	if (!user) throw unauthorized()

	return handleMcpHttpRequest(toWebRequest(event), {
		token,
		clientId: String(user.id),
		scopes: [],
	})
})
