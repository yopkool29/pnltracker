import type { EChartsOption } from 'echarts'
import type { EChartsFormatterParams } from '~/utils/echarts'
import { formatMetricValueForMetric } from '~/composables/analytics/breakdownMetrics'
import type { ChartBuilderContext } from './context'

export const buildBoxplotChartOption = (
	builderCtx: ChartBuilderContext,
	config: {
	categories: string[]
	data: number[][]
	rawTrades: number[][]
	barColor: string
	isDark: boolean
}): EChartsOption => {

	const { getChartContext, buildTooltipBlock, t } = builderCtx
	const { categories, data, rawTrades, barColor, isDark } = config

	const ctx = getChartContext({ left: 60, right: 16, top: 12, bottom: 60 })
	const { base, axisColor, textColor, grid } = ctx

	return {
		...base,
		tooltip: buildTooltipBlock((params: EChartsFormatterParams | EChartsFormatterParams[]) => {
			const p = Array.isArray(params) ? params[0] : params
			const idx = p.dataIndex
			const cat = categories[idx] ?? ''
			const d = data[idx]
			if (!d) return ''
			const raw = rawTrades[idx] || []
			const lines = [
				`<strong>${cat}</strong>`,
				`${t('components.dashboard.breakdown.boxplot.min')}: ${formatMetricValueForMetric(d[0], 'pnl')}`,
				`${t('components.dashboard.breakdown.boxplot.q1')}: ${formatMetricValueForMetric(d[1], 'pnl')}`,
				`${t('components.dashboard.breakdown.boxplot.median')}: ${formatMetricValueForMetric(d[2], 'pnl')}`,
				`${t('components.dashboard.breakdown.boxplot.q3')}: ${formatMetricValueForMetric(d[3], 'pnl')}`,
				`${t('components.dashboard.breakdown.boxplot.max')}: ${formatMetricValueForMetric(d[4], 'pnl')}`,
				`${t('components.dashboard.breakdown.metrics.tradesCount')}: ${raw.length}`,
			]
			return lines.join('<br/>')
		}),
		grid,
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
			name: t('components.dashboard.breakdown.metrics.pnl'),
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: { color: textColor, fontSize: 11, formatter: (v: number) => formatMetricValueForMetric(v, 'pnl') },
			splitLine: { lineStyle: { color: axisColor } },
			nameTextStyle: { color: textColor, fontSize: 11 },
		},
		series: [{
			type: 'boxplot',
			data,
			itemStyle: {
				color: isDark ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.25)',
				borderColor: barColor,
				borderWidth: 1.5,
			},
		}],
	}
}
