"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, RefreshCw, Save } from "lucide-react";
import { apiGet, apiPatch, ApiError } from "@/lib/api";

interface Lead {
  _id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  ownerId?: { _id?: string } | string | null;
  statusId?: { _id?: string } | string | null;
  sourceId?: { _id?: string } | string | null;
}

interface LeadOption {
  _id: string;
  name?: string;
  fullName?: string;
  email?: string;
  role?: string;
  status?: string;
  isActive?: boolean;
  color?: string;
  type?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
}

interface OptionsResponse {
  users?: LeadOption[];
  configurations?: LeadOption[];
  items?: LeadOption[];
  results?: LeadOption[];
}

interface EditForm {
  name: string;
  company: string;
  email: string;
  phone: string;
  ownerId: string;
  statusId: string;
  sourceId: string;
}

const EMPTY_FORM: EditForm = {
  name: "",
  company: "",
  email: "",
  phone: "",
  ownerId: "",
  statusId: "",
  sourceId: "",
};

function getId(
  value: { _id?: string } | string | null | undefined,
): string {
  if (!value) return "";
  return typeof value === "string" ? value : value._id || "";
}

function extractOptions(
  response: ApiResponse<OptionsResponse | LeadOption[]>,
): LeadOption[] {
  const data = response.data;

  if (Array.isArray(data)) {
    return data;
  }

  if (!data) {
    return [];
  }

  return data.users || data.configurations || data.items || data.results || [];
}

function isActive(option: LeadOption): boolean {
  if (option.isActive === false) {
    return false;
  }

  const inactiveStatuses = [
    "inactive",
    "deactivated",
    "deleted",
    "suspended",
    "pending_deletion",
  ];

  if (
    option.status &&
    inactiveStatuses.includes(option.status.toLowerCase())
  ) {
    return false;
  }

  return true;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return err.message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return fallback;
}

function inputClass(): string {
  return "mt-1.5 min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100";
}

export default function EditLeadPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const leadId = params.id;

  const [form, setForm] = useState<EditForm>(EMPTY_FORM);

  const [users, setUsers] = useState<LeadOption[]>([]);
  const [statuses, setStatuses] = useState<LeadOption[]>([]);
  const [sources, setSources] = useState<LeadOption[]>([]);

  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [optionsError, setOptionsError] = useState("");

  // Load the existing lead.
  const loadLead = useCallback(async () => {
    if (!leadId) {
      setError("Lead ID is missing.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await apiGet<ApiResponse<{ lead: Lead }>>(
        `/leads/${leadId}`
      );

      const lead = response.data?.lead;

      if (!lead) {
        throw new Error("Lead details were not returned by the server.");
      }

      setForm({
        name: lead.name || "",
        company: lead.company || "",
        email: lead.email || "",
        phone: lead.phone || "",
        ownerId: getId(lead.ownerId),
        statusId: getId(lead.statusId),
        sourceId: getId(lead.sourceId),
      });
    } catch (err) {
      setError(getErrorMessage(err, "Unable to load the lead."));
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  // Load active users, statuses, and sources.
  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    setOptionsError("");

    try {
      const [usersResponse, statusesResponse, sourcesResponse] =
        await Promise.all([
          apiGet<ApiResponse<OptionsResponse | LeadOption[]>>(
            "/admin/users?page=1&limit=100"
          ),
          apiGet<ApiResponse<OptionsResponse | LeadOption[]>>(
            "/admin/lead-configurations?type=status&page=1&limit=100"
          ),
          apiGet<ApiResponse<OptionsResponse | LeadOption[]>>(
            "/admin/lead-configurations?type=source&page=1&limit=100"
          ),
        ]);

      const activeUsers = extractOptions(usersResponse).filter(
        (user) => isActive(user) && user.role === "user"
      );

      const activeStatuses = extractOptions(statusesResponse).filter(isActive);
      const activeSources = extractOptions(sourcesResponse).filter(isActive);

      setUsers(activeUsers);
      setStatuses(activeStatuses);
      setSources(activeSources);
    } catch (err) {
      setOptionsError(
        getErrorMessage(
          err,
          "Unable to load users, statuses, and sources."
        )
      );
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLead();
    void loadOptions();
  }, [loadLead, loadOptions]);

  function updateField<K extends keyof EditForm>(
    field: K,
    value: EditForm[K]
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!leadId) {
      setError("Lead ID is missing.");
      return;
    }

    if (optionsLoading) {
      setError("Please wait while dropdown options are loading.");
      return;
    }

    if (optionsError) {
      setError("Please reload the dropdown options before saving.");
      return;
    }

    if (!form.name.trim()) {
      setError("Please enter the lead name.");
      return;
    }

    if (!form.statusId) {
      setError("Please select a lead status.");
      return;
    }

    if (!statuses.some((status) => status._id === form.statusId)) {
      setError("Please select an available active lead status.");
      return;
    }

    if (
      form.sourceId &&
      !sources.some((source) => source._id === form.sourceId)
    ) {
      setError("Please select an available active lead source.");
      return;
    }

    if (
      form.ownerId &&
      !users.some((user) => user._id === form.ownerId)
    ) {
      setError("Please select an available active user for assignment.");
      return;
    }

    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      setError("Please enter a valid email address.");
      return;
    }

    const payload = {
      name: form.name.trim(),
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      statusId: form.statusId,
      sourceId: form.sourceId || null,
      ownerId: form.ownerId || null,
    };

    setSaving(true);

    try {
      await apiPatch<ApiResponse<{ lead: Lead }>>(
        `/leads/${leadId}`,
        payload
      );

      router.push(`/leads/${leadId}`);
      router.refresh();
    } catch (err) {
      setError(getErrorMessage(err, "Unable to update the lead."));
    } finally {
      setSaving(false);
    }
  }

  // Initial loading screen.
  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-blue-600" />
        <span className="ml-3 text-sm text-gray-500">
          Loading lead information...
        </span>
      </div>
    );
  }

  // Show an error if the lead could not be loaded.
  if (error && !form.name && !form.statusId && !saving) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        <Link
          href="/leads"
          className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={18} />
          Back to Leads
        </Link>

        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700"
        >
          <p className="font-semibold">Unable to open this lead.</p>
          <p className="mt-1">{error}</p>

          <button
            type="button"
            onClick={() => void loadLead()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700"
          >
            <RefreshCw size={16} />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const canSave =
    !saving &&
    !optionsLoading &&
    !optionsError &&
    statuses.length > 0 &&
    Boolean(form.statusId);

  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
      <Link
        href={`/leads/${leadId}`}
        className="mb-5 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
      >
        <ArrowLeft size={18} />
        Back to Lead Details
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
          Edit Lead
        </h1>

        <p className="mt-2 text-sm text-gray-500">
          Update contact information, status, source, and assignment.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {optionsError && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          <p className="font-semibold">
            Dropdown options could not be loaded.
          </p>

          <p className="mt-1">{optionsError}</p>

          <button
            type="button"
            onClick={() => void loadOptions()}
            disabled={optionsLoading}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 font-semibold hover:bg-amber-100 disabled:opacity-60"
          >
            {optionsLoading ? (
              <LoaderCircle size={16} className="animate-spin" />
            ) : (
              <RefreshCw size={16} />
            )}
            Retry Loading Options
          </button>
        </div>
      )}

      {optionsLoading && (
        <div className="mb-5 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
          <LoaderCircle size={18} className="animate-spin" />
          Loading active users, lead statuses, and lead sources...
        </div>
      )}

      {!optionsLoading && !optionsError && statuses.length === 0 && (
        <div
          role="alert"
          className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
        >
          <p className="font-semibold">No active lead statuses found.</p>
          <p className="mt-1">
            Add or activate a lead status in Lead Configurations before
            updating this lead.
          </p>

          <Link
            href="/lead-configurations"
            className="mt-3 inline-block font-semibold underline"
          >
            Open Lead Configurations
          </Link>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        {/* Contact Information */}
        <div className="border-b border-gray-100 p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-gray-900">
            Contact Information
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Enter the lead&apos;s contact details.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label
                htmlFor="edit-lead-name"
                className="block text-sm font-medium text-gray-700"
              >
                Lead Name <span className="text-red-500">*</span>
              </label>

              <input
                id="edit-lead-name"
                required
                maxLength={150}
                value={form.name}
                onChange={(event) => updateField("name", event.target.value)}
                className={inputClass()}
                placeholder="Enter lead name"
              />
            </div>

            <div>
              <label
                htmlFor="edit-lead-company"
                className="block text-sm font-medium text-gray-700"
              >
                Company
              </label>

              <input
                id="edit-lead-company"
                maxLength={200}
                value={form.company}
                onChange={(event) =>
                  updateField("company", event.target.value)
                }
                className={inputClass()}
                placeholder="Enter company name"
              />
            </div>

            <div>
              <label
                htmlFor="edit-lead-email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>

              <input
                id="edit-lead-email"
                type="email"
                value={form.email}
                onChange={(event) => updateField("email", event.target.value)}
                className={inputClass()}
                placeholder="name@example.com"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="edit-lead-phone"
                className="block text-sm font-medium text-gray-700"
              >
                Phone
              </label>

              <input
                id="edit-lead-phone"
                type="tel"
                value={form.phone}
                onChange={(event) => updateField("phone", event.target.value)}
                className={inputClass()}
                placeholder="Enter phone number"
              />
            </div>
          </div>
        </div>

        {/* Assignment Details */}
        <div className="p-5 sm:p-7">
          <h2 className="text-lg font-semibold text-gray-900">
            Assignment Details
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Change the lead&apos;s status, source, or assigned user.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="edit-lead-status"
                className="block text-sm font-medium text-gray-700"
              >
                Lead Status <span className="text-red-500">*</span>
              </label>

              <select
                id="edit-lead-status"
                required
                disabled={
                  optionsLoading ||
                  Boolean(optionsError) ||
                  statuses.length === 0
                }
                value={form.statusId}
                onChange={(event) =>
                  updateField("statusId", event.target.value)
                }
                className={inputClass()}
              >
                <option value="">Select status</option>

                {statuses.map((status) => (
                  <option key={status._id} value={status._id}>
                    {status.name || "Unnamed status"}
                  </option>
                ))}
              </select>

              {statuses.length === 0 && !optionsLoading && !optionsError && (
                <p className="mt-1.5 text-xs text-amber-700">
                  No active statuses are available.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="edit-lead-source"
                className="block text-sm font-medium text-gray-700"
              >
                Lead Source
              </label>

              <select
                id="edit-lead-source"
                disabled={optionsLoading || Boolean(optionsError)}
                value={form.sourceId}
                onChange={(event) =>
                  updateField("sourceId", event.target.value)
                }
                className={inputClass()}
              >
                <option value="">No source</option>

                {sources.map((source) => (
                  <option key={source._id} value={source._id}>
                    {source.name || "Unnamed source"}
                  </option>
                ))}
              </select>

              {sources.length === 0 && !optionsLoading && !optionsError && (
                <p className="mt-1.5 text-xs text-gray-500">
                  No active sources available. You can leave this empty.
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="edit-lead-owner"
                className="block text-sm font-medium text-gray-700"
              >
                Assign To
              </label>

              <select
                id="edit-lead-owner"
                disabled={optionsLoading || Boolean(optionsError)}
                value={form.ownerId}
                onChange={(event) =>
                  updateField("ownerId", event.target.value)
                }
                className={inputClass()}
              >
                <option value="">Unassigned</option>

                {users.map((user) => (
                  <option key={user._id} value={user._id}>
                    {user.fullName || user.email || user._id}
                    {user.fullName && user.email ? ` (${user.email})` : ""}
                  </option>
                ))}
              </select>

              <p className="mt-1.5 text-xs text-gray-500">
                Only active accounts with the user role are listed.
              </p>

              {users.length === 0 && !optionsLoading && !optionsError && (
                <p className="mt-1.5 text-xs text-amber-700">
                  No active users are available for assignment.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col-reverse gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-7">
          <Link
            href={`/leads/${leadId}`}
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={!canSave}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Save size={17} />
            )}

            {saving ? "Saving Changes..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}