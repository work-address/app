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

export type ProjectsDialogMode = 'view' | 'edit'

export type CollaboratorRole = 'Worker' | 'Viewer'

export type CollaboratorFormRow = {
  address: string
  role: CollaboratorRole
}

/** Shared create/edit project form shape, including collaborators. */
export type ProjectFormValues = {
  title: string
  rateHour: string
  text: string
  state: string
  collaborators: CollaboratorFormRow[]
  trackScreenshots: boolean
  trackProcesses: boolean
}
