<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { PatternResultsPayload, PatternResultItem } from '@/types/pattern'

const data = ref<PatternResultsPayload | null>(null)
const error = ref<string | null>(null)
const loading = ref(true)
const page = ref(1)
const perPage = 24

const withPatterns = computed<PatternResultItem[]>(() => data.value?.withPatterns ?? [])
const totalPages = computed(() => Math.max(1, Math.ceil(withPatterns.value.length / perPage)))
const paginated = computed(() => {
  const start = (page.value - 1) * perPage
  return withPatterns.value.slice(start, start + perPage)
})

function tradingViewUrl(symbol: string): string {
  return `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(symbol)}`
}

onMounted(async () => {
  try {
    const res = await fetch('/api/pattern-results')
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.message || res.statusText || 'Failed to load')
    }
    data.value = await res.json()
  } catch (e) {
    error.value = (e as Error).message
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

    <div v-if="loading" class="loading">Loading…</div>
    <div v-if="error" class="error">{{ error }}</div>

    <template v-else-if="withPatterns.length === 0">
      <div class="empty">
        No stocks are found.
      </div>
    </template>

    <template v-else>
      <div class="cards">
        <article
          v-for="item in paginated"
          :key="item.symbol"
          class="card"
        >
          <div class="card-header">
            <a :href="tradingViewUrl(item.symbol)" target="_blank" rel="noopener" class="symbol">
              {{ item.symbol }}
            </a>
            <span class="badge">{{ item.patterns.length }} pattern{{ item.patterns.length !== 1 ? 's' : '' }}</span>
          </div>
          <ul class="pattern-list">
            <li v-for="(p, i) in item.patterns" :key="i">
              <span class="type">{{ p.type }}</span>
              <span class="date">{{ p.date }}</span>
            </li>
          </ul>
          <a :href="tradingViewUrl(item.symbol)" target="_blank" rel="noopener" class="chart-link">
            View chart →
          </a>
        </article>
      </div>

      <nav v-if="totalPages > 1" class="pagination">
        <button type="button" :disabled="page <= 1" @click="page--">Prev</button>
        <span class="page-info">Page {{ page }} of {{ totalPages }}</span>
        <button type="button" :disabled="page >= totalPages" @click="page++">Next</button>
      </nav>
    </template>
  </div>
</template>

<style scoped>
.pattern-results {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.5rem;
}
.header {
  margin-bottom: 2rem;
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
.empty code {
  background: var(--color-bg-mute);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.9em;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.25rem;
}
.card {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 1.25rem;
  transition: box-shadow 0.2s, border-color 0.2s;
}
.card:hover {
  border-color: var(--color-border-hover);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.symbol {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-accent);
  text-decoration: none;
}
.symbol:hover {
  text-decoration: underline;
}
.badge {
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  background: var(--color-badge);
  color: var(--color-badge-text);
  border-radius: 6px;
}
.pattern-list {
  list-style: none;
  padding: 0;
  margin: 0 0 1rem;
  font-size: 0.9rem;
}
.pattern-list li {
  display: flex;
  justify-content: space-between;
  padding: 0.25rem 0;
  border-bottom: 1px solid var(--color-border-subtle);
}
.pattern-list li:last-child {
  border-bottom: none;
}
.type {
  color: var(--color-text);
}
.date {
  color: var(--color-text-muted);
  font-size: 0.85em;
}
.chart-link {
  font-size: 0.875rem;
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
.page-info {
  font-size: 0.9rem;
  color: var(--color-text-muted);
}
</style>
