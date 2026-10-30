"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import Link from "next/link";
import { apiGet, ApiError } from "@/lib/api";

interface Lead {
  _id: string;
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
}

interface AssignmentUser {
  _id: string;
  fullName?: string;
  email?: string;
  employeeId?: string;
  role?: string;
  status?: string;
  isActive?: boolean;
}

interface AssignmentHistory {
  _id: string;
  leadId: Lead | string;
  previousOwnerId?: AssignmentUser | string | null;
  newOwnerId: AssignmentUser | string;
  assignedBy?: AssignmentUser | string | null;
  assignedAt?: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalRecords: number;
  totalPages: number;
}

interface HistoryResponse {
  success: boolean;
  message?: string;
  data: AssignmentHistory[];
  pagination: Pagination;
}

interface LeadsResponse {
  success: boolean;
  message?: string;
  data: {
    leads: Lead[];
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface UserListResponse {
  success: boolean;
  message?: string;
  data:
    | AssignmentUser[]
    | {
        users?: AssignmentUser[];
        items?: AssignmentUser[];
        results?: AssignmentUser[];
      };
}

const PAGE_SIZE = 10;

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;

  return fallback;
}

function extractUsers(
  response: UserListResponse,
): AssignmentUser[] {
  if (Array.isArray(response.data)) {
    return response.data;
  }

  return (
    response.data.users ||
    response.data.items ||
    response.data.results ||
    []
  );
}

function isActiveUser(user: AssignmentUser): boolean {
  if (user.role !== "user") return false;

  if (user.isActive === false) return false;

  if (
    user.status &&
    ["inactive", "deactivated", "deleted", "suspended"].includes(
      user.status.toLowerCase(),
    )
  ) {
    return false;
  }

  return true;
}

function getLeadName(
  lead: Lead | string | null | undefined,
): string {
  if (!lead) return "Lead unavailable";

  if (typeof lead === "string") {
    return `Lead ID: ${lead}`;
  }

  return lead.name || "Unnamed lead";
}

function getLeadCompany(
  lead: Lead | string | null | undefined,
): string {
  if (!lead || typeof lead === "string") return "";

  return lead.company || "";
}

function getLeadId(
  lead: Lead | string | null | undefined,
): string {
  if (!lead) return "";

  return typeof lead === "string" ? lead : lead._id;
}

function getUserName(
  user: AssignmentUser | string | null | undefined,
): string {
  if (!user) return "No previous owner";

  if (typeof user === "string") {
    return `User ID: ${user}`;
  }

  return user.fullName || user.email || "Unknown user";
}

function getUserDetails(
  user: AssignmentUser | string | null | undefined,
): string {
  if (!user || typeof user === "string") return "";

  return [
    user.email,
    user.employeeId ? `ID: ${user.employeeId}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function formatDate(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AssignmentHistoryPage() {
  const [records, setRecords] = useState<AssignmentHistory[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<AssignmentUser[]>([]);

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    totalRecords: 0,
    totalPages: 0,
  });

  const [page, setPage] = useState(1);

  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");

  const [leadFilter, setLeadFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");

  /**
   * Load leads and active regular users for dropdown filters.
   */
  const loadFilterOptions = useCallback(async () => {
    setOptionsLoading(true);
    setOptionsError("");

    try {
      const [leadResponse, userResponse] = await Promise.all([
        apiGet<LeadsResponse>(
          "/leads?page=1&limit=100&archived=false",
        ),
        apiGet<UserListResponse>(
          "/admin/users?page=1&limit=100",
        ),
      ]);

      setLeads(leadResponse.data?.leads || []);

      setUsers(
        extractUsers(userResponse).filter(isActiveUser),
      );
    } catch (err: unknown) {
      setOptionsError(
        getErrorMessage(
          err,
          "Unable to load lead and user dropdown options.",
        ),
      );
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFilterOptions();
  }, [loadFilterOptions]);

  /**
   * Load assignment history from the backend.
   */
  const loadAssignmentHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });

      if (leadFilter) {
        params.set("leadId", leadFilter);
      }

      if (ownerFilter) {
        params.set("newOwnerId", ownerFilter);
      }

      const response = await apiGet<HistoryResponse>(
        `/admin/leads/assignment-history?${params.toString()}`,
      );

      setRecords(
        Array.isArray(response.data) ? response.data : [],
      );

      if (response.pagination) {
        setPagination(response.pagination);
      }
    } catch (err: unknown) {
      setError(
        getErrorMessage(
          err,
          "Unable to load assignment history.",
        ),
      );

      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [page, leadFilter, ownerFilter]);

  useEffect(() => {
    void loadAssignmentHistory();
  }, [loadAssignmentHistory]);

  /**
   * Apply the selected dropdown filters.
   */
  function handleFilterSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setPage(1);
    setLeadFilter(selectedLeadId);
    setOwnerFilter(selectedOwnerId);
  }

  /**
   * Clear all filters.
   */
  function handleClearFilters() {
    setSelectedLeadId("");
    setSelectedOwnerId("");
    setLeadFilter("");
    setOwnerFilter("");
    setPage(1);
  }

  /**
   * Export the records currently displayed on this page.
   */
  function handleExportCSV() {
    if (records.length === 0) return;

    /**
     * Escape CSV values containing commas, quotes,
     * or line breaks.
     */
    const escapeCSV = (value: string): string => {
      return `"${value.replace(/"/g, '""')}"`;
    };

    const headers = [
      "Lead Name",
      "Company",
      "Lead Email",
      "Lead Phone",
      "Previous Owner",
      "Previous Owner Email",
      "New Owner",
      "New Owner Email",
      "Assigned By",
      "Administrator Email",
      "Assignment Date",
    ];

    const rows = records.map((record) => {
      const lead =
        typeof record.leadId === "object" && record.leadId
          ? record.leadId
          : null;

      const previousOwner =
        typeof record.previousOwnerId === "object" &&
        record.previousOwnerId
          ? record.previousOwnerId
          : null;

      const newOwner =
        typeof record.newOwnerId === "object" &&
        record.newOwnerId
          ? record.newOwnerId
          : null;

      const assignedBy =
        typeof record.assignedBy === "object" &&
        record.assignedBy
          ? record.assignedBy
          : null;

      return [
        getLeadName(record.leadId),
        getLeadCompany(record.leadId),
        lead?.email || "",
        lead?.phone || "",
        getUserName(record.previousOwnerId),
        previousOwner?.email || "",
        getUserName(record.newOwnerId),
        newOwner?.email || "",
        getUserName(record.assignedBy),
        assignedBy?.email || "",
        record.assignedAt
          ? formatDate(record.assignedAt)
          : "",
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) =>
        row
          .map((value) => escapeCSV(String(value ?? "")))
          .join(","),
      )
      .join("\r\n");

    // UTF-8 BOM helps Excel display special characters correctly.
    const blob = new Blob(["\uFEFF", csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `assignment-history-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  const startRecord =
    pagination.totalRecords === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1;

  const endRecord = Math.min(
    pagination.page * pagination.limit,
    pagination.totalRecords,
  );

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Assignment History
          </h1>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Track lead ownership changes and assignment activity.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            void loadFilterOptions();
            void loadAssignmentHistory();
          }}
          disabled={loading || optionsLoading}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          {loading || optionsLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Total Assignment Records
          </p>

          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {pagination.totalRecords}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Current Page
          </p>

          <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {pagination.page}

            <span className="ml-2 text-base font-normal text-gray-400">
              of {pagination.totalPages}
            </span>
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Filter Assignment History
        </h2>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Filter records by lead or the user receiving the assignment.
        </p>

        {optionsError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {optionsError}
          </div>
        )}

        <form
          onSubmit={handleFilterSubmit}
          className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2"
        >
          {/* Lead dropdown */}
          <div>
            <label
              htmlFor="leadFilter"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Lead
            </label>

            <select
              id="leadFilter"
              value={selectedLeadId}
              onChange={(event) =>
                setSelectedLeadId(event.target.value)
              }
              disabled={optionsLoading}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">
                All Leads
              </option>

              {leads.map((lead) => (
                <option key={lead._id} value={lead._id}>
                  {lead.name || "Unnamed lead"}
                  {lead.company ? ` — ${lead.company}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* New owner dropdown */}
          <div>
            <label
              htmlFor="ownerFilter"
              className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              New Owner
            </label>

            <select
              id="ownerFilter"
              value={selectedOwnerId}
              onChange={(event) =>
                setSelectedOwnerId(event.target.value)
              }
              disabled={optionsLoading}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
            >
              <option value="">
                All Users
              </option>

              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.fullName || user.email || user._id}
                  {user.employeeId ? ` (${user.employeeId})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Filter actions */}
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              Apply Filters
            </button>

            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Clear Filters
            </button>
          </div>
        </form>
      </div>

      {/* API error */}
      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          <p className="font-semibold">
            Unable to load assignment history
          </p>

          <p className="mt-1">{error}</p>

          <button
            type="button"
            onClick={() => void loadAssignmentHistory()}
            className="mt-3 font-semibold underline"
          >
            Try again
          </button>
        </div>
      )}

      {/* Assignment records table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Assignment Records
            </h2>

            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The latest assignment records appear first.
            </p>
          </div>

          <button
            type="button"
            onClick={handleExportCSV}
            disabled={loading || records.length === 0}
            className="inline-flex items-center justify-center rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading assignment history...
          </div>
        ) : !error && records.length === 0 ? (
          <div className="p-10 text-center">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              No assignment history found
            </h3>

            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Try changing the filters, or assign a lead to create a
              history record.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <tr>
                  <th className="px-5 py-4 font-semibold">
                    Lead
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Previous Owner
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    New Owner
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Assigned By
                  </th>

                  <th className="px-5 py-4 font-semibold">
                    Assignment Date
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {records.map((record) => {
                  const leadId = getLeadId(record.leadId);

                  return (
                    <tr
                      key={record._id}
                      className="transition hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      {/* Lead */}
                      <td className="px-5 py-4">
                        {leadId ? (
                          <Link
                            href={`/leads/${leadId}`}
                            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400"
                          >
                            {getLeadName(record.leadId)}
                          </Link>
                        ) : (
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {getLeadName(record.leadId)}
                          </span>
                        )}

                        {getLeadCompany(record.leadId) && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {getLeadCompany(record.leadId)}
                          </p>
                        )}
                      </td>

                      {/* Previous owner */}
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {getUserName(record.previousOwnerId)}
                        </p>

                        {getUserDetails(record.previousOwnerId) && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {getUserDetails(record.previousOwnerId)}
                          </p>
                        )}
                      </td>

                      {/* New owner */}
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {getUserName(record.newOwnerId)}
                        </p>

                        {getUserDetails(record.newOwnerId) && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {getUserDetails(record.newOwnerId)}
                          </p>
                        )}
                      </td>

                      {/* Assigned by */}
                      <td className="px-5 py-4">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {getUserName(record.assignedBy)}
                        </p>

                        {getUserDetails(record.assignedBy) && (
                          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            {getUserDetails(record.assignedBy)}
                          </p>
                        )}
                      </td>

                      {/* Assignment date */}
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-300">
                        {formatDate(record.assignedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading &&
          !error &&
          records.length > 0 && (
            <div className="flex flex-col gap-4 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {startRecord}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {endRecord}
                </span>{" "}
                of{" "}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {pagination.totalRecords}
                </span>{" "}
                records
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.max(1, current - 1))
                  }
                  disabled={page <= 1 || loading}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Previous
                </button>

                <span className="px-2 text-sm text-gray-600 dark:text-gray-300">
                  Page {pagination.page} of {pagination.totalPages}
                </span>

                <button
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(pagination.totalPages, current + 1),
                    )
                  }
                  disabled={
                    page >= pagination.totalPages || loading
                  }
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Next
                </button>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}