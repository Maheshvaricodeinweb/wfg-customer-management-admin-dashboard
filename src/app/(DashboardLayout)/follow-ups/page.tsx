"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { apiGet, apiPost, apiPatch, ApiError } from "@/lib/api";

/* =========================
   TYPES
========================= */

type FollowUpType =
  | "call"
  | "meeting"
  | "whatsapp"
  | "email"
  | "site_visit"
  | "send_quotation";

type FollowUpStatus =
  | "pending"
  | "completed"
  | "cancelled"
  | "missed";

type RecurrenceFrequency = "weekly" | "monthly";

type SnoozeDuration =
  | "one_hour"
  | "tomorrow"
  | "next_week"
  | "custom";

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Lead {
  _id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  ownerId?: User | string | null;
}

interface User {
  _id: string;
  fullName?: string;
  email?: string;
  role?: string;
  status?: string;
  isActive?: boolean;
}

interface FollowUpRecurrence {
  frequency: RecurrenceFrequency;
  endAt?: string | null;
}

interface FollowUp {
  _id: string;
  leadId: Lead | string;
  ownerId: User | string;
  createdBy?: User | string;
  completedBy?: User | string | null;
  type: FollowUpType;
  purpose: string;
  notes?: string;
  dueAt: string;
  reminderAt?: string | null;
  status: FollowUpStatus;
  completedAt?: string | null;
  recurrence?: FollowUpRecurrence | null;
  recurrenceSeriesId?: string | null;
  recurrenceOccurrence?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface FollowUpsResponse {
  success: boolean;
  message?: string;
  data: {
    followUps: FollowUp[];
    pagination: Pagination;
  };
}

interface SingleFollowUpResponse {
  success: boolean;
  message?: string;
  data?: {
    followUp?: FollowUp;
  };
}

interface ApiListResponse<T> {
  success: boolean;
  message?: string;
  data:
    | T[]
    | {
        users?: T[];
        leads?: T[];
        items?: T[];
        results?: T[];
        pagination?: Pagination;
      };
}

interface FollowUpForm {
  leadId: string;
  ownerId: string;
  type: FollowUpType;
  purpose: string;
  notes: string;
  dueAt: string;
  reminderAt: string;
  recurrenceFrequency: "" | RecurrenceFrequency;
  recurrenceEndAt: string;
}

const PAGE_SIZE = 10;

const FOLLOW_UP_TYPES: {
  value: FollowUpType;
  label: string;
}[] = [
  { value: "call", label: "Call" },
  { value: "meeting", label: "Meeting" },
  { value: "whatsapp", label: "WhatsApp / Message" },
  { value: "email", label: "Email" },
  { value: "site_visit", label: "Site Visit" },
  { value: "send_quotation", label: "Send Quotation" },
];

const EMPTY_FORM: FollowUpForm = {
  leadId: "",
  ownerId: "",
  type: "call",
  purpose: "",
  notes: "",
  dueAt: "",
  reminderAt: "",
  recurrenceFrequency: "",
  recurrenceEndAt: "",
};

/* =========================
   HELPER FUNCTIONS
========================= */

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return fallback;
}

function extractItems<T>(response: ApiListResponse<T>): T[] {
  if (Array.isArray(response.data)) {
    return response.data;
  }

  return (
    response.data.users ||
    response.data.leads ||
    response.data.items ||
    response.data.results ||
    []
  );
}

function getLeadName(value: Lead | string): string {
  if (typeof value === "string") {
    return "Lead";
  }

  return value.name || "Lead";
}

function getLeadCompany(value: Lead | string): string {
  if (typeof value === "string") {
    return "";
  }

  return value.company || "";
}

function getUserName(value: User | string): string {
  if (typeof value === "string") {
    return "Assigned user";
  }

  return value.fullName || value.email || "Assigned user";
}

function getTypeLabel(type: FollowUpType): string {
  return (
    FOLLOW_UP_TYPES.find((item) => item.value === type)?.label ||
    type
  );
}

function getStatusLabel(status: FollowUpStatus): string {
  const labels: Record<FollowUpStatus, string> = {
    pending: "Pending",
    completed: "Completed",
    cancelled: "Cancelled",
    missed: "Missed",
  };

  return labels[status] || status;
}

function getRecurrenceLabel(
  recurrence?: FollowUpRecurrence | null,
): string {
  if (!recurrence) return "Does not repeat";

  return recurrence.frequency === "weekly"
    ? "Weekly"
    : "Monthly";
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function toDateTimeLocal(value?: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset() * 60000;

  return new Date(date.getTime() - offset)
    .toISOString()
    .slice(0, 16);
}

function isActiveUser(user: User): boolean {
  if (user.isActive === false) return false;

  return ![
    "inactive",
    "deactivated",
    "deleted",
    "suspended",
  ].includes((user.status || "").toLowerCase());
}

function isOverdue(followUp: FollowUp): boolean {
  return (
    followUp.status === "pending" &&
    new Date(followUp.dueAt).getTime() < Date.now()
  );
}

/* =========================
   MAIN PAGE
========================= */

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);

  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [overdueFilter, setOverdueFilter] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFollowUp, setEditingFollowUp] =
    useState<FollowUp | null>(null);

  const [form, setForm] = useState<FollowUpForm>(EMPTY_FORM);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [optionsError, setOptionsError] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [actionLoadingId, setActionLoadingId] = useState("");

  /* =========================
     SNOOZE STATE
  ========================= */

  const [snoozeFollowUp, setSnoozeFollowUp] =
    useState<FollowUp | null>(null);

  const [snoozeDuration, setSnoozeDuration] =
    useState<SnoozeDuration>("one_hour");

  const [customSnoozeDueAt, setCustomSnoozeDueAt] =
    useState("");

  const [snoozeError, setSnoozeError] = useState("");
  const [snoozeLoading, setSnoozeLoading] = useState(false);

  /* =========================
     LOAD FOLLOW-UPS
  ========================= */

  const loadFollowUps = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(PAGE_SIZE),
      });

      if (search.trim()) {
        params.set("search", search.trim());
      }

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      if (typeFilter) {
        params.set("type", typeFilter);
      }

      if (overdueFilter) {
        params.set("overdue", overdueFilter);
      }

      const response = await apiGet<FollowUpsResponse>(
        `/follow-ups?${params.toString()}`,
      );

      setFollowUps(response.data.followUps || []);

      setPagination((current) => ({
        ...current,
        ...(response.data.pagination || {}),
      }));
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, "Unable to load follow-ups."),
      );

      setFollowUps([]);
    } finally {
      setLoading(false);
    }
  }, [
    pagination.page,
    search,
    statusFilter,
    typeFilter,
    overdueFilter,
    refreshKey,
  ]);

  useEffect(() => {
    void loadFollowUps();
  }, [loadFollowUps]);

  /* =========================
     SEARCH
  ========================= */

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  function resetPage() {
    setPagination((current) => ({
      ...current,
      page: 1,
    }));
  }

  function handleSearchChange(value: string) {
    setSearchInput(value);
    resetPage();
  }

  function goToPage(page: number) {
    setPagination((current) => ({
      ...current,
      page,
    }));
  }

  /* =========================
     LOAD FORM OPTIONS
  ========================= */

  async function loadFormOptions() {
    setOptionsLoading(true);
    setOptionsError("");

    try {
      const [leadsResponse, usersResponse] = await Promise.all([
        apiGet<ApiListResponse<Lead>>(
          "/leads?page=1&limit=100&archived=false",
        ),

        apiGet<ApiListResponse<User>>(
          "/admin/users?page=1&limit=100",
        ),
      ]);

      setLeads(extractItems(leadsResponse));

      setUsers(
        extractItems(usersResponse).filter(
          (user) =>
            user.role === "user" && isActiveUser(user),
        ),
      );
    } catch (err: unknown) {
      setOptionsError(
        getErrorMessage(
          err,
          "Unable to load leads and employees.",
        ),
      );
    } finally {
      setOptionsLoading(false);
    }
  }

  /* =========================
     CREATE MODAL
  ========================= */

  async function openCreateModal() {
    setEditingFollowUp(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setOptionsError("");
    setSuccessMessage("");
    setIsModalOpen(true);

    await loadFormOptions();
  }

  /* =========================
     EDIT MODAL
  ========================= */

  async function openEditModal(followUp: FollowUp) {
    setEditingFollowUp(followUp);
    setFormError("");
    setOptionsError("");
    setSuccessMessage("");

    setForm({
      leadId:
        typeof followUp.leadId === "string"
          ? followUp.leadId
          : followUp.leadId._id,
      ownerId:
        typeof followUp.ownerId === "string"
          ? followUp.ownerId
          : followUp.ownerId._id,
      type: followUp.type,
      purpose: followUp.purpose || "",
      notes: followUp.notes || "",
      dueAt: toDateTimeLocal(followUp.dueAt),
      reminderAt: toDateTimeLocal(followUp.reminderAt),
      recurrenceFrequency:
        followUp.recurrence?.frequency || "",
      recurrenceEndAt: toDateTimeLocal(
        followUp.recurrence?.endAt,
      ),
    });

    setIsModalOpen(true);

    await loadFormOptions();
  }

  function closeModal() {
    if (saving) return;

    setIsModalOpen(false);
    setEditingFollowUp(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setOptionsError("");
  }

  function updateForm<K extends keyof FollowUpForm>(
    field: K,
    value: FollowUpForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  /* =========================
     SAVE FOLLOW-UP
  ========================= */

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError("");
    setSuccessMessage("");

    if (optionsLoading) {
      setFormError("Please wait while form options are loading.");
      return;
    }

    if (optionsError) {
      setFormError("Unable to load form options. Please try again.");
      return;
    }

    if (!form.leadId) {
      setFormError("Please select a lead.");
      return;
    }

    if (!form.ownerId) {
      setFormError("Please select an employee.");
      return;
    }

    if (!form.purpose.trim()) {
      setFormError("Please enter the follow-up purpose.");
      return;
    }

    if (form.purpose.trim().length < 2) {
      setFormError("Purpose must contain at least 2 characters.");
      return;
    }

    if (!form.dueAt) {
      setFormError("Please select the follow-up date and time.");
      return;
    }

    const dueDate = new Date(form.dueAt);

    if (Number.isNaN(dueDate.getTime())) {
      setFormError("Please select a valid due date.");
      return;
    }

    let reminderAt: string | null = null;

    if (form.reminderAt) {
      const reminderDate = new Date(form.reminderAt);

      if (Number.isNaN(reminderDate.getTime())) {
        setFormError("Please select a valid reminder date.");
        return;
      }

      if (reminderDate > dueDate) {
        setFormError(
          "Reminder date and time cannot be later than the due date.",
        );
        return;
      }

      reminderAt = reminderDate.toISOString();
    }

    let recurrence: FollowUpRecurrence | null = null;

    if (form.recurrenceFrequency) {
      let recurrenceEndAt: string | null = null;

      if (form.recurrenceEndAt) {
        const endDate = new Date(form.recurrenceEndAt);

        if (Number.isNaN(endDate.getTime())) {
          setFormError("Please select a valid recurrence end date.");
          return;
        }

        if (endDate <= dueDate) {
          setFormError(
            "Recurrence end date must be later than the first due date.",
          );
          return;
        }

        recurrenceEndAt = endDate.toISOString();
      }

      recurrence = {
        frequency: form.recurrenceFrequency,
        endAt: recurrenceEndAt,
      };
    }

    const payload = {
      leadId: form.leadId,
      ownerId: form.ownerId,
      type: form.type,
      purpose: form.purpose.trim(),
      notes: form.notes.trim(),
      dueAt: dueDate.toISOString(),
      reminderAt,
      recurrence,
    };

    setSaving(true);

    try {
      if (editingFollowUp) {
        await apiPatch<SingleFollowUpResponse>(
          `/follow-ups/${editingFollowUp._id}`,
          {
            ownerId: payload.ownerId,
            type: payload.type,
            purpose: payload.purpose,
            notes: payload.notes,
            dueAt: payload.dueAt,
            reminderAt: payload.reminderAt,
            recurrence: payload.recurrence,
          },
        );

        setSuccessMessage("Follow-up updated successfully.");
      } else {
        await apiPost<SingleFollowUpResponse>(
          "/follow-ups",
          payload,
        );

        setSuccessMessage("Follow-up created successfully.");
      }

      setIsModalOpen(false);
      setEditingFollowUp(null);
      setForm(EMPTY_FORM);

      setPagination((current) => ({
        ...current,
        page: 1,
      }));

      setRefreshKey((current) => current + 1);
    } catch (err: unknown) {
      setFormError(
        getErrorMessage(err, "Unable to save the follow-up."),
      );
    } finally {
      setSaving(false);
    }
  }

  /* =========================
     UPDATE STATUS
  ========================= */

  async function updateStatus(
    followUp: FollowUp,
    status: FollowUpStatus,
  ) {
    const action =
      status === "completed"
        ? "complete"
        : status === "cancelled"
          ? "cancel"
          : "update";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} this follow-up?`,
    );

    if (!confirmed) return;

    setActionLoadingId(followUp._id);
    setError("");
    setSuccessMessage("");

    try {
      const response = await apiPatch<SingleFollowUpResponse>(
        `/follow-ups/${followUp._id}/status`,
        { status },
      );

      setSuccessMessage(
        response.message ||
          `Follow-up ${status} successfully.`,
      );

      setRefreshKey((current) => current + 1);
    } catch (err: unknown) {
      setError(
        getErrorMessage(err, "Unable to update follow-up status."),
      );
    } finally {
      setActionLoadingId("");
    }
  }

  /* =========================
     SNOOZE FOLLOW-UP
  ========================= */

  function openSnoozeModal(followUp: FollowUp) {
    setSnoozeFollowUp(followUp);
    setSnoozeDuration("one_hour");
    setCustomSnoozeDueAt("");
    setSnoozeError("");
    setError("");
    setSuccessMessage("");
  }

  function closeSnoozeModal() {
    if (snoozeLoading) return;

    setSnoozeFollowUp(null);
    setSnoozeDuration("one_hour");
    setCustomSnoozeDueAt("");
    setSnoozeError("");
  }

  async function handleSnooze() {
    if (!snoozeFollowUp) return;

    setSnoozeError("");

    let payload:
      | { duration: Exclude<SnoozeDuration, "custom"> }
      | { duration: "custom"; customDueAt: string };

    if (snoozeDuration === "custom") {
      if (!customSnoozeDueAt) {
        setSnoozeError("Please select a new date and time.");
        return;
      }

      const customDate = new Date(customSnoozeDueAt);

      if (
        Number.isNaN(customDate.getTime()) ||
        customDate <= new Date()
      ) {
        setSnoozeError(
          "The snooze date and time must be in the future.",
        );
        return;
      }

      payload = {
        duration: "custom",
        customDueAt: customDate.toISOString(),
      };
    } else {
      payload = {
        duration: snoozeDuration,
      };
    }

    setSnoozeLoading(true);
    setActionLoadingId(snoozeFollowUp._id);
    setError("");
    setSuccessMessage("");

    try {
      const response = await apiPatch<SingleFollowUpResponse>(
        `/follow-ups/${snoozeFollowUp._id}/snooze`,
        payload,
      );

      setSuccessMessage(
        response.message || "Follow-up snoozed successfully.",
      );

      setSnoozeFollowUp(null);
      setSnoozeDuration("one_hour");
      setCustomSnoozeDueAt("");

      setRefreshKey((current) => current + 1);
    } catch (err: unknown) {
      setSnoozeError(
        getErrorMessage(err, "Unable to snooze this follow-up."),
      );
    } finally {
      setSnoozeLoading(false);
      setActionLoadingId("");
    }
  }

  /* =========================
     SUMMARY VALUES
  ========================= */

  const pendingCount = followUps.filter(
    (item) => item.status === "pending",
  ).length;

  const overdueCount = followUps.filter(isOverdue).length;

  const completedCount = followUps.filter(
    (item) => item.status === "completed",
  ).length;

  const startItem =
    pagination.total === 0
      ? 0
      : (pagination.page - 1) * pagination.limit + 1;

  const endItem = Math.min(
    pagination.page * pagination.limit,
    pagination.total,
  );

  /* =========================
     PAGE UI
  ========================= */

  return (
    <div className="w-full min-w-0 space-y-6 p-4 sm:p-6 lg:p-8">

      {/* PAGE HEADING */}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
            <Link
              href="/"
              className="transition hover:text-primary"
            >
              Dashboard
            </Link>

            <span>/</span>

            <span className="text-gray-800">Follow-ups</span>
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Follow-up Management
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            Schedule follow-ups, manage reminders, and track
            customer communication.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            disabled={loading}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
          >
            <span aria-hidden="true">↻</span>
            Refresh
          </button>

          <button
            type="button"
            onClick={() => void openCreateModal()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
          >
            <span className="text-lg leading-none">+</span>
            Add Follow-up
          </button>
        </div>
      </div>

      {/* SUCCESS MESSAGE */}

      {successMessage && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800"
        >
          {successMessage}
        </div>
      )}

      {/* ERROR MESSAGE */}

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {/* SUMMARY CARDS */}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="Total Follow-ups"
          value={loading ? "—" : String(pagination.total)}
          description="Matching records across all pages"
        />

        <SummaryCard
          title="Pending"
          value={loading ? "—" : String(pendingCount)}
          description="Pending on the current page"
        />

        <SummaryCard
          title="Overdue"
          value={loading ? "—" : String(overdueCount)}
          description="Overdue on the current page"
          danger
        />

        <SummaryCard
          title="Completed"
          value={loading ? "—" : String(completedCount)}
          description="Completed on the current page"
        />
      </div>

      {/* FOLLOW-UPS TABLE */}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">

        {/* TABLE HEADING AND FILTERS */}

        <div className="border-b border-gray-200 p-4 sm:p-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                All Follow-ups
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                View scheduled follow-ups and their current status.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input
                type="search"
                value={searchInput}
                onChange={(event) =>
                  handleSearchChange(event.target.value)
                }
                placeholder="Search purpose or lead..."
                aria-label="Search follow-ups"
                className="min-h-11 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
              />

              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by status"
                className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-primary"
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="missed">Missed</option>
              </select>

              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter by type"
                className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-primary"
              >
                <option value="">All types</option>

                {FOLLOW_UP_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select
                value={overdueFilter}
                onChange={(event) => {
                  setOverdueFilter(event.target.value);
                  resetPage();
                }}
                aria-label="Filter overdue follow-ups"
                className="min-h-11 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-700 outline-none focus:border-primary"
              >
                <option value="">All due dates</option>
                <option value="true">Overdue only</option>
                <option value="false">Not overdue</option>
              </select>
            </div>
          </div>
        </div>

        {/* TABLE */}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-4 font-semibold">Lead</th>
                <th className="px-5 py-4 font-semibold">Type</th>
                <th className="px-5 py-4 font-semibold">Purpose</th>
                <th className="px-5 py-4 font-semibold">Assigned To</th>
                <th className="px-5 py-4 font-semibold">Due Date</th>
                <th className="px-5 py-4 font-semibold">Repeat</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center text-gray-500"
                  >
                    Loading follow-ups...
                  </td>
                </tr>
              ) : followUps.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center"
                  >
                    <p className="font-semibold text-gray-700">
                      No follow-ups found
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      Create a follow-up or change your filters.
                    </p>
                  </td>
                </tr>
              ) : (
                followUps.map((item) => {
                  const overdue = isOverdue(item);

                  return (
                    <tr
                      key={item._id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">
                          {getLeadName(item.leadId)}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {getLeadCompany(item.leadId) || "—"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-gray-700">
                        {getTypeLabel(item.type)}
                      </td>

                      <td className="max-w-[220px] px-5 py-4">
                        <p
                          className="truncate font-medium text-gray-800"
                          title={item.purpose}
                        >
                          {item.purpose}
                        </p>

                        {item.notes && (
                          <p
                            className="mt-1 truncate text-xs text-gray-500"
                            title={item.notes}
                          >
                            {item.notes}
                          </p>
                        )}
                      </td>

                      <td className="px-5 py-4 text-gray-700">
                        {getUserName(item.ownerId)}
                      </td>

                      <td className="px-5 py-4">
                        <p
                          className={
                            overdue
                              ? "font-semibold text-red-600"
                              : "text-gray-700"
                          }
                        >
                          {formatDate(item.dueAt)}
                        </p>

                        <p className="mt-1 text-xs text-gray-500">
                          {new Date(item.dueAt).toLocaleTimeString(
                            "en-IN",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>

                        {overdue && (
                          <span className="mt-1 inline-block text-xs font-semibold text-red-600">
                            Overdue
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {item.recurrence ? (
                          <div>
                            <span className="inline-flex rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                              {getRecurrenceLabel(item.recurrence)}
                            </span>

                            {item.recurrence.endAt && (
                              <p className="mt-1 text-xs text-gray-500">
                                Until {formatDate(item.recurrence.endAt)}
                              </p>
                            )}

                            {item.recurrenceOccurrence && (
                              <p className="mt-1 text-xs text-gray-400">
                                Occurrence {item.recurrenceOccurrence}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">
                            Does not repeat
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <StatusBadge
                          status={item.status}
                          overdue={overdue}
                        />
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-wrap justify-end gap-2">
                          {item.status === "pending" && (
                            <>
                              <button
                                type="button"
                                disabled={actionLoadingId === item._id}
                                onClick={() =>
                                  void openEditModal(item)
                                }
                                className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                disabled={actionLoadingId === item._id}
                                onClick={() => openSnoozeModal(item)}
                                className="rounded-md bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                              >
                                Snooze
                              </button>

                              <button
                                type="button"
                                disabled={actionLoadingId === item._id}
                                onClick={() =>
                                  void updateStatus(item, "completed")
                                }
                                className="rounded-md bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition hover:bg-green-100 disabled:opacity-50"
                              >
                                {actionLoadingId === item._id
                                  ? "Updating..."
                                  : "Complete"}
                              </button>

                              <button
                                type="button"
                                disabled={actionLoadingId === item._id}
                                onClick={() =>
                                  void updateStatus(item, "cancelled")
                                }
                                className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {item.status !== "pending" && (
                            <span className="text-xs text-gray-400">
                              No actions available
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}

        <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-gray-500">
            Showing{" "}
            <span className="font-semibold text-gray-800">
              {startItem}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-gray-800">
              {endItem}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-gray-800">
              {pagination.total}
            </span>{" "}
            follow-ups
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                goToPage(Math.max(1, pagination.page - 1))
              }
              disabled={pagination.page <= 1 || loading}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="px-2 text-sm text-gray-600">
              Page {pagination.page} of{" "}
              {Math.max(1, pagination.totalPages)}
            </span>

            <button
              type="button"
              onClick={() =>
                goToPage(
                  Math.min(
                    pagination.totalPages,
                    pagination.page + 1,
                  ),
                )
              }
              disabled={
                pagination.page >= pagination.totalPages ||
                loading ||
                pagination.totalPages === 0
              }
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ==================================
          CREATE / EDIT FOLLOW-UP MODAL
      ================================== */}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-gray-900/60 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div className="my-auto flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl">

            {/* MODAL HEADER */}

            <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-5 py-5 sm:px-8">
              <div>
                <div className="mb-2 inline-flex rounded-lg bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  FOLLOW-UP MANAGEMENT
                </div>

                <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
                  {editingFollowUp
                    ? "Edit Follow-up"
                    : "Create Follow-up"}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {editingFollowUp
                    ? "Update the scheduled customer communication."
                    : "Schedule and assign your next customer communication."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close modal"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xl text-gray-500 transition hover:bg-gray-200 hover:text-gray-900 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={handleSave}
              className="flex min-h-0 flex-1 flex-col"
            >

              {/* MODAL CONTENT */}

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-gray-50/60 px-5 py-6 sm:px-8">

                {/* FORM ERRORS */}

                {formError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {formError}
                  </div>
                )}

                {optionsError && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  >
                    {optionsError}
                  </div>
                )}

                {optionsLoading && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                    Loading leads and employees...
                  </div>
                )}

                {/* SECTION 1: LEAD & ASSIGNMENT */}

                <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-sm font-bold text-blue-700">
                        01
                      </span>

                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          Lead & Assignment
                        </h3>

                        <p className="mt-0.5 text-xs text-gray-500">
                          Select the customer and responsible employee.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                    <FormField label="Select Lead" required>
                      <select
                        value={form.leadId}
                        onChange={(event) =>
                          updateForm("leadId", event.target.value)
                        }
                        disabled={optionsLoading || !!editingFollowUp}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-gray-100"
                      >
                        <option value="">Choose a lead</option>

                        {leads.map((lead) => (
                          <option key={lead._id} value={lead._id}>
                            {lead.name}
                            {lead.company ? ` — ${lead.company}` : ""}
                          </option>
                        ))}

                        {editingFollowUp &&
                          (() => {
                            const currentLead =
                              typeof editingFollowUp.leadId === "string"
                                ? null
                                : editingFollowUp.leadId;

                            const currentLeadId =
                              typeof editingFollowUp.leadId === "string"
                                ? editingFollowUp.leadId
                                : editingFollowUp.leadId._id;

                            return (
                              !leads.some(
                                (lead) => lead._id === currentLeadId,
                              ) && (
                                <option value={currentLeadId}>
                                  {currentLead?.name || "Current lead"}
                                </option>
                              )
                            );
                          })()}
                      </select>

                      {editingFollowUp && (
                        <p className="mt-2 text-xs text-gray-400">
                          The lead cannot be changed while editing.
                        </p>
                      )}
                    </FormField>

                    <FormField label="Assign Employee" required>
                      <select
                        value={form.ownerId}
                        onChange={(event) =>
                          updateForm("ownerId", event.target.value)
                        }
                        disabled={optionsLoading}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-gray-100"
                      >
                        <option value="">Choose an employee</option>

                        {users.map((user) => (
                          <option key={user._id} value={user._id}>
                            {user.fullName || user.email}
                          </option>
                        ))}

                        {editingFollowUp &&
                          (() => {
                            const currentOwnerId =
                              typeof editingFollowUp.ownerId === "string"
                                ? editingFollowUp.ownerId
                                : editingFollowUp.ownerId._id;

                            return (
                              !users.some(
                                (user) => user._id === currentOwnerId,
                              ) && (
                                <option value={currentOwnerId}>
                                  {getUserName(editingFollowUp.ownerId)}
                                </option>
                              )
                            );
                          })()}
                      </select>
                    </FormField>

                  </div>
                </section>

                {/* SECTION 2: FOLLOW-UP DETAILS */}

                <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50 text-sm font-bold text-purple-700">
                        02
                      </span>

                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          Follow-up Details
                        </h3>

                        <p className="mt-0.5 text-xs text-gray-500">
                          Define the communication type and purpose.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                    <FormField label="Follow-up Type" required>
                      <select
                        value={form.type}
                        onChange={(event) =>
                          updateForm(
                            "type",
                            event.target.value as FollowUpType,
                          )
                        }
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                      >
                        {FOLLOW_UP_TYPES.map((item) => (
                          <option
                            key={item.value}
                            value={item.value}
                          >
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Purpose" required>
                      <input
                        type="text"
                        value={form.purpose}
                        onChange={(event) =>
                          updateForm("purpose", event.target.value)
                        }
                        maxLength={300}
                        placeholder="e.g. Discuss product pricing"
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </FormField>

                  </div>
                </section>

                {/* SECTION 3: SCHEDULE & REMINDER */}

                <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 text-sm font-bold text-green-700">
                        03
                      </span>

                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          Schedule & Reminder
                        </h3>

                        <p className="mt-0.5 text-xs text-gray-500">
                          Choose when the follow-up should happen.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

                    <FormField label="Due Date & Time" required>
                      <input
                        type="datetime-local"
                        value={form.dueAt}
                        onChange={(event) =>
                          updateForm("dueAt", event.target.value)
                        }
                        className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />
                    </FormField>

                    <FormField label="Reminder Date & Time">
                      <input
                        type="datetime-local"
                        value={form.reminderAt}
                        onChange={(event) =>
                          updateForm("reminderAt", event.target.value)
                        }
                        className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                      />

                      <p className="mt-2 text-xs text-gray-400">
                        Optional. Reminder must be before or at the due time.
                      </p>
                    </FormField>

                  </div>

                  {/* RECURRENCE SETTINGS */}

                  <div className="mt-6 border-t border-gray-100 pt-5">
                    <div className="mb-4">
                      <h4 className="text-sm font-bold text-gray-900">
                        Recurring Follow-up
                      </h4>

                      <p className="mt-1 text-xs text-gray-500">
                        Automatically create the next follow-up when this
                        one is completed.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                      <FormField label="Repeat">
                        <select
                          value={form.recurrenceFrequency}
                          onChange={(event) => {
                            updateForm(
                              "recurrenceFrequency",
                              event.target.value as
                                | ""
                                | RecurrenceFrequency,
                            );

                            if (!event.target.value) {
                              updateForm("recurrenceEndAt", "");
                            }
                          }}
                          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                        >
                          <option value="">Does not repeat</option>
                          <option value="weekly">Every week</option>
                          <option value="monthly">Every month</option>
                        </select>
                      </FormField>

                      {form.recurrenceFrequency && (
                        <FormField label="Recurrence End Date">
                          <input
                            type="datetime-local"
                            value={form.recurrenceEndAt}
                            onChange={(event) =>
                              updateForm(
                                "recurrenceEndAt",
                                event.target.value,
                              )
                            }
                            className="w-full min-w-0 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10"
                          />

                          <p className="mt-2 text-xs text-gray-400">
                            Optional. Leave empty to continue repeating
                            without a specified end date.
                          </p>
                        </FormField>
                      )}
                    </div>

                    {form.recurrenceFrequency && (
                      <div className="mt-4 rounded-lg border border-purple-100 bg-purple-50 p-3 text-sm text-purple-800">
                        {form.recurrenceFrequency === "weekly"
                          ? "A new follow-up will be created every week after the previous one is completed."
                          : "A new follow-up will be created every month after the previous one is completed."}
                      </div>
                    )}
                  </div>
                </section>

                {/* SECTION 4: ADDITIONAL INFORMATION */}

                <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="mb-5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-sm font-bold text-orange-700">
                        04
                      </span>

                      <div>
                        <h3 className="text-base font-bold text-gray-900">
                          Additional Information
                        </h3>

                        <p className="mt-0.5 text-xs text-gray-500">
                          Add discussion points or other important information.
                        </p>
                      </div>
                    </div>
                  </div>

                  <FormField label="Notes">
                    <textarea
                      value={form.notes}
                      onChange={(event) =>
                        updateForm("notes", event.target.value)
                      }
                      rows={4}
                      maxLength={2000}
                      placeholder="Write customer requirements, discussion points, or additional details..."
                      className="w-full resize-y rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/10"
                    />

                    <p className="mt-2 text-right text-xs text-gray-400">
                      {form.notes.length}/2000 characters
                    </p>
                  </FormField>
                </section>

              </div>

              {/* MODAL FOOTER */}

              <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-gray-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-8">

                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="min-h-11 rounded-lg border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || optionsLoading}
                  className="min-h-11 rounded-lg bg-primary px-7 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingFollowUp
                      ? "Update Follow-up"
                      : "Create Follow-up"}
                </button>

              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================
          SNOOZE FOLLOW-UP MODAL
      ================================== */}

      {snoozeFollowUp && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-gray-900/60 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeSnoozeModal();
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl">

            {/* MODAL HEADER */}

            <div className="mb-5">
              <div className="mb-3 inline-flex rounded-lg bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                FOLLOW-UP MANAGEMENT
              </div>

              <h2 className="text-xl font-bold text-gray-900">
                Snooze Follow-up
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Choose when you want to reschedule this follow-up.
              </p>

              <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm font-semibold text-gray-800">
                {snoozeFollowUp.purpose}
              </p>
            </div>

            {/* SNOOZE ERROR */}

            {snoozeError && (
              <div
                role="alert"
                className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {snoozeError}
              </div>
            )}

            {/* SNOOZE OPTIONS */}

            <div className="space-y-4">
              <FormField label="Snooze Duration" required>
                <select
                  value={snoozeDuration}
                  onChange={(event) => {
                    setSnoozeDuration(
                      event.target.value as SnoozeDuration,
                    );
                    setSnoozeError("");
                  }}
                  disabled={snoozeLoading}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-gray-100"
                >
                  <option value="one_hour">1 hour</option>
                  <option value="tomorrow">
                    Tomorrow (same time)
                  </option>
                  <option value="next_week">
                    Next week (same day and time)
                  </option>
                  <option value="custom">
                    Custom date and time
                  </option>
                </select>
              </FormField>

              {snoozeDuration === "custom" && (
                <FormField label="New Due Date & Time" required>
                  <input
                    type="datetime-local"
                    value={customSnoozeDueAt}
                    onChange={(event) => {
                      setCustomSnoozeDueAt(event.target.value);
                      setSnoozeError("");
                    }}
                    min={toDateTimeLocal(new Date().toISOString())}
                    disabled={snoozeLoading}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-gray-100"
                  />

                  <p className="mt-2 text-xs text-gray-400">
                    Select a future date and time for this follow-up.
                  </p>
                </FormField>
              )}
            </div>

            {/* MODAL FOOTER */}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeSnoozeModal}
                disabled={snoozeLoading}
                className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleSnooze()}
                disabled={snoozeLoading}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {snoozeLoading ? "Snoozing..." : "Confirm Snooze"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   REUSABLE COMPONENTS
========================= */

function SummaryCard({
  title,
  value,
  description,
  danger = false,
}: {
  title: string;
  value: string;
  description: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{title}</p>

      <p
        className={`mt-2 text-3xl font-bold ${
          danger ? "text-red-600" : "text-gray-900"
        }`}
      >
        {value}
      </p>

      <p className="mt-2 text-xs text-gray-500">{description}</p>
    </div>
  );
}

function StatusBadge({
  status,
  overdue,
}: {
  status: FollowUpStatus;
  overdue: boolean;
}) {
  let className = "bg-gray-100 text-gray-700";

  if (status === "completed") {
    className = "bg-green-100 text-green-700";
  } else if (status === "cancelled") {
    className = "bg-gray-100 text-gray-600";
  } else if (status === "missed") {
    className = "bg-orange-100 text-orange-700";
  } else if (overdue) {
    className = "bg-red-100 text-red-700";
  } else if (status === "pending") {
    className = "bg-blue-100 text-blue-700";
  }

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${className}`}
    >
      {overdue ? "Overdue" : getStatusLabel(status)}
    </span>
  );
}

function FormField({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-2 block text-sm font-semibold text-gray-700">
        {label}

        {required && <span className="ml-1 text-red-500">*</span>}
      </label>

      {children}
    </div>
  );
}