// Small wrapper around fetch for the CleanTrack API (/api).
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export async function api(path, { token, body, method } = {}) {
  let res
  try {
    res = await fetch(`/api${path}`, {
      method: method ?? (body !== undefined ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, 'Cannot reach the CleanTrack server. Check your connection and try again.')
  }
  const json = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, json?.error ?? `Request failed (${res.status}).`)
  return json
}
