import type { BreakdownMetric } from '~/type'
import type { BreakdownMetrics } from '~/composables/analytics/breakdownMetrics'
import { useChartAxis } from '~/composables/charts/useChartAxis'
import { useChartTooltip } from '~/composables/charts/useChartTooltip'

// Contexte partagé des builders d'options ECharts (builders/*.ts).
// Les builders sont des fonctions pures (ctx, config) -> EChartsOption :
// ce composable assemble une fois les dépendances (axes, tooltips, i18n,
// thème) et le type ChartBuilderContext sert de contrat commun.
export const useChartBuilderContext = () => {
	const { getChartContext } = useEchartsChartOption()
	const { buildAxisConfig, buildDataZoomConfig, scaleValue, buildScatter2DDataZoom, computeAxisBounds } = useChartAxis()
	const { buildTooltipBlock, formatDimensionLabel, formatBreakdownTooltip, sortDimensionKeys, formatScatter2DTooltip } = useChartTooltip()
	const { t } = useI18n()

	return {
		getChartContext,
		buildAxisConfig,
		buildDataZoomConfig,
		scaleValue,
		buildScatter2DDataZoom,
		computeAxisBounds,
		buildTooltipBlock,
		formatDimensionLabel,
		formatBreakdownTooltip,
		sortDimensionKeys,
		formatScatter2DTooltip,
		t,
	}
}

export type ChartBuilderContext = ReturnType<typeof useChartBuilderContext>

export const getRawMetricValue = (m: BreakdownMetrics, metric: BreakdownMetric): number => {
	if (metric !== 'tradesCount' && m.tradesCount === 0) return NaN
	switch (metric) {
		case 'pnl': return m.pnl
		case 'winrate': return m.winrate
		case 'profitFactor': return m.profitFactor
		case 'avgWin': return m.avgWin
		case 'avgLoss': return -m.avgLoss
		case 'expectancy': return m.expectancy
		case 'avgDuration': return m.avgDuration
		case 'drawdown': return m.drawdown
		case 'currentDrawdown': return m.currentDrawdown
		case 'tradesCount': return m.tradesCount
		case 'appt': return m.tradesCount > 0 ? m.pnl / m.tradesCount : NaN
		default: return 0
	}
}

// Calcule l'interval des splitLines pour qu'elles tombent sur 0%, 12.5%, ..., 100%
// (9 lignes, 8 intervalles) — cohérent avec le step de computeAxisBounds
export const splitInterval = (axisMin: number, axisMax: number): number => {
	const range = axisMax - axisMin
	return range / 8
}
