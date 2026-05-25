import { Navigate, useRouteError } from 'react-router-dom'

export const ErrorBoundary = () => {
  const error = useRouteError() as Error

  if (
    'status' in error &&
    typeof error.status === 'number' &&
    error.status === 404
  ) {
    return <Navigate to="/" />
  }

  return (
    <div>
      An error occurred:
      {error.message}
    </div>
  )
}
