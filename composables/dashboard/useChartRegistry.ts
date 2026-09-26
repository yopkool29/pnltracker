import type { ChartKey } from '~/type'

interface ChartRegistration {
	id: ChartKey
	category: 'main' | 'time'
	defaultVisible: boolean
}

// Anciennes clés (rétro-compatibilité) — pointent vers les nouveaux widgets.
// NE PAS SUPPRIMER : ces ids n'ont plus de composant associé mais persistent
// dans dashboardChartVisibility* des workspaces sauvegardés. Ils servent à
// construire emptyChartVisibility (useDashboardWorkspace) et le merge des
// défauts du workspace summary (useDashboardGridLayout) — les retirer ferait
// perdre leurs clés aux maps de visibilité persistées.
const chartRegistry: ChartRegistration[] = [
	{ id: 'pnlBar', category: 'main', defaultVisible: true },
	{ id: 'cumulatedPnl', category: 'main', defaultVisible: true },
	{ id: 'appt', category: 'main', defaultVisible: true },
	{ id: 'winrate', category: 'main', defaultVisible: true },
]

export const useMetricsChartRegistry = () => {
	const getCharts = () => chartRegistry
	const getDefaultChartVisibility = (): Record<string, boolean> => {
		return chartRegistry.reduce((acc, item) => {
			acc[item.id] = item.defaultVisible
			return acc
		}, {} as Record<string, boolean>)
	}

	return {
		getCharts,
		getDefaultChartVisibility,
	}
}
