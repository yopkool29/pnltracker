import type { EChartsOption } from 'echarts'
import type { EChartsFormatterParams } from '~/utils/echarts'
import type { BreakdownMetric, BreakdownDimension } from '~/type'
import type { HeatmapCell2D } from '~/composables/analytics/useAnalytics'
import { getMetricValueForMetric, formatMetricValueForMetric } from '~/composables/analytics/breakdownMetrics'
import { buildTooltipLines } from '~/composables/charts/useTooltipMetrics'
import type { ChartBuilderContext } from './context'

export const buildHeatmapChartOption = (
	builderCtx: ChartBuilderContext,
	config: {
	cells: HeatmapCell2D[]
	dimensionX: BreakdownDimension
	dimensionY: BreakdownDimension
	metric: BreakdownMetric
	selectedTooltipMetrics: BreakdownMetric[]
	heatmapColors: { min: string; max: string }
	isDark: boolean
}): EChartsOption => {

	const { getChartContext, buildTooltipBlock, formatDimensionLabel, sortDimensionKeys, t } = builderCtx
	const { cells, dimensionX, dimensionY, metric, selectedTooltipMetrics, heatmapColors, isDark } = config

	const xKeys = sortDimensionKeys(Array.from(new Set(cells.map(c => c.keyX))), dimensionX)
	const yKeys = sortDimensionKeys(Array.from(new Set(cells.map(c => c.keyY))), dimensionY)

	const xLabels = xKeys.map(k => formatDimensionLabel(dimensionX, k))
	const yLabels = yKeys.map(k => formatDimensionLabel(dimensionY, k))

	const xLabelMap = new Map<string, number>(xKeys.map((k, i) => [k, i]))
	const yLabelMap = new Map<string, number>(yKeys.map((k, i) => [k, i]))

	// Lookup O(1) pour le tooltip : cellule par index xi|yi (premier match, comme find)
	const cellByIndex = new Map<string, HeatmapCell2D>()
	const data = cells.map(c => {
		const xi = xLabelMap.get(c.keyX) ?? 0
		const yi = yLabelMap.get(c.keyY) ?? 0
		if (!cellByIndex.has(`${xi}|${yi}`)) cellByIndex.set(`${xi}|${yi}`, c)
		const val = getMetricValueForMetric(c.metrics, metric)
		return [xi, yi, val] as [number, number, number]
	})

	const maxAbs = Math.max(...data.map(d => Math.abs(d[2])), 1)

	const ctx = getChartContext()
	const { base, axisColor, textColor } = ctx

	return {
		...base,
		tooltip: buildTooltipBlock((params: EChartsFormatterParams | EChartsFormatterParams[]) => {
			const p = Array.isArray(params) ? params[0] : params
			const [xi, yi, val] = p.value as unknown as [number, number, number]
			const xLabel = xLabels[xi] ?? ''
			const yLabel = yLabels[yi] ?? ''
			const cell = cellByIndex.get(`${xi}|${yi}`)
			const primaryLines = [`${t(`components.dashboard.breakdown.metrics.${metric}`)}: ${formatMetricValueForMetric(val, metric)}`]
			return buildTooltipLines(`${yLabel} × ${xLabel}`, primaryLines, cell?.metrics, new Set([metric]), selectedTooltipMetrics, t)
		}),
		grid: { left: 60, right: 16, top: 12, bottom: 28 },
		xAxis: {
			type: 'category',
			data: xLabels,
			splitArea: { show: true },
			axisLine: { lineStyle: { color: axisColor } },
			axisTick: { show: false },
			axisLabel: { color: textColor, fontSize: 10 },
			axisPointer: { show: false },
			splitLine: { show: false },
		},
		yAxis: {
			type: 'category',
			data: yLabels,
			inverse: true,
			splitArea: { show: true },
			axisLine: { lineStyle: { color: axisColor } },
			axisTick: { show: false },
			axisLabel: { color: textColor, fontSize: 13 },
			splitLine: { show: false },
		},
		visualMap: {
			min: -maxAbs,
			max: maxAbs,
			calculable: true,
			orient: 'horizontal',
			left: 'center',
			bottom: 0,
			textStyle: { color: textColor, fontSize: 10 },
			inRange: {
				color: [heatmapColors.min, heatmapColors.max],
			},
			outOfRange: {
				color: isDark ? '#111827' : '#f3f4f6',
			},
			show: false,
		},
		series: [{
			type: 'heatmap',
			data,
			label: {
				show: false,
			},
			emphasis: {
				itemStyle: {
					shadowBlur: 10,
					shadowColor: 'rgba(0, 0, 0, 0.5)',
				},
			},
		}],
	}
}
