import type { EChartsOption } from 'echarts'
import type { EChartsFormatterParams } from '~/utils/echarts'
import type { BreakdownMetric } from '~/type'
import { formatMetricValueForMetric } from '~/composables/analytics/breakdownMetrics'
import type { ChartBuilderContext } from './context'

export const buildRadarChartOption = (
	builderCtx: ChartBuilderContext,
	config: {
	indicators: { name: string; max: number }[]
	values: number[][]
	names: string[]
	isDark: boolean
}): EChartsOption => {

	const { getChartContext, buildTooltipBlock } = builderCtx
	const { indicators, values, names, isDark } = config

	const ctx = getChartContext()
	const { base, textColor } = ctx

	if (!indicators.length) return { ...base }

	const palette = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316']

	return {
		...base,
		tooltip: buildTooltipBlock((params: EChartsFormatterParams | EChartsFormatterParams[]) => {
			const p = Array.isArray(params) ? params[0] : params
			const idx = p.dataIndex
			const name = names[idx] ?? ''
			const vals = values[idx] || []
			const lines = [`<strong>${name}</strong>`]
			indicators.forEach((ind, i) => {
				const val = vals[i] ?? 0
				const metricKey = ['winrate', 'profitFactor', 'expectancy', 'pnl', 'tradesCount'][i]
				lines.push(`${ind.name}: ${formatMetricValueForMetric(val, metricKey as BreakdownMetric)}`)
			})
			return lines.join('<br/>')
		}),
		legend: {
			data: names,
			bottom: 0,
			textStyle: { color: textColor, fontSize: 10 },
			type: 'scroll',
		},
		radar: {
			indicator: indicators,
			center: ['50%', '50%'],
			radius: '60%',
			axisName: { color: textColor, fontSize: 10 },
			splitArea: { areaStyle: { color: isDark ? ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.05)'] : ['rgba(0,0,0,0.02)', 'rgba(0,0,0,0.04)'] } },
			splitLine: { lineStyle: { color: isDark ? '#374151' : '#d1d5db' } },
			axisLine: { lineStyle: { color: isDark ? '#374151' : '#d1d5db' } },
		},
		series: [{
			type: 'radar',
			data: values.map((v, i) => ({
				value: v,
				name: names[i],
				areaStyle: { opacity: 0.1 },
				lineStyle: { color: palette[i % palette.length], width: 2 },
				itemStyle: { color: palette[i % palette.length] },
			})),
		}],
	}
}
