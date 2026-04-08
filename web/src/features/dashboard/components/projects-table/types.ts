import type { ProjectStatus } from '@/features/dashboard'

export type ProjectRow = {
  key: string
  name: string
  earnings: string
  status: ProjectStatus
  timeTotal: string
  timeActive: string
  keyboard: string
  mouse: string
  mouseDistance: string
  startDate?: Date
  publishedIn?: string
  rate?: string
  description?: string
}
