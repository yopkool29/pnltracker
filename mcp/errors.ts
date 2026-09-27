export class PnlTrackerApiError extends Error {
	readonly status: number | null

	constructor(message: string, status: number | null) {
		super(message)
		this.name = 'PnlTrackerApiError'
		this.status = status
	}
}

export const getErrorMessage = (status: number): string => {
	if (status === 400) return 'The request was rejected by PnlTracker'
	if (status === 401 || status === 403) return 'PnlTracker authentication failed'
	if (status === 404) return 'The requested PnlTracker resource was not found'
	if (status === 429) return 'PnlTracker rate limit reached'
	return 'PnlTracker API request failed'
}
