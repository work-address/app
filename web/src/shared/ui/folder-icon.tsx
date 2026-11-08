import type { SVGProps } from 'react'

/**
 * A folder, drawn to sit beside the Radix icons (15px, one-pixel stroke):
 * that set has none, and a project picker reads best with one.
 */
export const FolderIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M1.5 3.5C1.5 2.948 1.948 2.5 2.5 2.5H5.793L7.293 4H12.5C13.052 4 13.5 4.448 13.5 5V11.5C13.5 12.052 13.052 12.5 12.5 12.5H2.5C1.948 12.5 1.5 12.052 1.5 11.5V3.5Z"
      stroke="currentColor"
      strokeLinejoin="round"
    />
    <path d="M1.5 6H13.5" stroke="currentColor" />
  </svg>
)
