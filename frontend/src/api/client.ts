import type {
  Batch,
  BatchTriagePayload,
  Client,
  DashboardData,
  EsgCertificate,
  LedgerEntry,
  LedgerVerifyResult,
  MassBalanceAnomalyError,
  Partner,
  ReconcilePayload,
  ReconcileSuccessResponse,
} from '../types'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, message: string, data: unknown) {
    super(message)
    this.status = status
    this.data = data
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  const text = await res.text()
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }

  if (!res.ok) {
    const detail =
      typeof parsed === 'object' && parsed !== null && 'detail' in parsed
        ? (parsed as { detail: unknown }).detail
        : `Request failed with status ${res.status}`
    const message =
      typeof detail === 'string'
        ? detail
        : typeof detail === 'object' && detail !== null && 'message' in detail
          ? String((detail as { message: unknown }).message)
          : `HTTP ${res.status}`
    throw new ApiError(res.status, message, parsed)
  }

  return parsed as T
}

export const api = {
  getHealth: () => request<{ status: string; ledger_valid: boolean }>('/health'),
  getClients: () => request<Client[]>('/clients'),
  getPartners: () => request<Partner[]>('/partners'),
  getDashboard: () => request<DashboardData>('/dashboard'),
  getBatches: () => request<Batch[]>('/batches'),
  triageBatch: (payload: BatchTriagePayload) =>
    request<Batch>('/batches/triage', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  advanceBatch: (batchId: string, nistWiped = true) =>
    request<Batch>(`/batches/${encodeURIComponent(batchId)}/advance`, {
      method: 'POST',
      body: JSON.stringify({ nist_wiped: nistWiped }),
    }),
  reconcileBatch: async (
    batchId: string,
    payload: ReconcilePayload
  ): Promise<
    | { ok: true; data: ReconcileSuccessResponse }
    | { ok: false; anomaly: MassBalanceAnomalyError }
  > => {
    const res = await fetch(`${API_BASE}/batches/${encodeURIComponent(batchId)}/reconcile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await res.json()
    if (res.status === 422 && body?.error_code === 'MASS_BALANCE_ANOMALY') {
      return { ok: false, anomaly: body as MassBalanceAnomalyError }
    }
    if (!res.ok) {
      throw new ApiError(res.status, body?.detail ?? `HTTP ${res.status}`, body)
    }
    return { ok: true, data: body as ReconcileSuccessResponse }
  },
  getCertificate: (batchId: string) =>
    request<EsgCertificate>(`/batches/${encodeURIComponent(batchId)}/certificate`),
  getLedger: (limit = 100) => request<LedgerEntry[]>(`/ledger?limit=${limit}`),
  verifyLedger: () => request<LedgerVerifyResult>('/ledger/verify'),
}
