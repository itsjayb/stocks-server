export interface PatternItem {
  type: string
  date: string
}

export interface PatternResultItem {
  symbol: string
  patterns: PatternItem[]
}

export interface PatternResultsPayload {
  scanDate: string
  scannedAt: string
  totalScanned: number
  withPatternsCount: number
  results: PatternResultItem[]
  withPatterns: PatternResultItem[]
  errors: string[]
}
