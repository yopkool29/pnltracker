import { useNitroApp } from 'nitropack/runtime'
import { PnlTrackerApiError, getErrorMessage } from '~/mcp/errors'
import type { McpApiClient, McpApiRequestOptions, McpApiWriteOptions, McpApiClientFactory } from '~/mcp/tools'

// Client API interne pour le MCP servi par Nitro : les appels passent par
// localFetch (in-process, sans TCP) donc par le vrai middleware d'auth.
// Le token de l'utilisateur MCP est re-forwardé en x-api-token, et chaque
// appel est revalidé par apiTokenAuth — pas d'escalade de privilèges.
export class McpInternalApiClient implements McpApiClient {
	private readonly token: string

	constructor(token: string) {
		this.token = token
	}

	async get(path: string, options: McpApiRequestOptions): Promise<unknown> {
		return this.requestJson('GET', path, options)
	}

	async post(path: string, options: McpApiWriteOptions): Promise<unknown> {
		return this.requestJson('POST', path, options, options.body)
	}

	async delete(path: string, options: McpApiRequestOptions): Promise<unknown> {
		return this.requestJson('DELETE', path, options)
	}

	private buildUrl(path: string, query: McpApiRequestOptions['query']): string {
		const params = new URLSearchParams()
		for (const [key, value] of Object.entries(query)) {
			if (value !== undefined) params.set(key, String(value))
		}
		const qs = params.toString()
		return qs ? `${path}?${qs}` : path
	}

	private buildHeaders(databaseId: number | undefined): Record<string, string> {
		const headers: Record<string, string> = {
			accept: 'application/json',
			'x-api-token': this.token,
		}
		if (databaseId !== undefined) headers['x-database-id'] = String(databaseId)
		return headers
	}

	private async requestJson(method: 'GET' | 'POST' | 'DELETE', path: string, options: McpApiRequestOptions, body?: unknown): Promise<unknown> {
		const headers = this.buildHeaders(options.databaseId)
		if (body !== undefined) headers['content-type'] = 'application/json'

		const response = await useNitroApp().localFetch(this.buildUrl(path, options.query), {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
		})
		if (!response.ok) throw new PnlTrackerApiError(getErrorMessage(response.status), response.status)

		const contentType = response.headers.get('content-type') || ''
		if (!contentType.includes('application/json')) throw new PnlTrackerApiError('PnlTracker returned an invalid response', response.status)

		try {
			return await response.json() as unknown
		} catch {
			throw new PnlTrackerApiError('PnlTracker returned invalid JSON', response.status)
		}
	}

	async getBinary(path: string, options: McpApiRequestOptions): Promise<{ buffer: Buffer, mimeType: string }> {
		const response = await useNitroApp().localFetch(this.buildUrl(path, options.query), {
			headers: this.buildHeaders(options.databaseId),
		})
		if (!response.ok) throw new PnlTrackerApiError(getErrorMessage(response.status), response.status)

		const mimeType = response.headers.get('content-type') || 'application/octet-stream'
		const buffer = Buffer.from(await response.arrayBuffer())
		return { buffer, mimeType }
	}
}

export const createMcpInternalApi: McpApiClientFactory = (token) => new McpInternalApiClient(token)
