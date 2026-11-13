import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { gzipSync } from 'node:zlib'
import { loginTestUser, checkServerRunning, getSessionHeaders } from './utils/test-helpers'
import { acquireTestDatabase, releaseTestDatabase } from './utils/test-database'

let testDb: { id: number; name: string }

const getDbUiState = async (): Promise<Record<string, unknown> | undefined> => {
	const databases = await $fetch('/api/database/list', {
		headers: getSessionHeaders(),
	}) as { id: number; metadata?: { pnltracker?: { uiState?: Record<string, unknown> } } }[]
	const db = databases.find(d => d.id === testDb.id)
	return db?.metadata?.pnltracker?.uiState
}

describe('UI State Sync Integration', () => {
	beforeAll(async () => {
		await checkServerRunning()
		await loginTestUser()
		testDb = await acquireTestDatabase()
	}, 60000)

	afterAll(async () => {
		await releaseTestDatabase(testDb.id)
	})

	it('should save UI state with gzip compression', async () => {
		const uiState = {
			customInputsPerDb: {
				[testDb.name]: [
					{ id: 1, key: 'field1', value: 'value1' },
					{ id: 2, key: 'field2', value: 'value2' },
				],
			},
			dashBoardFiltersPerDb: {
				[testDb.name]: {
					accountIds: [1, 2, 3],
					period: 'last_three_months_until_now',
					workspaces: [
						{
							id: 'ws1',
							name: 'Workspace 1',
							dashboardGridLayout: [
								{ x: 0, y: 0, w: 6, h: 4, i: 'item1' },
								{ x: 6, y: 0, w: 6, h: 4, i: 'item2' },
							],
						},
					],
				},
			},
			chartSettingsPerDb: {
				[testDb.name]: { timeframe: '1m', showAdjacent: true },
			},
		}

		const json = JSON.stringify(uiState)
		const compressed = gzipSync(Buffer.from(json))
		const base64 = compressed.toString('base64')

		const result = await $fetch(`/api/database/${testDb.id}/ui-state`, {
			method: 'POST',
			headers: { ...getSessionHeaders(), 'Content-Type': 'application/json' },
			body: { compressed: base64 },
		}) as { success: boolean }

		expect(result.success).toBe(true)
	})

	it('should save UI state without compression (plain JSON)', async () => {
		const uiState = {
			recentColorsPerDb: {
				[testDb.name]: ['#ff0000', '#00ff00', '#0000ff'],
			},
		}

		const result = await $fetch(`/api/database/${testDb.id}/ui-state`, {
			method: 'POST',
			headers: { ...getSessionHeaders(), 'Content-Type': 'application/json' },
			body: uiState,
		}) as { success: boolean }

		expect(result.success).toBe(true)
	})

	it('should retrieve saved UI state from database list metadata', async () => {
		const testData = {
			tradeOptionsPerDb: {
				[testDb.name]: { showInactive: false, accountIds: [10, 20] },
			},
		}

		const json = JSON.stringify(testData)
		const compressed = gzipSync(Buffer.from(json))
		const base64 = compressed.toString('base64')

		await $fetch(`/api/database/${testDb.id}/ui-state`, {
			method: 'POST',
			headers: { ...getSessionHeaders(), 'Content-Type': 'application/json' },
			body: { compressed: base64 },
		})

		const uiState = await getDbUiState()

		expect(uiState).toBeDefined()
		expect(uiState!.tradeOptionsPerDb).toBeDefined()
		const tradeOptions = uiState!.tradeOptionsPerDb as Record<string, { accountIds: number[] }>
		expect(tradeOptions[testDb.name]).toBeDefined()
		expect(tradeOptions[testDb.name].accountIds).toEqual([10, 20])
	})

	it('should not bump updatedAt when saving UI state', async () => {
		const getUpdatedAt = async (): Promise<string | undefined> => {
			const databases = await $fetch('/api/database/list', {
				headers: getSessionHeaders(),
			}) as { id: number; updatedAt?: string }[]
			return databases.find(d => d.id === testDb.id)?.updatedAt
		}

		const before = await getUpdatedAt()

		await $fetch(`/api/database/${testDb.id}/ui-state`, {
			method: 'POST',
			headers: { ...getSessionHeaders(), 'Content-Type': 'application/json' },
			body: { compressed: gzipSync(Buffer.from('{"probe":1}')).toString('base64') },
		})

		expect(await getUpdatedAt()).toBe(before)
	})

	it('should reject invalid compressed data', async () => {
		try {
			await $fetch(`/api/database/${testDb.id}/ui-state`, {
				method: 'POST',
				headers: { ...getSessionHeaders(), 'Content-Type': 'application/json' },
				body: { compressed: 'invalid-base64-data!!!' },
			})
			expect.unreachable('Should have thrown')
		} catch (err) {
			expect((err as { statusCode?: number }).statusCode).toBe(500)
		}
	})

	it('should reject UI state for a database owned by another user', async () => {
		try {
			await $fetch('/api/database/999999/ui-state', {
				method: 'POST',
				headers: { ...getSessionHeaders(), 'Content-Type': 'application/json' },
				body: { compressed: gzipSync(Buffer.from('{}')).toString('base64') },
			})
			expect.unreachable('Should have thrown')
		} catch (err) {
			expect((err as { statusCode?: number }).statusCode).toBe(404)
		}
	})

	it('should handle large UI state with gzip compression', async () => {
		const largeUiState: Record<string, unknown> = {}
		for (let i = 0; i < 50; i++) {
			largeUiState[`key_${i}`] = {
				data: Array.from({ length: 100 }, (_, j) => ({
					id: j,
					value: `item_${i}_${j}`,
					nested: { a: i, b: j, c: `deep_${i}_${j}` },
				})),
			}
		}

		const json = JSON.stringify(largeUiState)
		const uncompressedSize = Buffer.byteLength(json)
		const compressed = gzipSync(Buffer.from(json))
		const compressedSize = compressed.length
		const base64 = compressed.toString('base64')

		expect(compressedSize).toBeLessThan(uncompressedSize)

		const result = await $fetch(`/api/database/${testDb.id}/ui-state`, {
			method: 'POST',
			headers: { ...getSessionHeaders(), 'Content-Type': 'application/json' },
			body: { compressed: base64 },
		}) as { success: boolean }

		expect(result.success).toBe(true)
	})
})
