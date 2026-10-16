import type {
  AIChatRequest,
  AIChatResponse,
  AIAnalyzeRequest,
  AIAnalyzeResponse,
  AITryOnRequest,
  AITryOnResponse,
} from '@cutty/types'
import { api } from './api'

// Every AI route has a 60s maxDuration on the server. The client waits a bit
// longer so the route's own error response (not a bare timeout) reaches the user.
const AI_TIMEOUT_MS = 70_000

function post<TReq, TRes>(path: string, body: TReq) {
  return api<TRes>('POST', path, body, AI_TIMEOUT_MS)
}

export function sendChatMessage(body: AIChatRequest) {
  return post<AIChatRequest, AIChatResponse>('/api/ai/chat', body)
}

export function analyzePhoto(body: AIAnalyzeRequest) {
  return post<AIAnalyzeRequest, AIAnalyzeResponse>('/api/ai/analyze', body)
}

export function tryOnStyle(body: AITryOnRequest) {
  return post<AITryOnRequest, AITryOnResponse>('/api/ai/tryon', body)
}

export function aiSearch(query: string) {
  return post<{ query: string }, import('@cutty/types').AISearchResult>('/api/ai/search', { query })
}
