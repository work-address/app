export const TIME_TRACKER_CONNECTED_STATE = 'Connected'

export type TimeTrackerConnectPhase =
  | 'idle'
  | 'loading'
  | 'awaiting_auth'
  | 'awaiting_pair'
  | 'connecting'
  | 'connected'
  | 'error'

export type TimeTrackerNonceData = {
  nonce?: string
  ip?: string
  state?: string
  jwt?: {
    accessToken?: string
    refreshToken?: string
  }
}

export const getTimeTrackerNonceStorageKey = (nonce: string) =>
  `timetracker-nonce-${nonce}`
