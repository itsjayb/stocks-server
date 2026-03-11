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

export type CardTemperature = 'hot' | 'potential' | 'cool'

export interface PatternCard {
  symbol: string
  pattern: { type: string; date: string } | null
  patternTypes: string[]
  patternCount: number
  volume_ratio: number
  high_volume: boolean
  temperature: CardTemperature
}

export interface PatternCardsPayload {
  scanDate: string
  scannedAt: string
  totalScanned: number
  withPatternsCount: number
  cards: PatternCard[]
}
