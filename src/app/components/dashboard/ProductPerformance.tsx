'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import CardBox from '../shared/CardBox'
import { Badge } from '@/components/ui/badge'
import { apiGet } from '@/lib/api'

interface PerformanceUser {
  _id: string
  fullName?: string
  email?: string
  role?: string
  status?: string
  employeeId?: string
}

interface LeadOwner {
  _id?: string
  fullName?: string
  email?: string
}

interface PerformanceLead {
  _id: string
  ownerId?: LeadOwner | string | null
}

interface Pagination {
  totalPages?: number
  totalUsers?: number
  total?: number
  currentPage?: number
  page?: number
}

interface UsersResponse {
  success: boolean
  message?: string
  data?: {
    users?: PerformanceUser[]
    pagination?: Pagination
  }
}

interface LeadsResponse {
  success: boolean
  message?: string
  data?: {
    leads?: PerformanceLead[]
    pagination?: Pagination
  }
}

interface UserPerformance {
  user: PerformanceUser
  assignedLeads: number
}

function getStatusClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'active':
      return 'bg-green-100 text-green-700'
    case 'invited':
      return 'bg-blue-100 text-blue-700'
    case 'suspended':
      return 'bg-yellow-100 text-yellow-800'
    case 'deactivated':
    case 'deleted':
    case 'pending_deletion':
      return 'bg-red-100 text-red-700'
    default:
      return 'bg-gray-100 text-gray-700'
  }
}

function getOwnerId(ownerId: PerformanceLead['ownerId']): string | null {
  if (!ownerId) {
    return null
  }

  if (typeof ownerId === 'string') {
    return ownerId
  }

  return ownerId._id ?? null
}

export const ProductPerformance = () => {
  const [performers, setPerformers] = useState<UserPerformance[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [totalLeads, setTotalLeads] = useState(0)
  const [unassignedLeads, setUnassignedLeads] = useState(0)

  const fetchPerformance = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      // Fetch the first page of users.
      const firstUsersResponse = await apiGet<UsersResponse>(
        '/admin/users?page=1&limit=100',
      )

      if (!firstUsersResponse.success || !firstUsersResponse.data) {
        throw new Error(
          firstUsersResponse.message || 'Failed to load users.',
        )
      }

      const allUsers = [...(firstUsersResponse.data.users ?? [])]

      const userPagination = firstUsersResponse.data.pagination
      const userTotalPages = Math.max(
        1,
        userPagination?.totalPages ?? 1,
      )

      // Fetch any remaining user pages.
      for (let page = 2; page <= userTotalPages; page += 1) {
        const response = await apiGet<UsersResponse>(
          `/admin/users?page=${page}&limit=100`,
        )

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to load users.')
        }

        allUsers.push(...(response.data.users ?? []))
      }

      // Fetch the first page of leads.
      const firstLeadsResponse = await apiGet<LeadsResponse>(
        '/leads?page=1&limit=100',
      )

      if (!firstLeadsResponse.success || !firstLeadsResponse.data) {
        throw new Error(
          firstLeadsResponse.message || 'Failed to load leads.',
        )
      }

      const allLeads = [...(firstLeadsResponse.data.leads ?? [])]

      const leadPagination = firstLeadsResponse.data.pagination
      const leadTotalPages = Math.max(
        1,
        leadPagination?.totalPages ?? 1,
      )

      // Fetch any remaining lead pages.
      for (let page = 2; page <= leadTotalPages; page += 1) {
        const response = await apiGet<LeadsResponse>(
          `/leads?page=${page}&limit=100`,
        )

        if (!response.success || !response.data) {
          throw new Error(response.message || 'Failed to load leads.')
        }

        allLeads.push(...(response.data.leads ?? []))
      }

      // Count assigned leads for each user.
      const leadCounts = new Map<string, number>()
      let unassignedCount = 0

      allLeads.forEach((lead) => {
        const ownerId = getOwnerId(lead.ownerId)

        if (!ownerId) {
          unassignedCount += 1
          return
        }

        leadCounts.set(
          ownerId,
          (leadCounts.get(ownerId) ?? 0) + 1,
        )
      })

      const performanceData: UserPerformance[] = allUsers.map((user) => ({
        user,
        assignedLeads: leadCounts.get(user._id) ?? 0,
      }))

      // Show users with the most assigned leads first.
      performanceData.sort(
        (a, b) => b.assignedLeads - a.assignedLeads,
      )

      setPerformers(performanceData)
      setTotalLeads(allLeads.length)
      setUnassignedLeads(unassignedCount)
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Something went wrong while loading user performance.'

      setError(message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchPerformance()
  }, [fetchPerformance])

  return (
    <CardBox>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h5 className="card-title">User Performance</h5>
          <p className="text-sm font-normal text-muted-foreground">
            User accounts and their assigned lead counts
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchPerformance(true)}
          disabled={loading || refreshing}
          className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh Data'}
        </button>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Users</p>
          <p className="mt-1 text-2xl font-semibold">
            {loading ? '...' : performers.length}
          </p>
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Total Leads</p>
          <p className="mt-1 text-2xl font-semibold">
            {loading ? '...' : totalLeads}
          </p>
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Unassigned Leads</p>
          <p className="mt-1 text-2xl font-semibold">
            {loading ? '...' : unassignedLeads}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <p className="font-semibold">Unable to load user performance</p>
          <p className="mt-1">{error}</p>

          <button
            type="button"
            onClick={() => void fetchPerformance(true)}
            className="mt-2 font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      <div className="flex flex-col">
        <div className="-m-1.5 overflow-x-auto">
          <div className="inline-block min-w-full align-middle p-1.5">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-sm font-semibold">
                      ID
                    </TableHead>

                    <TableHead className="text-sm font-semibold">
                      Assigned To
                    </TableHead>

                    <TableHead className="text-sm font-semibold">
                      Role
                    </TableHead>

                    <TableHead className="text-sm font-semibold">
                      Assigned Leads
                    </TableHead>

                    <TableHead className="text-sm font-semibold">
                      Status
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        Loading user performance...
                      </TableCell>
                    </TableRow>
                  ) : performers.length === 0 && !error ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-muted-foreground"
                      >
                        No users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    performers.map((item, index) => {
                      const user = item.user
                      const status = user.status || 'unknown'

                      return (
                        <TableRow
                          key={user._id}
                          className="border-b border-border"
                        >
                          <TableCell>
                            <p className="text-sm font-medium text-muted-foreground">
                              {index + 1}
                            </p>
                          </TableCell>

                          <TableCell className="ps-0 min-w-[220px]">
                            <div>
                              <h6 className="mb-1 text-sm font-semibold">
                                {user.fullName || 'Unnamed User'}
                              </h6>

                              <p className="text-xs font-medium text-muted-foreground">
                                {user.email || 'No email available'}
                              </p>

                              {user.employeeId && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Employee ID: {user.employeeId}
                                </p>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge className="rounded-full bg-gray-100 px-3 py-0.5 text-[13px] text-gray-700">
                              {user.role || 'Unknown'}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <span className="inline-flex min-w-10 items-center justify-center rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                              {item.assignedLeads}
                            </span>
                          </TableCell>

                          <TableCell>
                            <Badge
                              className={`justify-center rounded-full px-3 py-0.5 text-[13px] ${getStatusClass(status)}`}
                            >
                              {status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      </div>
    </CardBox>
  )
}