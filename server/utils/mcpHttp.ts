import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { registerTools } from '~/mcp/tools'
import { createMcpInternalApi } from './mcpInternalApi'

// Instructions historiquement issues de l'adaptateur stdio mcp/server.ts (supprimé, process #254).
const mcpInstructions = 'AI journal mode is enabled by default. After every user-requested answer based on PnlTracker data, including counts, metrics, summaries, comparisons, and trading analyses, call append_ai_journal with the target database and the complete Markdown result before answering the user. Do not journal technical, configuration, implementation, or casual conversational responses. If the user asks to disable or enable journaling, call set_ai_journal_enabled with the requested value. The setting applies until this MCP process restarts.'

// Transport streamable-http stateless : le SDK impose une paire serveur+transport
// par requête (les ids JSON-RPC repartent de zéro à chaque appel). L'état des
// outils vit dans mcp/tools.ts au niveau module, donc il survit aux requêtes.
// Serveur et transport sont fermés quand le body de la réponse est consommé.
export const handleMcpHttpRequest = async (request: Request, authInfo: AuthInfo): Promise<Response> => {
	const server = new McpServer({
		name: 'pnltracker',
		version: '1.0.0',
	}, {
		instructions: mcpInstructions,
	})
	registerTools(server, createMcpInternalApi)
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
	})
	await server.connect(transport)

	const response = await transport.handleRequest(request, { authInfo })
	const closeAll = async () => {
		await transport.close().catch(() => {})
		await server.close().catch(() => {})
	}
	if (!response.body) {
		await closeAll()
		return response
	}

	const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
	response.body.pipeTo(writable).finally(closeAll).catch(() => {})
	return new Response(readable, {
		status: response.status,
		statusText: response.statusText,
		headers: response.headers,
	})
}
