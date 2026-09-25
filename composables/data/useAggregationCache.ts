import { groupTradesByPeriod } from '~/utils/dashboardPeriods'
import type { TradeType } from '~/schema/trade'
import type { SettingsContentType } from '~/schema/user'

type GroupedTrades = Record<string, TradeType[]>
type AggregationMode = 'day' | 'week' | 'month' | 'year'

// Cache partagé entre instances de widgets : indexé sur la référence du
// tableau de trades (WeakMap → invalidation automatique quand lastTrades
// est remplacé — c'est un shallowRef toujours réassigné, jamais muté)
// puis par clé mode|displayModeNet|timezone. Pas de watchers nécessaires.
let sharedCache = new WeakMap<TradeType[], Map<string, GroupedTrades>>()

const timezoneKey = (settings: Partial<SettingsContentType> | null) =>
	`${settings?.timezoneDisplay ?? ''}|${settings?.timezoneLocal ?? ''}|${settings?.timezoneUtcOffset ?? ''}`

export const useAggregationCache = () => {
	const dataStore = useDataStore()
	const userStore = useUserStore()
	const { displayModeNet } = useNetGrossDisplay()

	const getGroupedTrades = (mode: AggregationMode): GroupedTrades => {
		const trades = dataStore.lastTrades as TradeType[]
		if (!trades || trades.length === 0) return {}

		const settings = userStore.settingsObject
		const key = `${mode}|${displayModeNet.value}|${timezoneKey(settings)}`

		let perTrades = sharedCache.get(trades)
		if (!perTrades) {
			perTrades = new Map()
			sharedCache.set(trades, perTrades)
		}
		const cached = perTrades.get(key)
		if (cached) return cached

		const grouped = groupTradesByPeriod(trades, mode, settings)
		perTrades.set(key, grouped)
		return grouped
	}

	const clearCache = () => {
		sharedCache = new WeakMap()
	}

	return {
		getGroupedTrades,
		clearCache,
	}
}
