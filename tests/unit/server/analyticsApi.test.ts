import { describe, expect, it } from 'vitest'
import {
	analyticsBreakdownQuerySchema,
	analyticsTimeseriesQuerySchema,
	parseAnalyticsQuery,
} from '~/server/services/analyticsApi'

describe('analytics API query validation', () => {
	it('applies defaults and parses reusable trade filters', () => {
		const query = parseAnalyticsQuery(analyticsBreakdownQuerySchema, {
			dimension: 'symbol',
			filters: JSON.stringify([{ column: 'accountId', operator: '=', value: 4 }]),
		})
		expect(query).toEqual({
			dimension: 'symbol',
			mode: 'net',
			show_inactive: false,
			filters: [{ column: 'accountId', operator: '=', value: 4 }],
		})
	})

	it('accepts every breakdown dimension including *_close variants', () => {
		const dimensions = ['symbol', 'account', 'side', 'tag', 'month', 'weekday', 'open_hour', 'month_close', 'weekday_close', 'close_hour']
		for (const dimension of dimensions) {
			const query = parseAnalyticsQuery(analyticsBreakdownQuerySchema, { dimension })
			expect(query.dimension).toBe(dimension)
		}
	})

	it('accepts gross mode and every supported timeseries interval', () => {
		for (const interval of ['day', 'week', 'month', 'year']) {
			const query = parseAnalyticsQuery(analyticsTimeseriesQuerySchema, { mode: 'gross', interval })
			expect(query).toMatchObject({ mode: 'gross', interval })
		}
	})

	it.each([
		{ dimension: 'exchange' },
		{ dimension: 'side', mode: 'invalid' },
		{ dimension: 'side', show_inactive: 'yes' },
		{ dimension: 'side', filters: '{invalid' },
	])('rejects invalid parameters: %j', parameters => {
		expect(() => parseAnalyticsQuery(analyticsBreakdownQuerySchema, parameters)).toThrow('Invalid analytics query parameters')
	})
})
