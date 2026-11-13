import type { BreakdownDimension, BreakdownMetric } from '~/type'
import type { EChartsOption } from 'echarts'
import type { EChartsFormatterParams } from '~/utils/echarts'
import type { BreakdownMetrics } from '~/composables/analytics/breakdownMetrics'
import { getMetricValueForMetric, getMetricColor } from '~/composables/analytics/breakdownMetrics'
import { buildBarData, buildBarSeries } from '~/utils/echarts'
import { getRawMetricValue, splitInterval } from './context'
import type { ChartBuilderContext } from './context'

export interface BarChartConfig {
	metrics: BreakdownMetrics[]
	dimension: BreakdownDimension
	metric: BreakdownMetric
	logScale: boolean
	selectedTooltipMetrics: BreakdownMetric[]
	orientation: 'horizontal' | 'vertical'
	colors: { profit: string; loss: string; bar: string; rawMetric: string }
}

export const buildBarChartOption = (
	builderCtx: ChartBuilderContext,
	config: BarChartConfig): EChartsOption => {

	const { getChartContext, buildAxisConfig, buildDataZoomConfig, scaleValue, buildTooltipBlock, formatDimensionLabel, formatBreakdownTooltip } = builderCtx
	const { metrics, dimension, metric, logScale, selectedTooltipMetrics, orientation, colors } = config

	const categories = metrics.map(m => formatDimensionLabel(dimension, m.key))
	const rawValues = metrics.map(m => getRawMetricValue(m, metric))
	const finiteValues = rawValues.filter(v => Number.isFinite(v))

	const axisConfig = buildAxisConfig(finiteValues, metric, logScale)
	// NaN (pas de donnée) → null (pas de bar), valeurs réelles → clamp aux bornes
	const scaledValues = rawValues.map(v => isNaN(v) ? null : scaleValue(v, axisConfig.bounds, logScale))

	const itemColors = metrics.map(m => getMetricColor(m, metric, colors))
	const borderRadiusFn = orientation === 'horizontal'
		? (v: number) => v >= 0 ? [0, 3, 3, 0] : [3, 0, 0, 3]
		: (v: number) => v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3]
	const data = buildBarData(scaledValues, itemColors, borderRadiusFn)
	const series = buildBarSeries({
		data,
		barMaxWidth: orientation === 'horizontal' ? 16 : 20,
		barCategoryGap: '10%',
		emphasis: { disabled: true },
	})

	const gridConfig = orientation === 'horizontal'
		? { left: 80, right: 80, top: 12, bottom: 28 }
		: { left: 60, right: 16, top: 12, bottom: 60 }
	const ctx = getChartContext(gridConfig)
	const { base, axisColor, textColor, grid } = ctx

	// Forcer l'interval des splitLines pour qu'elles tombent sur 0%, 12.5%, ..., 100%
	const barInterval = splitInterval(axisConfig.min, axisConfig.max)

	const zoomConfig = buildDataZoomConfig(
		categories.length,
		orientation === 'horizontal' ? 'vertical' : 'horizontal',
		{ threshold: 20, visibleCount: 20 }
	)

	const chartOption: EChartsOption = {
		...base,
		tooltip: buildTooltipBlock((params: EChartsFormatterParams | EChartsFormatterParams[]) => {
			const p = Array.isArray(params) ? params[0] : params
			const m = metrics[p.dataIndex]
			if (!m) return ''
			const isEmpty = m.tradesCount === 0
			const metricValue = getMetricValueForMetric(m, metric)
			return formatBreakdownTooltip(
				formatDimensionLabel(dimension, m.key),
				metric,
				metricValue,
				m,
				selectedTooltipMetrics,
				isEmpty
			)
		}, 'axis'),
		grid: orientation === 'horizontal' && zoomConfig.hasZoom
			? { ...grid, right: 100 }
			: grid,
		dataZoom: zoomConfig.hasZoom ? zoomConfig.sliders : undefined,
		series,
	}

	if (orientation === 'horizontal') {
		chartOption.xAxis = {
			type: 'value',
			min: axisConfig.min,
			max: axisConfig.max,
			interval: barInterval,
			axisLine: { lineStyle: { color: axisColor } },
			axisTick: { show: false },
			axisLabel: { color: textColor, fontSize: 11, formatter: axisConfig.formatter },
			splitLine: { lineStyle: { color: axisColor } },
		}
		chartOption.yAxis = {
			type: 'category',
			data: categories,
			inverse: true,
			axisLine: { lineStyle: { color: axisColor } },
			axisTick: { show: false },
			axisLabel: { color: textColor, fontSize: 11 },
			splitLine: { show: false },
		}
	} else {
		chartOption.xAxis = {
			type: 'category',
			data: categories,
			axisLine: { lineStyle: { color: axisColor } },
			axisTick: { show: false },
			axisLabel: { color: textColor, fontSize: 11, interval: 0, rotate: categories.length > 6 ? 30 : 0 },
			splitLine: { show: false },
		}
		chartOption.yAxis = {
			type: 'value',
			min: axisConfig.min,
			max: axisConfig.max,
			interval: barInterval,
			axisLine: { lineStyle: { color: axisColor } },
			axisTick: { show: false },
			axisLabel: { color: textColor, fontSize: 11, formatter: axisConfig.formatter },
			splitLine: { lineStyle: { color: axisColor } },
		}
	}

	return chartOption
}
