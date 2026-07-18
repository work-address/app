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
