<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

function localToday(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const selectedDate = ref(localToday())
const loading = ref(false)
const lastFetchAt = ref<Date | null>(null)

const lastLoadDisplay = computed(() => {
  if (!lastFetchAt.value) return ''
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(lastFetchAt.value)
})
const fetchError = ref<string | null>(null)
const autoRefresh = ref(true)
const refreshSec = ref(120)

let refreshTimer: ReturnType<typeof setInterval> | null = null

const smartMovers = ref<{ count: number; movers: Record<string, unknown>[] } | null>(null)
const momentumScans = ref<{ count: number; scans: Record<string, unknown>[] } | null>(null)
const sectorMomentum = ref<{ count: number; sectors: Record<string, unknown>[] } | null>(null)
const patternAlerts = ref<{ count: number; alerts: Record<string, unknown>[] } | null>(null)
const stockPicks = ref<{ count: number; picks: Record<string, unknown>[] } | null>(null)
const marketInsights = ref<{ count: number; insights: Record<string, unknown>[] } | null>(null)
const patternResults = ref<Record<string, unknown> | null>(null)
const patternResultsError = ref<string | null>(null)
const patternCards = ref<Record<string, unknown> | null>(null)

const kpis = computed(() => [
  { key: 'movers', label: 'Smart movers', value: smartMovers.value?.count ?? '—' },
  { key: 'mom', label: 'Momentum scans', value: momentumScans.value?.count ?? '—' },
  { key: 'sectors', label: 'Sectors', value: sectorMomentum.value?.count ?? '—' },
  { key: 'alerts', label: 'Pattern alerts', value: patternAlerts.value?.count ?? '—' },
  { key: 'picks', label: 'Stock picks', value: stockPicks.value?.count ?? '—' },
  { key: 'insights', label: 'Insights', value: marketInsights.value?.count ?? '—' },
])

function fmtPct(n: unknown): string {
  if (n === null || n === undefined) return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`
}

function fmtNum(n: unknown, digits = 2): string {
  if (n === null || n === undefined) return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return v.toFixed(digits)
}

async function loadAll(): Promise<void> {
  loading.value = true
  fetchError.value = null
  const d = selectedDate.value
  const q = `date=${encodeURIComponent(d)}`

  try {
    const [
      rMovers,
      rMom,
      rSectors,
      rAlerts,
      rPicks,
      rInsights,
      rPatternFile,
      rCards,
    ] = await Promise.all([
      fetch(`/api/smart-movers?${q}`),
      fetch(`/api/momentum-scans?${q}`),
      fetch(`/api/sector-momentum?${q}`),
      fetch(`/api/pattern-alerts?${q}`),
      fetch(`/api/stock-picks?${q}`),
      fetch(`/api/market-insights?${q}`),
      fetch('/api/pattern-results'),
      fetch(`/api/pattern-cards?${q}`),
    ])

    const parseJson = async (res: Response) => {
      const text = await res.text()
      try {
        return JSON.parse(text)
      } catch {
        throw new Error(res.ok ? 'Invalid JSON' : text.slice(0, 120))
      }
    }

    if (!rMovers.ok) throw new Error(`Smart movers: ${rMovers.status}`)
    if (!rMom.ok) throw new Error(`Momentum: ${rMom.status}`)
    if (!rSectors.ok) throw new Error(`Sectors: ${rSectors.status}`)
    if (!rAlerts.ok) throw new Error(`Pattern alerts: ${rAlerts.status}`)
    if (!rPicks.ok) throw new Error(`Stock picks: ${rPicks.status}`)
    if (!rInsights.ok) throw new Error(`Insights: ${rInsights.status}`)

    smartMovers.value = await parseJson(rMovers)
    momentumScans.value = await parseJson(rMom)
    sectorMomentum.value = await parseJson(rSectors)
    patternAlerts.value = await parseJson(rAlerts)
    stockPicks.value = await parseJson(rPicks)
    marketInsights.value = await parseJson(rInsights)

    patternResultsError.value = null
    if (rPatternFile.ok) {
      patternResults.value = await parseJson(rPatternFile)
    } else {
      patternResults.value = null
      patternResultsError.value =
        rPatternFile.status === 404 ? 'No pattern-results file yet (run pattern scan).' : `HTTP ${rPatternFile.status}`
    }

    if (rCards.ok) {
      patternCards.value = await parseJson(rCards)
    } else {
      patternCards.value = null
    }

    lastFetchAt.value = new Date()
  } catch (e) {
    fetchError.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

function startRefreshTimer(): void {
  stopRefreshTimer()
  if (!autoRefresh.value) return
  const ms = Math.max(30, refreshSec.value) * 1000
  refreshTimer = setInterval(() => {
    void loadAll()
  }, ms)
}

function stopRefreshTimer(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

watch([autoRefresh, refreshSec], () => {
  startRefreshTimer()
})

watch(selectedDate, () => {
  void loadAll()
})

onMounted(() => {
  void loadAll()
  startRefreshTimer()
})

onUnmounted(() => {
  stopRefreshTimer()
})

const topMovers = computed(() => (smartMovers.value?.movers ?? []).slice(0, 25))
const topMomentum = computed(() => {
  const rows = [...(momentumScans.value?.scans ?? [])] as Array<{ score?: number } & Record<string, unknown>>
  rows.sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0))
  return rows.slice(0, 25)
})
</script>

<template>
  <div class="ops">
    <header class="ops-header">
      <div class="brand">
        <h1>Stocks ops</h1>
        <p class="tagline">Live feed from your jobs &amp; Supabase — leave this open on the Pi</p>
      </div>
      <div class="toolbar">
        <label class="field">
          <span>Date</span>
          <input v-model="selectedDate" type="date" class="input">
        </label>
        <label class="field checkbox">
          <input v-model="autoRefresh" type="checkbox">
          <span>Auto-refresh</span>
        </label>
        <label class="field">
          <span>Every (s)</span>
          <input v-model.number="refreshSec" type="number" min="30" step="30" class="input narrow">
        </label>
        <button type="button" class="btn" :disabled="loading" @click="loadAll">
          {{ loading ? 'Loading…' : 'Refresh' }}
        </button>
      </div>
      <p v-if="lastLoadDisplay" class="meta">Last load: {{ lastLoadDisplay }}</p>
      <p v-if="fetchError" class="error-banner">{{ fetchError }}</p>
    </header>

    <section class="kpi-row" aria-label="Counts">
      <div v-for="k in kpis" :key="k.key" class="kpi">
        <span class="kpi-value">{{ k.value }}</span>
        <span class="kpi-label">{{ k.label }}</span>
      </div>
    </section>

    <!-- Python pattern file -->
    <section class="panel">
      <h2>Pattern scan (Python file)</h2>
      <p v-if="patternResultsError" class="muted">{{ patternResultsError }}</p>
      <template v-else-if="patternResults">
        <p class="summary">
          <strong>{{ String(patternResults.scanDate ?? '—') }}</strong>
          · scanned {{ patternResults.totalScanned ?? '—' }}
          · with patterns {{ Array.isArray(patternResults.withPatterns) ? patternResults.withPatterns.length : '—' }}
        </p>
      </template>
    </section>

    <!-- Merged pattern cards -->
    <section v-if="patternCards" class="panel">
      <h2>Pattern cards (file + volume)</h2>
      <p class="summary muted">
        {{ String(patternCards.scanDate ?? '') }} — {{ patternCards.withPatternsCount ?? 0 }} symbols with patterns
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Temp</th>
              <th>Vol ratio</th>
              <th>Patterns</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="c in (patternCards.cards as Array<Record<string, unknown>>)?.slice(0, 40) ?? []"
              :key="String(c.symbol)"
            >
              <td class="sym">{{ c.symbol }}</td>
              <td>{{ c.temperature }}</td>
              <td>{{ fmtNum(c.volume_ratio, 2) }}</td>
              <td class="small">{{ Array.isArray(c.patternTypes) ? (c.patternTypes as string[]).join(', ') : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Smart movers</h2>
      <p v-if="!topMovers.length" class="muted">No rows for this date.</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Dir</th>
              <th>%</th>
              <th>Vol×</th>
              <th>Tier</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in topMovers" :key="String(m.symbol)">
              <td class="sym">{{ m.symbol }}</td>
              <td>{{ m.direction }}</td>
              <td>{{ fmtPct(m.percent_change) }}</td>
              <td>{{ fmtNum(m.volume_ratio, 2) }}</td>
              <td>{{ m.price_tier }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Momentum (top scores)</h2>
      <p v-if="!topMomentum.length" class="muted">No rows for this date.</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Score</th>
              <th>RSI</th>
              <th>5d %</th>
              <th>Vol×</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in topMomentum" :key="String(row.symbol)">
              <td class="sym">{{ row.symbol }}</td>
              <td>{{ row.score }}</td>
              <td>{{ fmtNum(row.rsi_14, 1) }}</td>
              <td>{{ fmtPct(row.price_change_5d) }}</td>
              <td>{{ fmtNum(row.volume_ratio, 2) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Sector momentum</h2>
      <p v-if="!(sectorMomentum?.sectors?.length)" class="muted">No rows for this date.</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Sector</th>
              <th>1w avg</th>
              <th>1m avg</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in sectorMomentum?.sectors ?? []" :key="String(s.sector)">
              <td>{{ s.rank }}</td>
              <td>{{ s.sector }}</td>
              <td>{{ fmtPct(s.avg_change_1w) }}</td>
              <td>{{ fmtPct(s.avg_change_1m) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Pattern alerts (JS rules)</h2>
      <p v-if="!(patternAlerts?.alerts?.length)" class="muted">No rows for this date.</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Type</th>
              <th>TF</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in (patternAlerts?.alerts ?? []).slice(0, 50)" :key="`${a.symbol}-${a.pattern_type}-${a.timeframe}`">
              <td class="sym">{{ a.symbol }}</td>
              <td>{{ a.pattern_type }}</td>
              <td>{{ a.timeframe }}</td>
              <td class="small">{{ a.pattern_date }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Stock picks</h2>
      <p v-if="!(stockPicks?.picks?.length)" class="muted">No rows for this date.</p>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Type</th>
              <th>Rank</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in stockPicks?.picks ?? []" :key="`${p.symbol}-${p.pick_type}-${p.rank}`">
              <td class="sym">{{ p.symbol }}</td>
              <td>{{ p.pick_type }}</td>
              <td>{{ p.rank }}</td>
              <td>{{ p.momentum_score }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>Market insights</h2>
      <p v-if="!(marketInsights?.insights?.length)" class="muted">No rows for this date.</p>
      <ul v-else class="insight-list">
        <li v-for="ins in marketInsights?.insights ?? []" :key="String(ins.id ?? ins.title)">
          <span class="insight-type">{{ ins.insight_type }}</span>
          <strong>{{ ins.title }}</strong>
          <p class="insight-body">{{ ins.body }}</p>
        </li>
      </ul>
    </section>

    <footer class="footer">
      <p class="muted">
        Serve with <code>npm run dashboard:serve</code> from repo root (port 3000). On the Pi, use PM2 <code>dashboard</code> in
        <code>ecosystem.config.cjs</code>.
      </p>
    </footer>
  </div>
</template>

<style scoped>
.ops {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1.25rem 1rem 3rem;
  color: var(--ops-text);
}

.ops-header {
  margin-bottom: 1.25rem;
}

.brand h1 {
  font-size: 1.5rem;
  font-weight: 650;
  letter-spacing: -0.02em;
  color: var(--ops-heading);
}

.tagline {
  margin-top: 0.35rem;
  font-size: 0.9rem;
  color: var(--ops-muted);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem 1rem;
  margin-top: 1rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
  color: var(--ops-muted);
}

.field.checkbox {
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
}

.input {
  background: var(--ops-surface);
  border: 1px solid var(--ops-border);
  border-radius: 8px;
  color: var(--ops-text);
  padding: 0.45rem 0.6rem;
  font-size: 0.9rem;
}

.input.narrow {
  width: 5rem;
}

.btn {
  background: var(--ops-accent);
  color: #041018;
  border: none;
  border-radius: 8px;
  padding: 0.5rem 1rem;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.meta {
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: var(--ops-muted);
}

.error-banner {
  margin-top: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: rgba(248, 113, 113, 0.12);
  border: 1px solid rgba(248, 113, 113, 0.35);
  border-radius: 8px;
  color: #fecaca;
  font-size: 0.9rem;
}

.kpi-row {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.kpi {
  background: var(--ops-surface);
  border: 1px solid var(--ops-border);
  border-radius: 10px;
  padding: 0.75rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.kpi-value {
  font-size: 1.35rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--ops-heading);
}

.kpi-label {
  font-size: 0.75rem;
  color: var(--ops-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.panel {
  margin-bottom: 1.5rem;
}

.panel h2 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--ops-heading);
  margin-bottom: 0.5rem;
  padding-bottom: 0.35rem;
  border-bottom: 1px solid var(--ops-border);
}

.summary {
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

.muted {
  color: var(--ops-muted);
  font-size: 0.9rem;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--ops-border);
  border-radius: 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

th,
td {
  padding: 0.45rem 0.65rem;
  text-align: left;
  border-bottom: 1px solid var(--ops-border);
}

th {
  background: rgba(255, 255, 255, 0.04);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--ops-muted);
}

tbody tr:hover {
  background: rgba(56, 189, 248, 0.06);
}

.sym {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.small {
  font-size: 0.8rem;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.insight-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.insight-list li {
  background: var(--ops-surface);
  border: 1px solid var(--ops-border);
  border-radius: 10px;
  padding: 0.75rem 1rem;
}

.insight-type {
  display: inline-block;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--ops-accent);
  margin-bottom: 0.35rem;
}

.insight-body {
  margin-top: 0.35rem;
  font-size: 0.9rem;
  color: var(--ops-muted);
  line-height: 1.45;
}

.footer {
  margin-top: 2rem;
  padding-top: 1rem;
  border-top: 1px solid var(--ops-border);
}

.footer code {
  font-size: 0.8rem;
  background: rgba(255, 255, 255, 0.06);
  padding: 0.1rem 0.35rem;
  border-radius: 4px;
}
</style>
