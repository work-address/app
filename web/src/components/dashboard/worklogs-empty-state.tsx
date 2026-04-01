import DashboardEmptyState from './dashboard-empty-state'

type WorklogsEmptyStateProps = {
  onHelp?: () => void
}

export default function WorklogsEmptyState({
  onHelp,
}: WorklogsEmptyStateProps) {
  return (
    <DashboardEmptyState
      imageSrc="/img/photo/worklogs-help.svg"
      title="No worklogs yet"
      description="Looks like there’s no activity yet. Once you start tracking time on a project, your worklogs will appear here automatically."
      actionLabel="Go to Help Centre"
      onAction={onHelp}
    />
  )
}
