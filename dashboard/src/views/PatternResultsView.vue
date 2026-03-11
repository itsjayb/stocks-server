<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import type { PatternCardsPayload, PatternCard } from '@/types/pattern'

const MOCK_CARDS: PatternCard[] = [
  { symbol: 'AAPL', pattern: { type: 'head_shoulders', date: '2025-03-08' }, patternTypes: ['head_shoulders'], patternCount: 1, volume_ratio: 2.8, high_volume: true, temperature: 'hot' },
  { symbol: 'TSLA', pattern: { type: 'golden_cross', date: '2025-03-07' }, patternTypes: ['golden_cross', 'breakout'], patternCount: 2, volume_ratio: 1.7, high_volume: false, temperature: 'potential' },
  { symbol: 'NVDA', pattern: { type: 'breakout', date: '2025-03-06' }, patternTypes: ['breakout'], patternCount: 1, volume_ratio: 0.9, high_volume: false, temperature: 'cool' },
  { symbol: 'META', pattern: { type: 'bullish_engulfing', date: '2025-03-05' }, patternTypes: ['bullish_engulfing'], patternCount: 1, volume_ratio: 3.2, high_volume: true, temperature: 'hot' },
  { symbol: 'AMD', pattern: { type: 'double_bottom', date: '2025-03-04' }, patternTypes: ['double_bottom'], patternCount: 1, volume_ratio: 1.2, high_volume: false, temperature: 'cool' },
]

const data = ref<PatternCardsPayload | null>(null)
const error = ref<string | null>(null)
const loading = ref(true)
const page = ref(1)
const pageInput = ref('1')
const perPage = 24
const selectedPattern = ref('all')
const symbolQuery = ref('')

const cards = computed<PatternCard[]>(() => data.value?.cards ?? [])
const availablePatternTypes = computed<string[]>(() => {
  const allTypes = new Set<string>()
  for (const card of cards.value) {
    for (const patternType of card.patternTypes) {
      allTypes.add(patternType)
    }
  }
  return Array.from(allTypes).sort((a, b) => a.localeCompare(b))
})
const filteredCards = computed<PatternCard[]>(() => {
  const query = symbolQuery.value.trim().toUpperCase()
  return cards.value.filter((card) => {
    const matchesPattern =
      selectedPattern.value === 'all' || card.patternTypes.includes(selectedPattern.value)
    const matchesSymbol = query.length === 0 || card.symbol.includes(query)
    return matchesPattern && matchesSymbol
  })
})
const totalPages = computed(() => Math.max(1, Math.ceil(filteredCards.value.length / perPage)))
const paginated = computed(() => {
  const start = (page.value - 1) * perPage
  return filteredCards.value.slice(start, start + perPage)
})

function clampPage(value: number): number {
  return Math.min(Math.max(value, 1), totalPages.value)
}

function setPage(value: number): void {
  page.value = clampPage(value)
  pageInput.value = String(page.value)
}

function goToPageFromInput(): void {
  const parsed = Number(pageInput.value)
  if (!Number.isFinite(parsed)) {
    pageInput.value = String(page.value)
    return
  }
  setPage(Math.trunc(parsed))
}

function tradingViewUrl(symbol: string): string {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`
}

function formatPatternType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatPatternList(types: string[]): string {
  return types.map((type) => formatPatternType(type)).join(', ')
}

watch(totalPages, () => {
  if (page.value > totalPages.value) {
    setPage(totalPages.value)
    return
  }
  pageInput.value = String(page.value)
})

watch([selectedPattern, symbolQuery], () => {
  setPage(1)
})

onMounted(async () => {
  try {
    const res = await fetch('/api/pattern-cards')
    const text = await res.text()
    let parsed: PatternCardsPayload
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new Error('Invalid response from server')
    }
    if (!res.ok) {
      throw new Error((parsed as { message?: string }).message || res.statusText || 'Failed to load')
    }
    data.value = parsed
  } catch (e) {
    error.value = null
    data.value = {
      scanDate: new Date().toISOString().slice(0, 10),
      scannedAt: new Date().toISOString(),
      totalScanned: 0,
      withPatternsCount: MOCK_CARDS.length,
      cards: MOCK_CARDS,
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="pattern-results">
    <header class="header">
      <h1>Pattern Scanner</h1>
      <p class="subtitle">Stocks with chart patterns (daily, 1Y)</p>
      <div v-if="data" class="meta">
        Last scan: {{ data.scanDate }} — {{ data.withPatternsCount }} with patterns of {{ data.totalScanned }} scanned
      </div>
    </header>

    <!-- Legend bar -->
    <div class="legend">
      <span class="legend-item hot">
        <span class="legend-dot"></span>
        Hot
      </span>
      <span class="legend-item potential">
        <span class="legend-dot"></span>
        Potential
      </span>
      <span class="legend-item cool">
        <span class="legend-dot"></span>
        Cool
      </span>
    </div>

    <div v-if="loading" class="loading">Loading…</div>
    <div v-if="error" class="error">{{ error }}</div>

    <div v-if="cards.length > 0" class="filters">
      <label class="filter-control">
        Pattern
        <select v-model="selectedPattern">
          <option value="all">All patterns</option>
          <option v-for="patternType in availablePatternTypes" :key="patternType" :value="patternType">
            {{ formatPatternType(patternType) }}
          </option>
        </select>
      </label>

      <label class="filter-control">
        Symbol
        <input
          v-model="symbolQuery"
          type="text"
          placeholder="e.g. AAPL"
        >
      </label>

      <div class="results-meta">
        Showing {{ filteredCards.length }} of {{ cards.length }}
      </div>
    </div>

    <template v-else-if="cards.length === 0">
      <div class="empty">
        No stocks are found.
      </div>
    </template>

    <template v-else-if="filteredCards.length === 0">
      <div class="empty">
        No stocks match the current filters.
      </div>
    </template>

    <template v-else>
      <div class="cards">
        <article
          v-for="item in paginated"
          :key="item.symbol"
          class="card"
          :class="[
            `temp-${item.temperature}`,
            { 'high-volume': item.high_volume }
          ]"
        >
          <a :href="tradingViewUrl(item.symbol)" target="_blank" rel="noopener" class="symbol">
            {{ item.symbol }}
          </a>
          <div v-if="item.pattern" class="pattern">
            {{ formatPatternType(item.pattern.type) }}
            <span class="pattern-date">{{ item.pattern.date }}</span>
          </div>
          <div v-if="item.patternTypes.length > 1" class="pattern-extra">
            Also found: {{ formatPatternList(item.patternTypes) }}
          </div>
          <a :href="tradingViewUrl(item.symbol)" target="_blank" rel="noopener" class="chart-link">
            View chart →
          </a>
        </article>
      </div>

      <nav v-if="totalPages > 1" class="pagination">
        <button type="button" :disabled="page <= 1" @click="setPage(page - 1)">Prev</button>
        <form class="page-jump" @submit.prevent="goToPageFromInput">
          <label for="page-jump-input">Page</label>
          <input
            id="page-jump-input"
            v-model="pageInput"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            aria-label="Go to page number"
          >
          <button type="submit">Go</button>
        </form>
        <span class="page-info">Page {{ page }} of {{ totalPages }}</span>
        <button type="button" :disabled="page >= totalPages" @click="setPage(page + 1)">Next</button>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.pattern-results {
  width: 100%;
  padding: 1.5rem;
}
.header {
  margin-bottom: 1.5rem;
  text-align: center;
}
.header h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-heading);
  margin-bottom: 0.25rem;
}
.subtitle {
  color: var(--color-text-muted);
  font-size: 0.95rem;
}
.meta {
  margin-top: 0.75rem;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

/* Legend bar */
.legend {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  padding: 0.5rem 0;
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 600;
}
.legend-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid;
}
.legend-item.hot .legend-dot {
  background: #dc2626;
  border-color: #dc2626;
}
.legend-item.potential .legend-dot {
  background: #ea580c;
  border-color: #ea580c;
}
.legend-item.cool .legend-dot {
  background: #93c5fd;
  border-color: #93c5fd;
}

.loading,
.error,
.empty {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-muted);
}
.error {
  color: #e57373;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  justify-content: center;
  gap: 1rem;
  margin-bottom: 1rem;
}
.filter-control {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
.filter-control select,
.filter-control input {
  min-width: 180px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.45rem 0.6rem;
  background: var(--color-card);
  color: var(--color-text);
}
.results-meta {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.cards {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 1rem;
}
.card {
  background: #f9fafb;
  border: 3px solid;
  border-radius: 12px;
  padding: 1rem;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.card.temp-hot {
  border-color: #dc2626;
}
.card.temp-potential {
  border-color: #ea580c;
}
.card.temp-cool {
  border-color: #93c5fd;
}
.card.high-volume {
  border-color: #dc2626 !important;
  animation: bounce-subtle 1.5s ease-in-out infinite;
}
@keyframes bounce-subtle {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
.card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  animation: wobble 0.4s ease-in-out;
}
@keyframes wobble {
  0% { transform: translateX(0); }
  25% { transform: translateX(-3px); }
  50% { transform: translateX(3px); }
  75% { transform: translateX(-2px); }
  100% { transform: translateX(0); }
}
.symbol {
  display: block;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-accent);
  text-decoration: none;
  margin-bottom: 0.5rem;
}
.symbol:hover {
  text-decoration: underline;
}
.pattern {
  font-size: 0.9rem;
  color: var(--color-text);
  margin-bottom: 0.5rem;
}
.pattern-date {
  display: block;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: 0.15rem;
}
.pattern-extra {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-bottom: 0.5rem;
}
.chart-link {
  font-size: 0.8rem;
  color: var(--color-accent);
  text-decoration: none;
}
.chart-link:hover {
  text-decoration: underline;
}
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  padding: 1rem;
}
.pagination button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-card);
  color: var(--color-text);
  cursor: pointer;
  font-size: 0.9rem;
}
.pagination button:hover:not(:disabled) {
  background: var(--color-bg-mute);
  border-color: var(--color-border-hover);
}
.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.page-jump {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.page-jump label {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}
.page-jump input {
  width: 4.5rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  padding: 0.35rem 0.45rem;
  background: var(--color-card);
  color: var(--color-text);
}
.page-jump button {
  padding: 0.35rem 0.65rem;
}
.page-info {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}
</style>
