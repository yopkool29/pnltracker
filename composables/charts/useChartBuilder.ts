import { useChartBuilderContext } from '~/composables/charts/builders/context'
import { buildBarChartOption } from '~/composables/charts/builders/barChart'
import { buildScatterChartOption } from '~/composables/charts/builders/scatterChart'
import { buildScatter2DChartOption } from '~/composables/charts/builders/scatter2DChart'
import { buildScatterTradesChartOption } from '~/composables/charts/builders/scatterTradesChart'
import { buildHeatmapChartOption } from '~/composables/charts/builders/heatmapChart'
import { buildBoxplotChartOption } from '~/composables/charts/builders/boxplotChart'
import { buildRadarChartOption } from '~/composables/charts/builders/radarChart'

// Façade de compatibilité : instancie le contexte une fois et expose
// l'API historique buildXxxChartOption(config). Les implémentations
// vivent dans composables/charts/builders/* (boxplot/radar en standby).
export const useChartBuilder = () => {
	const ctx = useChartBuilderContext()

	return {
		buildBarChartOption: (config: Parameters<typeof buildBarChartOption>[1]) => buildBarChartOption(ctx, config),
		buildScatterChartOption: (config: Parameters<typeof buildScatterChartOption>[1]) => buildScatterChartOption(ctx, config),
		buildScatter2DChartOption: (config: Parameters<typeof buildScatter2DChartOption>[1]) => buildScatter2DChartOption(ctx, config),
		buildScatterTradesChartOption: (config: Parameters<typeof buildScatterTradesChartOption>[1]) => buildScatterTradesChartOption(ctx, config),
		buildHeatmapChartOption: (config: Parameters<typeof buildHeatmapChartOption>[1]) => buildHeatmapChartOption(ctx, config),
		buildBoxplotChartOption: (config: Parameters<typeof buildBoxplotChartOption>[1]) => buildBoxplotChartOption(ctx, config),
		buildRadarChartOption: (config: Parameters<typeof buildRadarChartOption>[1]) => buildRadarChartOption(ctx, config),
	}
}
