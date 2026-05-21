const gitCommitSuffix = import.meta.env.VITE_GIT_COMMIT_SUFFIX ?? 'n/a'

export const appDocumentTitle = `Work Address [${gitCommitSuffix}]`

export function formatPageTitle(pageTitle: string) {
  return `${pageTitle} - ${appDocumentTitle}`
}
