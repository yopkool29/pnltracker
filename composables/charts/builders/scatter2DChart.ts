import type { EChartsOption, SeriesOption } from 'echarts'
import type { EChartsFormatterParams } from '~/utils/echarts'
import type { BreakdownMetric, BreakdownDimension } from '~/type'
import type { BreakdownMetrics } from '~/composables/analytics/breakdownMetrics'
import { getRawMetricValue, splitInterval } from './context'
import type { ChartBuilderContext } from './context'

export const buildScatter2DChartOption = (
	builderCtx: ChartBuilderContext,
	config: {
	metrics: BreakdownMetrics[]
	dimension: BreakdownDimension
	metricX: BreakdownMetric
	metricY: BreakdownMetric
	colorMetric: BreakdownMetric
	logScale: boolean
	selectedTooltipMetrics: BreakdownMetric[]
	showScrollX: boolean
	showScrollY: boolean
	showLabels: boolean
	scatter2DColors: { min: string; mid: string; max: string }
	isDark: boolean
}): EChartsOption => {

	const { getChartContext, buildAxisConfig, scaleValue, buildScatter2DDataZoom, buildTooltipBlock, formatDimensionLabel, formatScatter2DTooltip, t } = builderCtx
	const { metrics, dimension, metricX, metricY, colorMetric, logScale, selectedTooltipMetrics, showScrollX, showScrollY, showLabels, scatter2DColors, isDark } = config

	const rawPoints = metrics.map(m => ({
		vx: getRawMetricValue(m, metricX),
		vy: getRawMetricValue(m, metricY),
		vc: getRawMetricValue(m, colorMetric),
		key: m.key,
	}))

	const ctx = getChartContext({ left: 70, right: 40, top: 85, bottom: 40 })
	const { base, axisColor, textColor, grid } = ctx

	const xFinite = rawPoints.filter(p => Number.isFinite(p.vx)).map(p => p.vx)
	const yFinite = rawPoints.filter(p => Number.isFinite(p.vy)).map(p => p.vy)

	const xAxisConfig = buildAxisConfig(xFinite, metricX, logScale)
	const yAxisConfig = buildAxisConfig(yFinite, metricY, logScale)

	// Clamp colorMetric to a finite value so points with Infinity (e.g. profitFactor
	// when no losses) are still displayed on the chart instead of being filtered out
	const clampColorValue = (v: number): number => {
		if (!Number.isFinite(v)) return v > 0 ? 999 : -999
		return v
	}

	const data = rawPoints
		.map(p => ({
			value: [
				scaleValue(p.vx, xAxisConfig.bounds, logScale),
				scaleValue(p.vy, yAxisConfig.bounds, logScale),
				p.key,
				clampColorValue(p.vc),
				p.vx,
				p.vy,
			] as unknown as number[],
		}))
		.filter(p => Number.isFinite(p.value[0] as number) && Number.isFinite(p.value[1] as number))

	const colorValues = data.map(d => d.value[3] as number)
	const colorMin = Math.min(...colorValues, 0)
	const colorMax = Math.max(...colorValues, 1)
	const colorPalette = [scatter2DColors.min, scatter2DColors.mid, scatter2DColors.max]

	const dataZoom = buildScatter2DDataZoom(showScrollX, showScrollY)

	const xInterval = splitInterval(xAxisConfig.min, xAxisConfig.max)
	const yInterval = splitInterval(yAxisConfig.min, yAxisConfig.max)

	return {
		...base,
		tooltip: buildTooltipBlock((params: EChartsFormatterParams<number | number[]> | EChartsFormatterParams<number | number[]>[]) => {
			const p = Array.isArray(params) ? params[0] : params
			const v = p.value as number[]
			const realVx = v[4] as number
			const realVy = v[5] as number
			const key = String(v[2])
			const fullMetric = metrics.find(m => m.key === key)
			return formatScatter2DTooltip(
				formatDimensionLabel(dimension, key),
				metricX,
				metricY,
				colorMetric,
				realVx,
				realVy,
				v[3] as number,
				fullMetric,
				selectedTooltipMetrics
			)
		}),
		grid,
		visualMap: {
			min: colorMin,
			max: colorMax,
			dimension: 3,
			calculable: true,
			orient: 'horizontal',
			left: 70,
			top: 10,
			textStyle: { color: textColor, fontSize: 10 },
			inRange: { color: colorPalette },
			show: true,
		},
		dataZoom,
		xAxis: {
			min: xAxisConfig.min,
			max: xAxisConfig.max,
			interval: xInterval,
			axisLine: { lineStyle: { color: axisColor } },
			axisTick: { show: false },
			axisLabel: { color: textColor, fontSize: 11, formatter: xAxisConfig.formatter },
			splitLine: { lineStyle: { color: axisColor } },
			name: t(`components.dashboard.breakdown.metrics.${metricX}`),
			nameLocation: 'middle',
			nameGap: 30,
			nameTextStyle: { color: textColor, fontSize: 12, fontWeight: 'bold' },
		},
		yAxis: {
			type: 'value',
			name: t(`components.dashboard.breakdown.metrics.${metricY}`),
			min: yAxisConfig.min,
			max: yAxisConfig.max,
			interval: yInterval,
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: { color: textColor, fontSize: 11, formatter: yAxisConfig.formatter },
			splitLine: { lineStyle: { color: axisColor } },
			nameLocation: 'middle',
			nameGap: 50,
			nameTextStyle: { color: textColor, fontSize: 12, fontWeight: 'bold' },
		},
		series: [{
			type: 'scatter',
			data,
			symbolSize: 10,
			emphasis: {
				scale: 1.4,
				itemStyle: { borderColor: isDark ? '#fff' : '#1f2937', borderWidth: 2 },
			},
			label: {
				show: showLabels,
				position: 'top',
				formatter: (p: { value: number[] }) => {
					const key = String(p.value[2])
					return formatDimensionLabel(dimension, key)
				},
				color: textColor,
				fontSize: 12,
			},
		}] as SeriesOption[],
	}
}
