// TODO: rework
export const getProjectStatusTranslationKey = (status: string) => {
  const key = status.toLowerCase()

  if (key === 'active' || key === 'paused' || key === 'finished') {
    return `dashboard.projectsTable.status.${key}` as const
  }

  return null
}
