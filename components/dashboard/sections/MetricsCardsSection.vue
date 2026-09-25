<template>
	<div class="grid h-full grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 content-center">
		<div class="dashboard-card">
			<span class="dashboard-card-label">{{ $t('components.dashboard.index.trades_count') }}:</span>
			<span class="dashboard-card-value" :title="$t('components.dashboard.index.trades_count_tooltip')">{{ result.tradesCount }}</span>
		</div>
		<div class="dashboard-card">
			<span class="dashboard-card-label">{{ $t('components.dashboard.index.cumulated_pnl') }}:</span>
			<span class="dashboard-card-value" :title="$t('components.dashboard.index.cumulated_pnl_tooltip')">{{ formatCurrency(result.pnl) }}</span>
		</div>
		<div class="dashboard-card">
			<span class="dashboard-card-label">{{ $t('components.dashboard.index.expectancy') }}:</span>
			<span class="dashboard-card-value" :title="$t('components.dashboard.index.expectancy_tooltip')">{{ formatCurrency(result.appt) }}</span>
		</div>
		<div class="dashboard-card">
			<span class="dashboard-card-label">{{ $t('components.dashboard.index.pl_ratio') }}:</span>
			<span class="dashboard-card-value" :title="$t('components.dashboard.index.pl_ratio_tooltip')">{{ result.plRatio?.toFixed(2) }}</span>
		</div>
		<div class="dashboard-card">
			<span class="dashboard-card-label">{{ $t('components.dashboard.index.win_rate') }}:</span>
			<span class="dashboard-card-value" :title="$t('components.dashboard.index.win_rate_tooltip')">{{ result.winrate?.toFixed(2) }}%</span>
		</div>
		<div class="dashboard-card">
			<span class="dashboard-card-label">{{ $t('components.dashboard.index.profit_factor') }}:</span>
			<span class="dashboard-card-value" :title="$t('components.dashboard.index.profit_factor_tooltip')">{{ formatNumberValue(result.profitFactor) }}</span>
		</div>
		<div class="dashboard-card">
			<span class="dashboard-card-label">{{ $t('components.dashboard.index.recovery_factor') }}:</span>
			<span class="dashboard-card-value" :title="$t('components.dashboard.index.recovery_factor_tooltip')">{{ formatNumberValue(result.recoveryFactor) }}</span>
		</div>
		<div class="dashboard-card">
			<span class="dashboard-card-label">{{ $t('components.dashboard.index.sharpe_ratio') }}:</span>
			<span class="dashboard-card-value" :title="$t('components.dashboard.index.sharpe_ratio_tooltip')">{{ result.sharpeRatio?.toFixed(2) }}</span>
		</div>
	</div>
</template>

<script setup lang="ts">
import { useMetricsBaseSectionPattern } from '~/composables/dashboard/useBaseSectionPattern'
import { formatNumberValue } from '~/utils/chartFormat'

const { result, formatCurrency } = useMetricsBaseSectionPattern()
</script>
