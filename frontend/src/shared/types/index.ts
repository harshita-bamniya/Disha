/** Generic paginated API response shape */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

/** Generic select option */
export interface SelectOption<T = string> {
  label: string
  value: T
  disabled?: boolean
}

/** Sort direction */
export type SortDir = 'asc' | 'desc'

/** Column definition for DataTable */
export interface TableColumn<T> {
  key: string
  header: string
  /** Render function — if omitted, renders row[key] as string */
  render?: (row: T) => React.ReactNode
  sortable?: boolean
  width?: number | string
  align?: 'left' | 'center' | 'right'
}
