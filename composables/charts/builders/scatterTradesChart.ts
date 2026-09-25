import type { EChartsOption, SeriesOption } from 'echarts'
import type { EChartsFormatterParams } from '~/utils/echarts'
import type { TradeProperty, TradeTooltipField } from '~/type'
import type { TradeExtendedType } from '~/schema/trade'
import { formatMetricValueForMetric } from '~/composables/analytics/breakdownMetrics'
import { formatTradeTooltipField } from '~/utils/chartFormat'
import { splitInterval } from './context'
import type { ChartBuilderContext } from './context'

export const buildScatterTradesChartOption = (
	builderCtx: ChartBuilderContext,
	config: {
	trades: TradeExtendedType[]
	propX: TradeProperty
	propY: TradeProperty
	logScale: boolean
	showScrollX: boolean
	showScrollY: boolean
	profitColor: string
	lossColor: string
	displayModeNet: boolean
	selectedTooltipMetrics: TradeTooltipField[]
}): EChartsOption => {

	const { getChartContext, scaleValue, buildScatter2DDataZoom, computeAxisBounds, buildTooltipBlock, t } = builderCtx
	const { trades, propX, propY, logScale, showScrollX, showScrollY, profitColor, lossColor, displayModeNet, selectedTooltipMetrics } = config

	const getTradePropertyValue = (tr: TradeExtendedType, prop: TradeProperty): number => {
		switch (prop) {
			case 'duration': {
				const ms = tr.closeDate.getTime() - tr.openDate.getTime()
				return ms > 0 ? ms / 60000 : 0
			}
			case 'pnl': return displayModeNet ? tr.netProfit : tr.profit
			case 'mfe': return tr.mfe ?? NaN
			case 'mae': return tr.mae ?? NaN
			default: return 0
		}
	}

	const formatTradePropertyValue = (val: number, prop: TradeProperty): string => {
		if (prop === 'duration') {
			if (val < 60) return `${val.toFixed(0)}m`
			if (val < 1440) return `${(val / 60).toFixed(1)}h`
			return `${(val / 1440).toFixed(1)}d`
		}
		return formatMetricValueForMetric(val, 'pnl')
	}

	const rawPoints = trades.map(tr => {
		const ms = tr.closeDate.getTime() - tr.openDate.getTime()
		const durationMin = ms > 0 ? ms / 60000 : 0
		return {
			vx: getTradePropertyValue(tr, propX),
			vy: getTradePropertyValue(tr, propY),
			duration: durationMin,
			tr,
		}
	})

	const ctx = getChartContext({ left: 70, right: 40, top: 50, bottom: 40 })
	const { base, axisColor, textColor, grid } = ctx

	const xFinite = rawPoints.filter(p => Number.isFinite(p.vx)).map(p => p.vx)
	const yFinite = rawPoints.filter(p => Number.isFinite(p.vy)).map(p => p.vy)

	const xBounds = computeAxisBounds(xFinite)
	const yBounds = computeAxisBounds(yFinite)

	const data = rawPoints.map(p => ({
		value: [
			scaleValue(p.vx, xBounds, false),
			scaleValue(p.vy, yBounds, logScale),
			p.tr.symbol,
			p.tr.profit,
			p.vx,
			p.vy,
		] as unknown as number[],
		itemStyle: {
			color: p.tr.profit >= 0 ? profitColor : lossColor,
			opacity: 0.7,
		},
	}))

	const dataZoom = buildScatter2DDataZoom(showScrollX, showScrollY)

	return {
		...base,
		tooltip: buildTooltipBlock((params: EChartsFormatterParams | EChartsFormatterParams[]) => {
			const p = Array.isArray(params) ? params[0] : params
			const d = p.data as { value: number[] }
			const rp = rawPoints.find(rp => rp.tr.symbol === d.value[2] && rp.vx === d.value[4] && rp.vy === d.value[5])
			const tr = rp?.tr
			if (!tr) return ''
			const dateStr = tr.openDate.toLocaleDateString()
			const timeStr = tr.openDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
			const pnl = displayModeNet ? tr.netProfit : tr.profit
			// Lignes de base : date, ticker, P&L (P&L toujours affiché)
			const alreadyShown = new Set<TradeTooltipField>(['pnl'])
			const lines = [
				`${dateStr} ${timeStr}`,
				`${t('components.dashboard.breakdown.dimensions.ticker')}: ${tr.symbol}`,
				`${t('components.dashboard.breakdown.trade_property.pnl')}: ${formatCurrency(pnl)}`,
			]
			// Ajoute les propriétés sélectionnées dans le menu tooltip
			for (const field of selectedTooltipMetrics) {
				if (alreadyShown.has(field)) continue
				const line = formatTradeTooltipField(tr, field, t, rp?.duration)
				if (line) lines.push(line)
			}
			return lines.join('<br/>')
		}),
		grid,
		dataZoom,
		xAxis: {
			type: 'value',
			min: xBounds.axisMin,
			max: xBounds.axisMax,
			interval: splitInterval(xBounds.axisMin, xBounds.axisMax),
			name: t(`components.dashboard.breakdown.trade_property.${propX}`),
			nameLocation: 'middle',
			nameGap: 28,
			nameTextStyle: { color: textColor, fontSize: 11 },
			axisLine: { lineStyle: { color: axisColor } },
			axisTick: { show: false },
			axisLabel: { color: textColor, fontSize: 11, formatter: (v: number) => formatTradePropertyValue(v, propX) },
			splitLine: { lineStyle: { color: axisColor } },
		},
		yAxis: {
			type: 'value',
			min: yBounds.axisMin,
			max: yBounds.axisMax,
			interval: splitInterval(yBounds.axisMin, yBounds.axisMax),
			name: t(`components.dashboard.breakdown.trade_property.${propY}`),
			nameLocation: 'middle',
			nameGap: 50,
			nameTextStyle: { color: textColor, fontSize: 11 },
			axisLine: { lineStyle: { color: axisColor } },
			axisTick: { show: false },
			axisLabel: { color: textColor, fontSize: 11, formatter: (v: number) => formatTradePropertyValue(v, propY) },
			splitLine: { lineStyle: { color: axisColor } },
		},
		series: [{
			type: 'scatter',
			data,
			symbolSize: 8,
			emphasis: {
				focus: 'series',
				itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.3)' },
			},
		}] as SeriesOption[],
	}
}
