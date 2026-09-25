import type { BreakdownDimension, BreakdownMetric } from '~/type'
import type { EChartsOption } from 'echarts'
import type { EChartsFormatterParams } from '~/utils/echarts'
import type { BreakdownMetrics } from '~/composables/analytics/breakdownMetrics'
import { getMetricValueForMetric, getMetricColor } from '~/composables/analytics/breakdownMetrics'
import { buildScatterSeries } from '~/utils/echarts'
import type { ChartBuilderContext } from './context'

export interface ScatterChartConfig {
	metrics: BreakdownMetrics[]
	dimension: BreakdownDimension
	metric: BreakdownMetric
	selectedTooltipMetrics: BreakdownMetric[]
	colors: { profit: string; loss: string; bar: string; rawMetric: string }
	isDark: boolean
}

export const buildScatterChartOption = (
	builderCtx: ChartBuilderContext,
	config: ScatterChartConfig): EChartsOption => {

	const { getChartContext, buildAxisConfig, buildDataZoomConfig, buildTooltipBlock, formatDimensionLabel, formatBreakdownTooltip, t } = builderCtx
	const { metrics, dimension, metric, selectedTooltipMetrics, colors, isDark } = config

	const categories = metrics.map(m => formatDimensionLabel(dimension, m.key))
	const data = metrics.map((m, idx) => ({
		value: [
			idx,
			getMetricValueForMetric(m, metric),
			m.pnl,
			m.key,
			m.tradesCount,
		] as unknown as number[],
		itemStyle: {
			color: getMetricColor(m, metric, colors),
			borderColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.2)',
			borderWidth: 1,
			borderType: 'solid' as const,
		},
	}))

	const ctx = getChartContext({ left: 60, right: 16, top: 24, bottom: categories.length > 20 ? 60 : 40 })
	const { base, axisColor, textColor, grid } = ctx

	const yAxisName = t(`components.dashboard.breakdown.metrics.${metric}`)
	const yAxisMin = metric === 'winrate' ? 0 : undefined
	const yAxisMax = metric === 'winrate' ? 100 : undefined

	const zoomConfig = buildDataZoomConfig(categories.length, 'horizontal', { threshold: 25, visibleCount: 25 })

	return {
		...base,
		tooltip: buildTooltipBlock((params: EChartsFormatterParams<number | number[]> | EChartsFormatterParams<number | number[]>[]) => {
			const p = Array.isArray(params) ? params[0] : params
			const v = p.value as number[]
			const idx = v[0]
			const metricValue = v[1]
			const key = String(v[3])
			const fullMetric = metrics[idx]
			const isEmpty = fullMetric?.tradesCount === 0
			return formatBreakdownTooltip(
				formatDimensionLabel(dimension, key),
				metric,
				metricValue,
				fullMetric,
				selectedTooltipMetrics,
				isEmpty
			)
		}),
		grid,
		dataZoom: zoomConfig.hasZoom ? zoomConfig.sliders : undefined,
		xAxis: {
			type: 'category',
			data: categories,
			axisLine: { lineStyle: { color: axisColor } },
			axisTick: { show: false },
			axisLabel: { color: textColor, fontSize: 11, interval: 0, rotate: categories.length > 6 ? 30 : 0 },
			splitLine: { show: false },
		},
		yAxis: {
			type: 'value',
			name: yAxisName,
			min: yAxisMin,
			max: yAxisMax,
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: { color: textColor, fontSize: 11, formatter: (v: number) => {
				const axisConfig = buildAxisConfig([v], metric, false)
				return axisConfig.formatter(v)
			} },
			splitLine: { lineStyle: { color: axisColor } },
			nameTextStyle: { color: textColor, fontSize: 11 },
		},
		series: buildScatterSeries({
			data,
			symbolSize: (d: unknown[]) => {
				const pnl = Math.abs(d[2] as number)
				return Math.min(12, Math.max(8, Math.sqrt(pnl) / 12))
			},
		}, isDark),
	}
}
