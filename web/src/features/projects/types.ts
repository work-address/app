export type ProjectStatus = 'Active' | 'Paused' | 'Finished'

export type ProjectRow = {
  key: string
  name: string
  earnings: string
  status: ProjectStatus
  timeTotal: number
  timeActive: number
  keyboard: string
  mouse: string
  mouseDistance: string
  startDate?: Date
  publishedIn?: string
  rate?: string
  description?: string
}
