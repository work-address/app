export enum EProjectState {
  INACTIVE = 'Inactive',
  ACTIVE = 'Active',
}

export enum EUserProjectRole {
  ROLE_PROJECT_OWNER = 'PROJECT_ROLE_OWNER',
  ROLE_PROJECT_ADMIN = 'PROJECT_ROLE_ADMIN',
  ROLE_PROJECT_VIEWER = 'PROJECT_ROLE_VIEWER',
}

export interface IProject {
  id?: string
  title: string
  text: string
  rateHour: number
  state: EProjectState
  trackScreenshots?: boolean | null
  trackProcesses?: boolean | null
  workerAddresses?: string[]
  viewerAddresses?: string[]
}
