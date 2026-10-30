'use client'

import { useCallback, useEffect, useState } from 'react'
import CardBox from '../shared/CardBox'
import { apiGet } from '@/lib/api'

interface Person {
  _id?: string
  id?: string
  fullName?: string
  name?: string
  email?: string
}

interface LeadInfo {
  _id?: string
  id?: string
  name?: string
  title?: string
  leadName?: string
  companyName?: string
}

interface AssignmentRecord {
  _id?: string
  id?: string
  leadId?: LeadInfo | string | null
  lead?: LeadInfo | string | null
  previousOwnerId?: Person | string | null
  oldOwnerId?: Person | string | null
  fromUserId?: Person | string | null
  newOwnerId?: Person | string | null
  assignedTo?: Person | string | null
  toUserId?: Person | string | null
  assignedBy?: Person | string | null
  performedBy?: Person | string | null
  changedBy?: Person | string | null
  createdAt?: string
  assignedAt?: string
  updatedAt?: string
  reason?: string
}

interface AssignmentHistoryResponse {
  success: boolean
  message?: string
  data?:
    | AssignmentRecord[]
    | {
        records?: AssignmentRecord[]
      }
  pagination?: {
    total?: number
    totalPages?: number
  }
}

function getObjectName(
  value: Person | LeadInfo | string | null | undefined,
): string {
  if (!value) {
    return 'Unassigned'
  }

  if (typeof value === 'string') {
    return value
  }

  return (
    ('fullName' in value ? value.fullName : undefined) ||
    ('name' in value ? value.name : undefined) ||
    ('title' in value ? value.title : undefined) ||
    ('leadName' in value ? value.leadName : undefined) ||
    ('email' in value ? value.email : undefined) ||
    ('companyName' in value ? value.companyName : undefined) ||
    'Unknown'
  )
}

function getLeadName(record: AssignmentRecord): string {
  const lead = record.lead ?? record.leadId

  if (!lead) {
    return 'Lead assignment'
  }

  if (typeof lead === 'string') {
    return `Lead #${lead.slice(-8)}`
  }

  return (
    lead.leadName ||
    lead.name ||
    lead.title ||
    lead.companyName ||
    (lead._id ? `Lead #${lead._id.slice(-8)}` : 'Lead assignment')
  )
}

function getRecordDate(record: AssignmentRecord): Date | null {
  const value =
    record.assignedAt ||
    record.createdAt ||
    record.updatedAt

  if (!value) {
    return null
  }

  const date = new Date(value)

  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(date: Date | null): string {
  if (!date) {
    return 'Date unavailable'
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function formatTime(date: Date | null): string {
  if (!date) {
    return '--:--'
  }

  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export const RecentTransaction = () => {
  const [records, setRecords] = useState<AssignmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const fetchAssignments = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError('')

    try {
      const response = await apiGet<AssignmentHistoryResponse>(
        '/admin/leads/assignment-history',
      )

      if (!response.success) {
        throw new Error(
          response.message || 'Failed to load assignment history.',
        )
      }

      const responseData = response.data

      const historyRecords = Array.isArray(responseData)
        ? responseData
        : responseData?.records ?? []

      const sortedRecords = [...historyRecords].sort((a, b) => {
        const dateA = getRecordDate(a)?.getTime() ?? 0
        const dateB = getRecordDate(b)?.getTime() ?? 0

        return dateB - dateA
      })

      setRecords(sortedRecords)
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while loading assignment history.',
      )
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchAssignments()
  }, [fetchAssignments])

  return (
    <CardBox className="h-full w-full">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h5 className="card-title">Recent Lead Assignments</h5>

          <p className="text-sm font-normal text-muted-foreground">
            Latest lead ownership changes
          </p>
        </div>

        <button
          type="button"
          onClick={() => void fetchAssignments(true)}
          disabled={loading || refreshing}
          className="rounded-md border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="mt-6">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading assignment history...
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p className="font-semibold">
              Unable to load assignment history
            </p>

            <p className="mt-1">{error}</p>

            <button
              type="button"
              onClick={() => void fetchAssignments(true)}
              className="mt-3 font-semibold underline"
            >
              Try again
            </button>
          </div>
        ) : records.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No assignment history found.
          </div>
        ) : (
          <div className="max-h-[520px] overflow-y-auto">
            {records.slice(0, 10).map((record, index) => {
              const previousOwner =
                record.previousOwnerId ??
                record.oldOwnerId ??
                record.fromUserId

              const newOwner =
                record.newOwnerId ??
                record.assignedTo ??
                record.toUserId

              const performedBy =
                record.assignedBy ??
                record.performedBy ??
                record.changedBy

              const date = getRecordDate(record)

              const recordKey =
                record._id ||
                record.id ||
                `${date?.getTime() ?? 0}-${index}`

              return (
                <div key={recordKey} className="flex gap-x-3">
                  <div className="w-[100px] shrink-0 text-right">
                    <p className="text-xs font-medium text-foreground dark:text-muted-foreground">
                      {formatTime(date)}
                    </p>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(date)}
                    </p>
                  </div>

                  <div
                    className={`relative flex shrink-0 justify-center ${
                      index === Math.min(records.length, 10) - 1
                        ? ''
                        : 'after:absolute after:bottom-0 after:left-1/2 after:top-7 after:w-px after:-translate-x-1/2 after:bg-border'
                    }`}
                  >
                    <div className="relative z-10 flex h-7 w-7 items-center justify-center">
                      <div
                        className={`h-3 w-3 rounded-full border-2 ${
                          index === 0
                            ? 'border-primary'
                            : 'border-info'
                        }`}
                      />
                    </div>
                  </div>

                  <div className="min-w-0 grow pb-6 pt-0.5">
                    <h6 className="break-words text-sm font-semibold text-foreground dark:text-muted-foreground">
                      {getLeadName(record)}
                    </h6>

                    <p className="mt-1 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {getObjectName(previousOwner)}
                      </span>
                      {' → '}
                      <span className="font-medium text-primary">
                        {getObjectName(newOwner)}
                      </span>
                    </p>

                    {performedBy && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Assigned by: {getObjectName(performedBy)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {!loading && !error && records.length > 10 && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Showing the 10 most recent assignments.
        </p>
      )}
    </CardBox>
  )
}