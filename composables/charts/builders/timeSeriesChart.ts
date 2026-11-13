import type { EChartsOption } from 'echarts'
import type { TimeSeriesChartType, BreakdownMetric, TradeTooltipField } from '~/type'
import type { SettingsContentType } from '~/schema/user'
import type { TradeExtendedType } from '~/schema/trade'
import type { BreakdownMetrics } from '~/composables/analytics/breakdownMetrics'
import { formatMetricValueForMetric } from '~/composables/analytics/breakdownMetrics'
import { buildTooltipLines } from '~/composables/charts/useTooltipMetrics'
import { useEchartsChartOption } from '~/composables/charts/useEchartsChartOption'
import { buildBarData, buildBarSeries, buildLineSeries, buildBarColors, chartColors, isMonetaryMetric } from '~/utils/echarts'
import type { EChartsFormatterParams, EChartsAreaStyle } from '~/utils/echarts'
import { colorToRgba } from '~/utils/chartFormat'
import { formatDateWithUserTimezone } from '~/utils/date-utils'

type EchartsComposable = ReturnType<typeof useEchartsChartOption>
type ChartContext = ReturnType<EchartsComposable['getChartContext']>
type TooltipBase = ReturnType<EchartsComposable['buildTooltip']>

export interface TimeSeriesPnlData {
	trades: TradeExtendedType[]
	labels: string[]
	values: number[]
}

export interface TimeSeriesPeriodData {
	labels: string[]
	values: number[]
	allMetrics: BreakdownMetrics[]
	maValues?: number[]
}

export interface TimeSeriesChartDeps {
	seriesType: TimeSeriesChartType
	ctx: ChartContext
	tooltipBase: TooltipBase
	scrollXEnabled: boolean
	yFmt: (v: number) => string
	locale: 'fr' | 'en' | 'us'
	t: (key: string) => string
	displayModeNet: boolean
	metric: BreakdownMetric
	userSettings: Partial<SettingsContentType> | null | undefined
	formatCurrency: (value: number | string) => string
	buildTradeTooltipLines: (tr: TradeExtendedType, alreadyShown: Set<TradeTooltipField>) => string[]
	selectedTooltipMetrics: BreakdownMetric[]
	pnlData: TimeSeriesPnlData | null
	cumulatedData: TimeSeriesPeriodData | null
	periodMetricsData: TimeSeriesPeriodData | null
	shouldCumulate: boolean
	pnlColors: { profit: string; loss: string; breakeven: string }
	tsColors: { bar?: string; rawMetric?: string; movingAverage?: string; profit?: string; loss?: string }
	startingCapital?: number | null
	showThreshold: boolean
	showMovingAverage: boolean
	showBars: boolean
	yMin?: number
	yMax?: number
	metricLabel: string
}

const createCategoryAxis = (labels: string[], rotate: number, axisColor: string, textColor: string, interval: number | 'auto' = 0) => ({
	type: 'category' as const,
	data: labels,
	axisLine: { lineStyle: { color: axisColor } },
	axisTick: { show: false },
	axisLabel: { color: textColor, fontSize: 11, interval, rotate },
	splitLine: { show: false },
})

const createValueAxis = (yFmt: (value: number) => string, axisColor: string, textColor: string) => ({
	type: 'value' as const,
	axisLine: { lineStyle: { color: axisColor } },
	axisTick: { show: false },
	axisLabel: { color: textColor, fontSize: 11, formatter: yFmt },
	splitLine: { lineStyle: { color: axisColor } },
})

export const buildTimeSeriesChartOption = (deps: TimeSeriesChartDeps): EChartsOption | undefined => {
	const {
		seriesType: st, ctx, tooltipBase, scrollXEnabled, yFmt, locale, t, displayModeNet, metric,
		userSettings, formatCurrency, buildTradeTooltipLines, selectedTooltipMetrics,
		pnlData, cumulatedData, periodMetricsData, shouldCumulate, pnlColors, tsColors,
		startingCapital, showThreshold, showMovingAverage, showBars, yMin, yMax, metricLabel,
	} = deps
	const { base, axisColor, textColor, grid } = ctx
	const chartGrid = scrollXEnabled ? { ...grid, bottom: 40 } : grid
	const dataZoom = [
		{ type: 'inside' as const, xAxisIndex: 0, filterMode: 'filter', start: 0, end: 100, moveOnMouseWheel: 'shift', zoomOnMouseWheel: false },
		{ type: 'slider' as const, xAxisIndex: 0, show: scrollXEnabled, start: 0, end: 100, height: 20, bottom: 5, filterMode: 'filter' },
	]

	// --- PnL par trade : bar chart (seriesType: 'bar') ---
	if (st === 'bar' && pnlData) {
		const { labels, values, trades } = pnlData
		const { profit: profitColor, loss: lossColor, breakeven: breakevenColor } = pnlColors
		const colors = buildBarColors(values, profitColor, lossColor, breakevenColor)
		const data = buildBarData(values, colors, (v) => (v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3]))
		const series = buildBarSeries({ data, barMaxWidth: 32, emphasis: { disabled: true } })
		return {
			...base,
			tooltip: {
				...tooltipBase,
				formatter: (params: EChartsFormatterParams | EChartsFormatterParams[]) => {
					const p = Array.isArray(params) ? params[0] : params
					const trade = trades[p.dataIndex]
					if (!trade) return ''
					const val = p.value as number
					let date = ''
					if (trade.closeDate) {
						date = formatDateWithUserTimezone(trade.closeDate, userSettings || {}, true, locale)
					}
					const symbolLabel = t('components.common.columns.headers.symbol')
					const accountLabel = t('components.common.columns.headers.account')
					const pnlLabel = displayModeNet
						? t('components.dashboard.breakdown.trade_property.netProfit')
						: t('components.dashboard.breakdown.trade_property.profit')
					const primaryLines = [
						date ? `Date: ${date}` : '',
						`${pnlLabel}: ${formatCurrency(val)}`,
						trade.account_displayName ? `${accountLabel}: ${trade.account_displayName}` : '',
						trade.symbol ? `${symbolLabel}: ${trade.symbol}` : '',
					].filter(Boolean)
					const extraLines = buildTradeTooltipLines(trade, new Set(['pnl']))
					return [...primaryLines, ...extraLines].join('<br/>')
				},
			},
			grid: chartGrid,
			dataZoom,
			xAxis: createCategoryAxis(labels, labels.length > 30 ? 45 : 0, axisColor, textColor, labels.length > 30 ? 'auto' : 0),
			yAxis: createValueAxis(yFmt, axisColor, textColor),
			series,
		}
	}

	// --- Cumulated : area chart (seriesType: 'area') ---
	if (st === 'area' && cumulatedData) {
		const baseLabels = cumulatedData.labels
		const baseValues = cumulatedData.values
		const monetary = isMonetaryMetric(metric)

		// Pour les métriques monétaires : vert/rouge (profit/loss)
		// Pour les pourcentages (winrate) : barColor (jaune)
		// Pour les métriques brutes (durée, compteur) : rawMetricColor (bleu)
		const isRawMetric = metric === 'avgDuration' || metric === 'tradesCount'
		const uniformColor = isRawMetric ? (tsColors.rawMetric || chartColors.neutral) : (tsColors.bar || chartColors.neutral)
		const pColor = monetary ? pnlColors.profit : uniformColor
		const lColor = monetary ? pnlColors.loss : uniformColor
		const pAreaColor = colorToRgba(pColor, 0.3)
		const lAreaColor = colorToRgba(lColor, 0.3)

		// Le threshold ne s'applique qu'au P&L cumulé, ignoré pour les autres métriques
		const useThreshold = showThreshold && metric === 'pnl'
		const capital = useThreshold ? startingCapital || 0 : 0
		const threshold = capital

		const labels = capital > 0 ? ['', ...baseLabels] : baseLabels
		const values = capital > 0 ? [capital, ...baseValues.map((v) => v + capital)] : baseValues

		// Sépare les points profit/loss avec points de croisement (comme BaseCumulatedLineChart)
		type DataPoint = { value: [number, number]; itemStyle?: { opacity: number }; symbolSize?: number } | null
		const profitData: DataPoint[] = []
		const lossData: DataPoint[] = []

		for (let i = 0; i < values.length; i++) {
			const v = values[i]
			const prev = i > 0 ? values[i - 1] : undefined
			if (prev !== undefined) {
				const crossedUp = prev < threshold && v >= threshold
				const crossedDown = prev >= threshold && v < threshold
				if (crossedUp || crossedDown) {
					const tRatio = (threshold - prev) / (v - prev)
					const xi = i - 1 + tRatio
					const crossingPoint = { value: [xi, threshold] as [number, number], itemStyle: { opacity: 0 }, symbolSize: 0 }
					profitData.push(crossingPoint)
					lossData.push(crossingPoint)
				}
			}
			const point = { value: [i, v] as [number, number] }
			if (v >= threshold) {
				profitData.push(point)
				lossData.push(null)
			} else {
				lossData.push(point)
				profitData.push(null)
			}
		}

		const largeDataset = values.length > 500
		const seriesBase = {
			type: 'line' as const,
			smooth: false,
			symbol: 'none',
			showSymbol: false,
			symbolSize: 0,
			connectNulls: false,
			emphasis: { disabled: true },
			blur: { lineStyle: { opacity: 1 }, areaStyle: { opacity: 0.3 } },
			...(largeDataset && { sampling: 'lttb' as const, progressive: 500, progressiveThreshold: 500 }),
		}

		return {
			...base,
			animation: false,
			tooltip: {
				...tooltipBase,
				formatter: (params: EChartsFormatterParams | EChartsFormatterParams[]) => {
					const allParams = Array.isArray(params) ? params : [params]
					// Filtre les points de croisement artificiels (x fractionnaire) pour ne garder que les vrais points
					const realParams = allParams.filter((p) => Number.isInteger((p.value as unknown as [number, number])[0]))
					const p = realParams[0] || allParams[0]
					const valPair = p.value as unknown as [number, number]
					const xi = Math.round(valPair[0])
					const label = labels[xi] || ''
					const val = valPair[1]
					const valueLabel = shouldCumulate
						? t('components.dashboard.index.cumulated_label')
						: t(`components.dashboard.breakdown.metrics.${metric}`)
					const primaryLines = [label ? `Date: ${label}` : '', `${valueLabel}: ${yFmt(val)}`].filter(Boolean)
					// Ajoute les métriques supplémentaires depuis les données par période
					const allMetrics = cumulatedData.allMetrics
					let periodMetrics: BreakdownMetrics | undefined
					if (allMetrics) {
						// Si capital > 0, le premier point (xi=0) est artificiel, on décale
						const metricIndex = capital > 0 ? xi - 1 : xi
						periodMetrics = allMetrics[metricIndex]
					}
					return buildTooltipLines('', primaryLines, periodMetrics, new Set([metric]), selectedTooltipMetrics, t)
				},
			},
			grid: chartGrid,
			dataZoom,
			xAxis: {
				type: 'value',
				min: 0,
				max: labels.length - 1,
				boundaryGap: [0, 0] as [number, number],
				axisLine: { lineStyle: { color: axisColor } },
				axisTick: { show: false },
				axisLabel: {
					color: textColor,
					fontSize: 11,
					formatter: (v: number) => labels[Math.round(v)] ?? '',
				},
				splitLine: { show: false },
			},
			yAxis: {
				type: 'value',
				scale: true,
				axisLine: { show: false },
				axisTick: { show: false },
				axisLabel: { color: textColor, fontSize: 11, formatter: (v: number) => yFmt(v) },
				splitLine: { lineStyle: { color: axisColor } },
			},
			series: [
				{
					...seriesBase,
					name: 'Cumulated',
					data: profitData,
					lineStyle: { width: 2, color: pColor },
					itemStyle: { color: pColor },
					areaStyle: { origin: threshold, color: pAreaColor } as EChartsAreaStyle,
				},
				{
					...seriesBase,
					name: 'Cumulated',
					data: lossData,
					lineStyle: { width: 2, color: lColor },
					itemStyle: { color: lColor },
					areaStyle: { origin: threshold, color: lAreaColor } as EChartsAreaStyle,
					markLine:
						threshold > 0
							? {
								  silent: true,
								  symbol: 'none',
								  lineStyle: { color: axisColor, type: 'dashed', width: 1 },
								  data: [{ yAxis: threshold }],
								  label: { show: false },
							  }
							: undefined,
				},
			],
		}
	}

	// --- BarMA : barres + moyenne mobile (seriesType: 'barMA') ---
	if (st === 'barMA' && periodMetricsData) {
		const { labels, values: barValues, maValues = [], allMetrics } = periodMetricsData

		// Couleurs génériques pour les séries temporelles (bar + MA)
		const maColor = tsColors.movingAverage || chartColors.neutral
		// Pour les barres : vert/rouge si la métrique est monétaire (pnl, appt, etc.), sinon couleur uniforme
		const canBeNegative = isMonetaryMetric(metric)
		// barColor (jaune) pour les pourcentages (winrate), rawMetricColor (bleu) pour les métriques brutes (durée, compteur)
		const isRawMetric = metric === 'avgDuration' || metric === 'tradesCount'
		const barFill = isRawMetric ? (tsColors.rawMetric || chartColors.neutral) : (tsColors.bar || chartColors.profit)

		const series: EChartsOption['series'] = []
		// MA : toujours ajoutée pour garder les données dans le tooltip, transparente si désactivée
		series.push(buildLineSeries({
			name: t('components.dashboard.index.mobile_avg_label'),
			data: maValues,
			color: maColor,
			symbolSize: 0,
			smooth: 0.2,
			lineStyle: showMovingAverage ? { width: 2, color: maColor, opacity: 1 } : { width: 0, opacity: 0 },
			itemStyle: { color: maColor, opacity: showMovingAverage ? 1 : 0 },
		}))
		// Barres : toujours ajoutées pour garder les données dans le tooltip, transparentes si désactivées
		series.push({
			type: 'bar',
			name: metricLabel || metric,
			data: barValues.map((v) => ({
				value: v,
				itemStyle: {
					color: showBars
						? (canBeNegative ? (v >= 0 ? tsColors.profit : tsColors.loss) : barFill)
						: 'rgba(0,0,0,0)',
					borderRadius: canBeNegative ? (v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3]) : [3, 3, 0, 0],
				},
			})),
			barMaxWidth: 32,
			emphasis: { disabled: true },
		})

		// Formatage selon la métrique (même formatage que les breakdowns)
		const fmtVal = (val: number) => formatMetricValueForMetric(val, metric)

		return {
			...base,
			tooltip: {
				...tooltipBase,
				formatter: (params: EChartsFormatterParams | EChartsFormatterParams[]) => {
					const list = (Array.isArray(params) ? params : [params]) as EChartsFormatterParams[]
					const dataIndex = list[0]?.dataIndex ?? 0
					const label = labels[dataIndex] || ''
					const seriesLines = list
						.map((p) => {
							const val = p.value as number
							if (val === null || val === undefined) return null
							return `${p.seriesName}: ${fmtVal(val)}`
						})
						.filter(Boolean) as string[]
					const periodMetrics = allMetrics[dataIndex]
					const primaryLines = [label ? `Date: ${label}` : '', ...seriesLines].filter(Boolean)
					return buildTooltipLines('', primaryLines, periodMetrics, new Set([metric]), selectedTooltipMetrics, t)
				},
			},
			grid: chartGrid,
			dataZoom,
			xAxis: createCategoryAxis(labels, labels.length > 12 ? 30 : 0, axisColor, textColor, labels.length > 20 ? 'auto' : 0),
			yAxis: {
				...createValueAxis(yFmt, axisColor, textColor),
				min: yMin,
				max: yMax,
				axisLine: { show: false },
			},
			series,
		}
	}

	return undefined
}
