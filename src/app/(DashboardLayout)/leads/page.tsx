"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiGet, apiPost, ApiError } from "@/lib/api";

interface LeadOwner {
  _id: string;
  fullName?: string;
  email?: string;
  role?: string;
  status?: string;
  isActive?: boolean;
}

interface LeadConfiguration {
  _id: string;
  name?: string;
  type?: string;
  description?: string;
  color?: string;
  isActive?: boolean;
  status?: string;
  sortOrder?: number;
}

interface Lead {
  _id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  ownerId?: LeadOwner | string | null;
  statusId?: LeadConfiguration | string | null;
  sourceId?: LeadConfiguration | string | null;
  createdAt?: string;
  archivedAt?: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface LeadsResponse {
  success: boolean;
  message?: string;
  data: {
    leads: Lead[];
    pagination: Pagination;
  };
}

interface ApiListResponse<T> {
  success: boolean;
  message?: string;
  data:
    | T[]
    | {
        users?: T[];
        configurations?: T[];
        leads?: T[];
        items?: T[];
        results?: T[];
        pagination?: Pagination;
      };
}

interface CreateLeadResponse {
  success: boolean;
  message?: string;
  data?: {
    lead?: Lead;
  };
}

interface BulkAssignResponse {
  success: boolean;
  message?: string;
  data?: {
    assignedCount?: number;
    count?: number;
  };
}

interface LeadForm {
  name: string;
  company: string;
  email: string;
  phone: string;
  ownerId: string;
  statusId: string;
  sourceId: string;
}

const PAGE_SIZE = 10;

const EMPTY_FORM: LeadForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  ownerId: "",
  statusId: "",
  sourceId: "",
};

function getConfigurationName(
  value?: LeadConfiguration | string | null,
): string {
  if (!value) return "—";

  if (typeof value === "string") return value;

  return value.name || "—";
}

function getOwnerName(owner?: LeadOwner | string | null): string {
  if (!owner) return "Unassigned";

  if (typeof owner === "string") return "Assigned user";

  return owner.fullName || owner.email || "Assigned user";
}

function getOwnerEmail(owner?: LeadOwner | string | null): string {
  if (!owner || typeof owner === "string") return "";

  return owner.email || "";
}

function formatDate(value?: string): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function extractItems<T>(response: ApiListResponse<T>): T[] {
  if (Array.isArray(response.data)) {
    return response.data;
  }

  const data = response.data;

  return (
    data.users ||
    data.configurations ||
    data.leads ||
    data.items ||
    data.results ||
    []
  );
}

function isActiveRecord(record: {
  status?: string;
  isActive?: boolean;
}): boolean {
  if (record.isActive === false) {
    return false;
  }

  if (
    record.status &&
    ["inactive", "deactivated", "deleted", "suspended"].includes(
      record.status.toLowerCase(),
    )
  ) {
    return false;
  }

  return true;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [archived, setArchived] = useState(false);

  const [assignedUserId, setAssignedUserId] = useState("");
  const [assignmentUsersLoading, setAssignmentUsersLoading] = useState(true);
  const [assignmentUsersError, setAssignmentUsersError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Bulk assignment state.
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkAssignOwnerId, setBulkAssignOwnerId] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [bulkAssignError, setBulkAssignError] = useState("");

  // Create Lead modal state.
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState<LeadForm>(EMPTY_FORM);

  // Dropdown options shared by the page and Create Lead modal.
  const [users, setUsers] = useState<LeadOwner[]>([]);
  const [statuses, setStatuses] = useState<LeadConfiguration[]>([]);
  const [sources, setSources] = useState<LeadConfiguration[]>([]);

  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  /**
   * Load active users automatically when the page opens.
   */
  const loadAssignmentUsers = useCallback(async () => {
    setAssignmentUsersLoading(true);
    setAssignmentUsersError("");

    try {
      const response = await apiGet<ApiListResponse<LeadOwner>>(
        "/admin/users?page=1&limit=100",
      );

      const loadedUsers = extractItems(response).filter(
        (user) => user.role === "user" && isActiveRecord(user),
      );

      setUsers(loadedUsers);
    } catch (err: unknown) {
      setAssignmentUsersError(
        getErrorMessage(err, "Unable to load assigned users."),
      );
    } finally {
      setAssignmentUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssignmentUsers();
  }, [loadAssignmentUsers]);

  /**
   * Load leads from the backend.
   */
  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(PAGE_SIZE),
        archived: String(archived),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (assignedUserId) {
        params.set("ownerId", assignedUserId);
      }

      const response = await apiGet<LeadsResponse>(
        `/leads?${params.toString()}`,
      );

      setLeads(response.data.leads || []);

      setPagination((current) => ({
        ...current,
        ...(response.data.pagination || {}),
      }));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to load leads."));
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, search, archived, assignedUserId, refreshKey]);

  /**
   * Debounce search input.
   */
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  /**
   * Fetch leads when filters or page change.
   */
  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  /**
   * Clear the current-page selection when the displayed page or filters
   * change, preventing accidental assignment of previously selected leads.
   */
  useEffect(() => {
    setSelectedLeadIds([]);
    setBulkAssignError("");
  }, [pagination.page, search, archived, assignedUserId]);

  function handleSearchChange(value: string) {
    setSearchInput(value);

    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  }

  function handleArchiveChange(value: boolean) {
    setArchived(value);

    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  }

  function handleAssignedUserChange(value: string) {
    setAssignedUserId(value);

    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  }

  function goToPage(page: number) {
    setPagination((current) => ({
      ...current,
      page,
    }));
  }

  /**
   * Select or deselect all leads currently displayed on this page.
   */
  function handleSelectAll(checked: boolean) {
    const pageIds = leads.map((lead) => lead._id);

    setSelectedLeadIds((current) =>
      checked
        ? Array.from(new Set([...current, ...pageIds]))
        : current.filter((id) => !pageIds.includes(id)),
    );

    setBulkAssignError("");
  }

  /**
   * Select or deselect an individual lead.
   */
  function handleSelectLead(leadId: string, checked: boolean) {
    setSelectedLeadIds((current) =>
      checked
        ? Array.from(new Set([...current, leadId]))
        : current.filter((id) => id !== leadId),
    );

    setBulkAssignError("");
  }

  /**
   * Assign multiple leads to one active user.
   *
   * Endpoint:
   * POST /api/v1/admin/leads/bulk-assign
   *
   * Payload:
   * {
   *   leadIds: ["leadId1", "leadId2"],
   *   ownerId: "userId"
   * }
   */
  async function handleBulkAssign() {
    setBulkAssignError("");
    setSuccessMessage("");

    if (archived) {
      setBulkAssignError("Archived leads cannot be assigned.");
      return;
    }

    if (selectedLeadIds.length === 0) {
      setBulkAssignError("Select at least one lead.");
      return;
    }

    if (!bulkAssignOwnerId) {
      setBulkAssignError("Select an active user to assign the leads to.");
      return;
    }

    const selectedUser = users.find(
      (user) => user._id === bulkAssignOwnerId,
    );

    if (
      !selectedUser ||
      selectedUser.role !== "user" ||
      !isActiveRecord(selectedUser)
    ) {
      setBulkAssignError("Select a valid active user.");
      return;
    }

    setBulkAssigning(true);

    try {
      const response = await apiPost<BulkAssignResponse>(
        "/admin/leads/bulk-assign",
        {
          leadIds: selectedLeadIds,
          ownerId: bulkAssignOwnerId,
        },
      );

      const assignedCount =
        response.data?.assignedCount ?? response.data?.count;

      setSuccessMessage(
        response.message ||
          (typeof assignedCount === "number"
            ? `${assignedCount} lead(s) assigned successfully.`
            : "Selected leads assigned successfully."),
      );

      setSelectedLeadIds([]);
      setBulkAssignOwnerId("");

      // Refresh lead records to display the updated assignments.
      setRefreshKey((current) => current + 1);
    } catch (err: unknown) {
      setBulkAssignError(
        getErrorMessage(err, "Unable to assign selected leads."),
      );
    } finally {
      setBulkAssigning(false);
    }
  }

  /**
   * Load active users, statuses, and sources when opening the form.
   */
  async function openCreateLeadModal() {
    setIsModalOpen(true);
    setForm(EMPTY_FORM);
    setFormError("");
    setSuccessMessage("");
    setOptionsError("");

    setStatuses([]);
    setSources([]);

    setOptionsLoading(true);

    try {
      const [usersResponse, statusResponse, sourceResponse] =
        await Promise.all([
          apiGet<ApiListResponse<LeadOwner>>(
            "/admin/users?page=1&limit=100",
          ),

          apiGet<ApiListResponse<LeadConfiguration>>(
            "/admin/lead-configurations?type=status&page=1&limit=100",
          ),

          apiGet<ApiListResponse<LeadConfiguration>>(
            "/admin/lead-configurations?type=source&page=1&limit=100",
          ),
        ]);

      const loadedUsers = extractItems(usersResponse).filter(
        (user) => isActiveRecord(user) && user.role === "user",
      );

      const loadedStatuses = extractItems(statusResponse).filter(
        isActiveRecord,
      );

      const loadedSources = extractItems(sourceResponse).filter(
        isActiveRecord,
      );

      setUsers(loadedUsers);
      setStatuses(loadedStatuses);
      setSources(loadedSources);
      setAssignmentUsersError("");

      if (loadedStatuses.length > 0) {
        setForm((current) => ({
          ...current,
          statusId: loadedStatuses[0]._id,
        }));
      } else {
        setFormError(
          "No active lead statuses are available. Create an active status before adding a lead.",
        );
      }
    } catch (err: unknown) {
      setOptionsError(
        getErrorMessage(err, "Unable to load form options."),
      );
    } finally {
      setOptionsLoading(false);
    }
  }

  function closeCreateLeadModal() {
    if (saving) return;

    setIsModalOpen(false);
    setForm(EMPTY_FORM);
    setFormError("");
    setOptionsError("");
  }

  function updateForm<K extends keyof LeadForm>(
    field: K,
    value: LeadForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  /**
   * Create a lead using POST /api/v1/leads.
   */
  async function handleCreateLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError("");
    setSuccessMessage("");

    if (optionsLoading) {
      setFormError("Please wait while form options are loading.");
      return;
    }

    if (optionsError) {
      setFormError("Please reload the form options before creating a lead.");
      return;
    }

    if (statuses.length === 0) {
      setFormError(
        "No active lead statuses are available. Create an active status first.",
      );
      return;
    }

    if (!form.name.trim()) {
      setFormError("Please enter the lead name.");
      return;
    }

    if (!form.statusId) {
      setFormError("Please select a lead status.");
      return;
    }

    const selectedStatus = statuses.find(
      (status) => status._id === form.statusId,
    );

    if (!selectedStatus) {
      setFormError("Please select a valid active lead status.");
      return;
    }

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      setFormError("Please enter a valid email address.");
      return;
    }

    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      statusId: form.statusId,
    };

    if (form.company.trim()) {
      payload.company = form.company.trim();
    }

    if (form.email.trim()) {
      payload.email = form.email.trim();
    }

    if (form.phone.trim()) {
      payload.phone = form.phone.trim();
    }

    if (form.ownerId) {
      const selectedUser = users.find(
        (user) => user._id === form.ownerId,
      );

      if (
        !selectedUser ||
        selectedUser.role !== "user" ||
        !isActiveRecord(selectedUser)
      ) {
        setFormError("Please select a valid active user.");
        return;
      }

      payload.ownerId = form.ownerId;
    }

    if (form.sourceId) {
      const selectedSource = sources.find(
        (source) => source._id === form.sourceId,
      );

      if (!selectedSource) {
        setFormError("Please select a valid active lead source.");
        return;
      }

      payload.sourceId = form.sourceId;
    }

    setSaving(true);

    try {
      const response = await apiPost<CreateLeadResponse>(
        "/leads",
        payload,
      );

      setSuccessMessage(
        response.message || "Lead created successfully.",
      );

      setIsModalOpen(false);
      setForm(EMPTY_FORM);

      setArchived(false);
      setSearch("");
      setSearchInput("");
      setAssignedUserId("");
      setSelectedLeadIds([]);

      setPagination((current) => ({
        ...current,
        page: 1,
      }));

      setRefreshKey((current) => current + 1);
    } catch (err: unknown) {
      setFormError(
        getErrorMessage(err, "Unable to create the lead."),
      );
    } finally {
      setSaving(false);
    }
  }

  const allCurrentPageSelected =
    leads.length > 0 &&
    leads.every((lead) => selectedLeadIds.includes(lead._id));

  const someCurrentPageSelected =
    leads.some((lead) => selectedLeadIds.includes(lead._id));

  const startItem =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1;

  const endItem = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );

  return (
    <div className="w-full min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">
      {/* Page heading */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="transition hover:text-primary">
              Dashboard
            </Link>

            <span>/</span>

            <span className="text-gray-800">Lead Management</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Lead Management
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Manage leads, track their status, and review assignments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading || bulkAssigning}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
          >
            <span aria-hidden="true">↻</span>
            Refresh
          </button>

          <button
            type="button"
            onClick={() => void openCreateLeadModal()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <span className="text-lg leading-none">+</span>
            Add Lead
          </button>
        </div>
      </div>

      {/* Success message */}
      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800"
        >
          {successMessage}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="Matching Leads"
          value={loading ? "—" : String(pagination.total)}
          description="Based on the current search and filters"
        />

        <SummaryCard
          title="Current Page"
          value={loading ? "—" : String(pagination.page)}
          description={`${pagination.totalPages} page(s) available`}
        />

        <SummaryCard
          title="Records Per Page"
          value={String(PAGE_SIZE)}
          description="Leads requested from the backend per page"
        />
      </div>

      {/* Leads table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Table heading and filters */}
        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                All Leads
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                View lead details and current assignments.
              </p>
            </div>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto lg:grid-cols-3">
              {/* Search */}
              <input
                type="search"
                value={searchInput}
                onChange={(event) =>
                  handleSearchChange(event.target.value)
                }
                placeholder="Search name, company, email..."
                aria-label="Search leads"
                className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/10 sm:col-span-2 lg:col-span-1 lg:w-72"
              />

              {/* Assigned User filter */}
              <select
                value={assignedUserId}
                onChange={(event) =>
                  handleAssignedUserChange(event.target.value)
                }
                aria-label="Filter leads by assigned user"
                disabled={assignmentUsersLoading}
                className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-primary disabled:cursor-wait disabled:bg-gray-50 lg:w-56"
              >
                <option value="">
                  {assignmentUsersLoading
                    ? "Loading users..."
                    : "All Assigned Users"}
                </option>

                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.fullName || user.email || "Unnamed User"}
                  </option>
                ))}
              </select>

              {/* Active / archived filter */}
              <select
                value={String(archived)}
                onChange={(event) =>
                  handleArchiveChange(event.target.value === "true")
                }
                aria-label="Filter archived leads"
                className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-primary lg:w-44"
              >
                <option value="false">Active Leads</option>
                <option value="true">Archived Leads</option>
              </select>
            </div>
          </div>

          {/* Assignment user loading error */}
          {assignmentUsersError && (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
            >
              <p>
                Unable to load users for the assignment filter:{" "}
                {assignmentUsersError}
              </p>

              <button
                type="button"
                onClick={() => void loadAssignmentUsers()}
                disabled={assignmentUsersLoading}
                className="mt-2 font-semibold underline disabled:opacity-50"
              >
                {assignmentUsersLoading
                  ? "Loading users..."
                  : "Retry loading users"}
              </button>
            </div>
          )}
        </div>

        {/* Bulk assignment toolbar: hidden for archived leads */}
        {!archived && (
          <div className="border-b border-gray-200 bg-gray-50/70 p-4 sm:px-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {selectedLeadIds.length} lead(s) selected
                </p>

                <p className="mt-1 text-xs text-gray-500">
                  Select leads using the checkboxes, choose an active user,
                  and assign the selected leads together.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <select
                  value={bulkAssignOwnerId}
                  onChange={(event) => {
                    setBulkAssignOwnerId(event.target.value);
                    setBulkAssignError("");
                  }}
                  disabled={
                    assignmentUsersLoading ||
                    users.length === 0 ||
                    bulkAssigning
                  }
                  aria-label="Choose user for bulk assignment"
                  className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-primary disabled:cursor-not-allowed disabled:bg-gray-100 sm:w-56"
                >
                  <option value="">
                    {assignmentUsersLoading
                      ? "Loading users..."
                      : users.length === 0
                        ? "No active users available"
                        : "Select active user"}
                  </option>

                  {users.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.fullName || user.email || "Unnamed User"}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void handleBulkAssign()}
                  disabled={
                    bulkAssigning ||
                    loading ||
                    selectedLeadIds.length === 0 ||
                    !bulkAssignOwnerId ||
                    assignmentUsersLoading ||
                    Boolean(assignmentUsersError)
                  }
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {bulkAssigning
                    ? "Assigning..."
                    : `Assign Selected (${selectedLeadIds.length})`}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedLeadIds([]);
                    setBulkAssignError("");
                  }}
                  disabled={
                    bulkAssigning || selectedLeadIds.length === 0
                  }
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Clear Selection
                </button>
              </div>
            </div>

            {bulkAssignError && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {bulkAssignError}
              </div>
            )}
          </div>
        )}

        {/* Lead loading error */}
        {error && (
          <div
            role="alert"
            className="m-4 rounded-lg border border-red-200 bg-red-50 p-4 sm:m-6"
          >
            <p className="font-semibold text-red-800">
              Unable to load leads
            </p>

            <p className="mt-1 break-words text-sm text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Leads table */}
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[1050px] border-collapse text-left">
            <thead className="bg-gray-50">
              <tr className="border-b border-gray-200">
                {!archived && (
                  <th className="w-12 px-4 py-4">
                    <input
                      type="checkbox"
                      aria-label="Select all leads on this page"
                      checked={allCurrentPageSelected}
                      ref={(element) => {
                        if (element) {
                          element.indeterminate =
                            someCurrentPageSelected &&
                            !allCurrentPageSelected;
                        }
                      }}
                      onChange={(event) =>
                        handleSelectAll(event.target.checked)
                      }
                      disabled={
                        loading || leads.length === 0 || bulkAssigning
                      }
                      className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </th>
                )}

                {[
                  "Lead",
                  "Contact",
                  "Status",
                  "Source",
                  "Assigned To",
                  "Created",
                  "Action",
                ].map((heading) => (
                  <th
                    key={heading}
                    className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading &&
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={`loading-${index}`}>
                    {Array.from({
                      length: archived ? 7 : 8,
                    }).map((__, cellIndex) => (
                      <td
                        key={`cell-${index}-${cellIndex}`}
                        className="px-5 py-5"
                      >
                        <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && !error && leads.length === 0 && (
                <tr>
                  <td
                    colSpan={archived ? 7 : 8}
                    className="px-5 py-16 text-center"
                  >
                    <h3 className="font-semibold text-gray-900">
                      No leads found
                    </h3>

                    <p className="mt-1 text-sm text-gray-500">
                      Try changing the search or filters, or create a new
                      lead.
                    </p>

                    {(search || assignedUserId || archived) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearch("");
                          setSearchInput("");
                          setAssignedUserId("");
                          setArchived(false);
                          setSelectedLeadIds([]);

                          setPagination((current) => ({
                            ...current,
                            page: 1,
                          }));
                        }}
                        className="mt-4 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        Clear Filters
                      </button>
                    )}
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                leads.map((lead) => {
                  const status = lead.statusId;

                  const statusColor =
                    status && typeof status !== "string"
                      ? status.color
                      : undefined;

                  return (
                    <tr
                      key={lead._id}
                      className="transition hover:bg-gray-50/70"
                    >
                      {!archived && (
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            aria-label={`Select ${lead.name}`}
                            checked={selectedLeadIds.includes(lead._id)}
                            onChange={(event) =>
                              handleSelectLead(
                                lead._id,
                                event.target.checked,
                              )
                            }
                            disabled={bulkAssigning}
                            className="h-4 w-4 cursor-pointer rounded border-gray-300 text-primary focus:ring-primary disabled:cursor-not-allowed"
                          />
                        </td>
                      )}

                      <td className="px-5 py-4">
                        <div className="font-semibold text-gray-900">
                          {lead.name}
                        </div>

                        <div className="mt-1 text-sm text-gray-500">
                          {lead.company || "No company provided"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="text-sm text-gray-800">
                          {lead.email || "—"}
                        </div>

                        <div className="mt-1 text-sm text-gray-500">
                          {lead.phone || "No phone"}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className="inline-flex rounded-full px-3 py-1.5 text-xs font-semibold"
                          style={
                            statusColor
                              ? {
                                  backgroundColor: `${statusColor}18`,
                                  color: statusColor,
                                }
                              : {
                                  backgroundColor: "#eff6ff",
                                  color: "#1d4ed8",
                                }
                          }
                        >
                          {getConfigurationName(lead.statusId)}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-700">
                        {getConfigurationName(lead.sourceId)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-800">
                          {getOwnerName(lead.ownerId)}
                        </div>

                        {getOwnerEmail(lead.ownerId) && (
                          <div className="mt-1 text-xs text-gray-500">
                            {getOwnerEmail(lead.ownerId)}
                          </div>
                        )}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">
                        {formatDate(lead.createdAt)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/leads/${lead._id}`}
                            className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-primary hover:text-primary"
                          >
                            View
                          </Link>

                          <Link
                            href={`/leads/${lead._id}/edit`}
                            className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-100"
                          >
                            Edit
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col gap-4 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-gray-500">
            Showing{" "}
            <span className="font-semibold text-gray-800">
              {startItem}–{endItem}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-800">
              {pagination.total}
            </span>{" "}
            leads
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={loading || pagination.page <= 1}
              onClick={() => goToPage(pagination.page - 1)}
              className="min-h-10 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="px-2 text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <button
              type="button"
              disabled={
                loading ||
                pagination.page >= pagination.totalPages
              }
              onClick={() => goToPage(pagination.page + 1)}
              className="min-h-10 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Create Lead Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-black/50 p-3 sm:items-center sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCreateLeadModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-lead-title"
            className="my-4 w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl sm:my-8"
          >
            {/* Modal heading */}
            <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-5 sm:px-7">
              <div>
                <h2
                  id="create-lead-title"
                  className="text-xl font-bold text-gray-900"
                >
                  Create New Lead
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Enter the contact information and assignment details.
                </p>
              </div>

              <button
                type="button"
                onClick={closeCreateLeadModal}
                disabled={saving}
                aria-label="Close form"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-xl text-gray-500 hover:bg-gray-50 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateLead}>
              <div className="space-y-5 px-5 py-6 sm:px-7">
                {/* Loading message */}
                {optionsLoading && (
                  <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                    Loading users, statuses, and sources...
                  </div>
                )}

                {/* Configuration-loading error */}
                {optionsError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    <p className="font-semibold">
                      Unable to load form options
                    </p>

                    <p className="mt-1">{optionsError}</p>

                    <button
                      type="button"
                      onClick={() => void openCreateLeadModal()}
                      disabled={optionsLoading || saving}
                      className="mt-2 font-semibold underline disabled:opacity-50"
                    >
                      Try again
                    </button>
                  </div>
                )}

                {/* Form validation and API errors */}
                {formError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {formError}
                  </div>
                )}

                {/* Contact information */}
                <div>
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Contact Information
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="lead-name"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Lead Name <span className="text-red-500">*</span>
                      </label>

                      <input
                        id="lead-name"
                        type="text"
                        required
                        maxLength={150}
                        value={form.name}
                        onChange={(event) =>
                          updateForm("name", event.target.value)
                        }
                        placeholder="Enter lead name"
                        className="min-h-11 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="lead-company"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Company
                      </label>

                      <input
                        id="lead-company"
                        type="text"
                        maxLength={200}
                        value={form.company}
                        onChange={(event) =>
                          updateForm("company", event.target.value)
                        }
                        placeholder="Company name"
                        className="min-h-11 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="lead-email"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Email
                      </label>

                      <input
                        id="lead-email"
                        type="email"
                        value={form.email}
                        onChange={(event) =>
                          updateForm("email", event.target.value)
                        }
                        placeholder="name@example.com"
                        className="min-h-11 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label
                        htmlFor="lead-phone"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Phone
                      </label>

                      <input
                        id="lead-phone"
                        type="tel"
                        value={form.phone}
                        onChange={(event) =>
                          updateForm("phone", event.target.value)
                        }
                        placeholder="Enter phone number"
                        className="min-h-11 w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                  </div>
                </div>

                {/* Assignment information */}
                <div className="border-t border-gray-100 pt-5">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">
                    Assignment Details
                  </h3>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Lead status */}
                    <div>
                      <label
                        htmlFor="lead-status"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Lead Status <span className="text-red-500">*</span>
                      </label>

                      <select
                        id="lead-status"
                        required
                        value={form.statusId}
                        onChange={(event) =>
                          updateForm("statusId", event.target.value)
                        }
                        disabled={
                          optionsLoading ||
                          Boolean(optionsError) ||
                          statuses.length === 0
                        }
                        className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:bg-gray-50"
                      >
                        <option value="">Select status</option>

                        {statuses.map((status) => (
                          <option key={status._id} value={status._id}>
                            {status.name || "Unnamed status"}
                          </option>
                        ))}
                      </select>

                      {!optionsLoading && statuses.length === 0 && (
                        <p className="mt-1 text-xs text-amber-700">
                          No active statuses are available. Add an active
                          status in Lead Configurations first.
                        </p>
                      )}
                    </div>

                    {/* Lead source */}
                    <div>
                      <label
                        htmlFor="lead-source"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Lead Source
                      </label>

                      <select
                        id="lead-source"
                        value={form.sourceId}
                        onChange={(event) =>
                          updateForm("sourceId", event.target.value)
                        }
                        disabled={
                          optionsLoading ||
                          Boolean(optionsError)
                        }
                        className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:bg-gray-50"
                      >
                        <option value="">Select source (optional)</option>

                        {sources.map((source) => (
                          <option key={source._id} value={source._id}>
                            {source.name || "Unnamed source"}
                          </option>
                        ))}
                      </select>

                      {!optionsLoading &&
                        !optionsError &&
                        sources.length === 0 && (
                          <p className="mt-1 text-xs text-gray-500">
                            No active sources available. You can still
                            create a lead without a source.
                          </p>
                        )}
                    </div>

                    {/* Lead owner */}
                    <div className="sm:col-span-2">
                      <label
                        htmlFor="lead-owner"
                        className="mb-1.5 block text-sm font-medium text-gray-700"
                      >
                        Assign To
                      </label>

                      <select
                        id="lead-owner"
                        value={form.ownerId}
                        onChange={(event) =>
                          updateForm("ownerId", event.target.value)
                        }
                        disabled={
                          optionsLoading ||
                          Boolean(optionsError)
                        }
                        className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-primary disabled:bg-gray-50"
                      >
                        <option value="">Unassigned</option>

                        {users.map((user) => (
                          <option key={user._id} value={user._id}>
                            {user.fullName || user.email || user._id}
                            {user.email && user.fullName
                              ? ` (${user.email})`
                              : ""}
                          </option>
                        ))}
                      </select>

                      <p className="mt-1.5 text-xs text-gray-500">
                        Only active users with the user role are shown.
                      </p>

                      {!optionsLoading &&
                        !optionsError &&
                        users.length === 0 && (
                          <p className="mt-1 text-xs text-gray-500">
                            No active users are available for assignment.
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Form actions */}
              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
                <button
                  type="button"
                  onClick={closeCreateLeadModal}
                  disabled={saving}
                  className="min-h-11 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    optionsLoading ||
                    Boolean(optionsError) ||
                    !form.statusId ||
                    statuses.length === 0
                  }
                  className="min-h-11 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Creating Lead..." : "Create Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
}: {
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>

      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>

      <p className="mt-1 text-xs text-gray-500">{description}</p>
    </div>
  );
}