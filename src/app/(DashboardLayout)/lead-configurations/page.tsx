"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  apiGet,
  apiPost,
  apiPatch,
  ApiError,
} from "@/lib/api";

import {
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Power,
  X,
  Settings2,
  Tag,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";

type ConfigurationType = "status" | "source";

interface LeadConfiguration {
  _id: string;
  name: string;
  type: ConfigurationType | "lost_reason" | "tag";
  description?: string;
  color?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

interface ConfigurationResponse {
  success: boolean;
  message: string;
  data: {
    configurations: LeadConfiguration[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}

interface SingleConfigurationResponse {
  success: boolean;
  message: string;
  data: {
    configuration: LeadConfiguration;
  };
}

interface ConfigurationForm {
  name: string;
  description: string;
  color: string;
  sortOrder: string;
}

const EMPTY_FORM: ConfigurationForm = {
  name: "",
  description: "",
  color: "#2563eb",
  sortOrder: "0",
};

const TABS: {
  value: ConfigurationType;
  label: string;
}[] = [
  {
    value: "status",
    label: "Lead Statuses",
  },
  {
    value: "source",
    label: "Lead Sources",
  },
];

export default function LeadConfigurationsPage() {
  const [activeTab, setActiveTab] =
    useState<ConfigurationType>("status");

  const [configurations, setConfigurations] = useState<
    LeadConfiguration[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingConfiguration, setEditingConfiguration] =
    useState<LeadConfiguration | null>(null);

  const [form, setForm] =
    useState<ConfigurationForm>(EMPTY_FORM);

  const [formError, setFormError] = useState("");

  const loadConfigurations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const query = new URLSearchParams({
        type: activeTab,
        page: "1",
        limit: "100",
        sortBy: "sortOrder",
        sortOrder: "asc",
      });

      if (search.trim()) {
        query.set("search", search.trim());
      }

      const response =
        await apiGet<ConfigurationResponse>(
          `/admin/lead-configurations?${query.toString()}`,
        );

      setConfigurations(
        response.data?.configurations ?? [],
      );
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Unable to load lead configurations.";

      setError(message);
      setConfigurations([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    void loadConfigurations();
  }, [loadConfigurations]);

  function openCreateModal() {
    setEditingConfiguration(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setModalOpen(true);
  }

  function openEditModal(
    configuration: LeadConfiguration,
  ) {
    setEditingConfiguration(configuration);

    setForm({
      name: configuration.name,
      description: configuration.description ?? "",
      color: configuration.color ?? "#2563eb",
      sortOrder: String(configuration.sortOrder ?? 0),
    });

    setFormError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    setModalOpen(false);
    setEditingConfiguration(null);
    setForm(EMPTY_FORM);
    setFormError("");
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setFormError("");
    setSuccess("");

    const name = form.name.trim();

    if (name.length < 2 || name.length > 100) {
      setFormError(
        "Name must contain between 2 and 100 characters.",
      );
      return;
    }

    if (form.description.trim().length > 500) {
      setFormError(
        "Description cannot exceed 500 characters.",
      );
      return;
    }

    const sortOrder = Number(form.sortOrder);

    if (
      !Number.isInteger(sortOrder) ||
      sortOrder < 0
    ) {
      setFormError(
        "Sort order must be a non-negative integer.",
      );
      return;
    }

    if (
      !/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(
        form.color,
      )
    ) {
      setFormError(
        "Please enter a valid hexadecimal color.",
      );
      return;
    }

    const payload = {
      name,
      description: form.description.trim(),
      color: form.color,
      sortOrder,
    };

    setSaving(true);

    try {
      if (editingConfiguration) {
        await apiPatch<SingleConfigurationResponse>(
          `/admin/lead-configurations/${editingConfiguration._id}`,
          payload,
        );

        setSuccess(
          `${activeTab === "status" ? "Lead status" : "Lead source"} updated successfully.`,
        );
      } else {
        await apiPost<SingleConfigurationResponse>(
          "/admin/lead-configurations",
          {
            ...payload,
            type: activeTab,
          },
        );

        setSuccess(
          `${activeTab === "status" ? "Lead status" : "Lead source"} created successfully.`,
        );
      }

      setModalOpen(false);
      setEditingConfiguration(null);
      setForm(EMPTY_FORM);

      await loadConfigurations();
    } catch (err: unknown) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Unable to save the configuration.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(
    configuration: LeadConfiguration,
  ) {
    const action = configuration.isActive
      ? "deactivate"
      : "reactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} "${configuration.name}"?`,
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      if (configuration.isActive) {
        await apiPatch<SingleConfigurationResponse>(
          `/admin/lead-configurations/${configuration._id}/deactivate`,
        );
      } else {
        await apiPatch<SingleConfigurationResponse>(
          `/admin/lead-configurations/${configuration._id}`,
          {
            isActive: true,
          },
        );
      }

      setSuccess(
        `"${configuration.name}" ${configuration.isActive ? "deactivated" : "reactivated"} successfully.`,
      );

      await loadConfigurations();
    } catch (err: unknown) {
      setError(
        err instanceof ApiError
          ? err.message
          : `Unable to ${action} this configuration.`,
      );
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  function changeTab(type: ConfigurationType) {
    setActiveTab(type);
    setSearch("");
    setSearchInput("");
    setError("");
    setSuccess("");
  }

  const activeCount = configurations.filter(
    (item) => item.isActive,
  ).length;

  const inactiveCount =
    configurations.length - activeCount;

  return (
    <div className="min-h-screen bg-gray-50/70 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        {/* Page heading */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
              <Settings2 size={16} />
              <span>Lead Management</span>
              <span>/</span>
              <span className="text-gray-700">
                Configuration
              </span>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Lead Configuration
            </h1>

            <p className="mt-2 text-sm text-gray-500 sm:text-base">
              Manage the statuses and sources used by your
              lead management system.
            </p>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <Plus size={18} />
            Add{" "}
            {activeTab === "status"
              ? "Status"
              : "Source"}
          </button>
        </div>

        {/* Notifications */}
        {success && (
          <div
            role="status"
            className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            <CheckCircle2
              size={19}
              className="mt-0.5 shrink-0"
            />
            <p className="flex-1">{success}</p>

            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Dismiss success message"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <AlertCircle
              size={19}
              className="mt-0.5 shrink-0"
            />
            <p className="flex-1">{error}</p>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error message"
            >
              <X size={18} />
            </button>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                Total Configurations
              </p>

              <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
                <Tag size={20} />
              </span>
            </div>

            <p className="mt-3 text-3xl font-bold text-gray-900">
              {loading ? "—" : configurations.length}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Current page results
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                Active
              </p>

              <span className="rounded-lg bg-green-50 p-2 text-green-600">
                <CheckCircle2 size={20} />
              </span>
            </div>

            <p className="mt-3 text-3xl font-bold text-gray-900">
              {loading ? "—" : activeCount}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Available configurations
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">
                Inactive
              </p>

              <span className="rounded-lg bg-gray-100 p-2 text-gray-600">
                <Power size={20} />
              </span>
            </div>

            <p className="mt-3 text-3xl font-bold text-gray-900">
              {loading ? "—" : inactiveCount}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              Deactivated configurations
            </p>
          </div>
        </div>

        {/* Main panel */}
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {/* Tabs */}
          <div className="border-b border-gray-200 px-4 sm:px-6">
            <div className="flex gap-6">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => changeTab(tab.value)}
                  className={`relative -mb-px border-b-2 px-1 py-4 text-sm font-semibold transition ${
                    activeTab === tab.value
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Search and refresh */}
          <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <form
              onSubmit={handleSearch}
              className="flex w-full gap-2 sm:max-w-md"
            >
              <div className="relative min-w-0 flex-1">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) =>
                    setSearchInput(event.target.value)
                  }
                  placeholder={`Search ${activeTab === "status" ? "statuses" : "sources"}...`}
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Search
              </button>
            </form>

            <button
              type="button"
              onClick={() => void loadConfigurations()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : ""}
              />
              Refresh
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Name
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Description
                  </th>

                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Color
                  </th>

                  <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Sort Order
                  </th>

                  <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Status
                  </th>

                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center"
                    >
                      <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
                        <LoaderCircle
                          size={20}
                          className="animate-spin"
                        />
                        Loading configurations...
                      </div>
                    </td>
                  </tr>
                ) : configurations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-16 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <div className="rounded-full bg-gray-100 p-4 text-gray-500">
                          <Settings2 size={26} />
                        </div>

                        <h3 className="mt-4 text-base font-semibold text-gray-900">
                          No configurations found
                        </h3>

                        <p className="mt-2 text-sm text-gray-500">
                          {search
                            ? "Try a different search term."
                            : `Add your first ${activeTab === "status" ? "lead status" : "lead source"} to get started.`}
                        </p>

                        {!search && (
                          <button
                            type="button"
                            onClick={openCreateModal}
                            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                          >
                            <Plus size={17} />
                            Add{" "}
                            {activeTab === "status"
                              ? "Status"
                              : "Source"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  configurations.map((configuration) => (
                    <tr
                      key={configuration._id}
                      className="transition hover:bg-gray-50/80"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 shrink-0 rounded-full ring-4 ring-gray-100"
                            style={{
                              backgroundColor:
                                configuration.color || "#2563eb",
                            }}
                          />

                          <span className="font-semibold text-gray-900">
                            {configuration.name}
                          </span>
                        </div>
                      </td>

                      <td className="max-w-xs px-6 py-4 text-sm text-gray-600">
                        <p className="truncate">
                          {configuration.description || "—"}
                        </p>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-5 w-5 rounded border border-gray-200"
                            style={{
                              backgroundColor:
                                configuration.color || "#2563eb",
                            }}
                          />

                          <span className="font-mono text-xs text-gray-600">
                            {configuration.color || "Default"}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center text-sm text-gray-700">
                        {configuration.sortOrder}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                            configuration.isActive
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              configuration.isActive
                                ? "bg-green-500"
                                : "bg-gray-400"
                            }`}
                          />

                          {configuration.isActive
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openEditModal(configuration)
                            }
                            title="Edit configuration"
                            aria-label={`Edit ${configuration.name}`}
                            className="rounded-lg border border-gray-200 p-2 text-gray-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void toggleActive(configuration)
                            }
                            title={
                              configuration.isActive
                                ? "Deactivate configuration"
                                : "Reactivate configuration"
                            }
                            aria-label={`${configuration.isActive ? "Deactivate" : "Reactivate"} ${configuration.name}`}
                            className={`rounded-lg border p-2 transition ${
                              configuration.isActive
                                ? "border-gray-200 text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                                : "border-green-200 text-green-700 hover:bg-green-50"
                            }`}
                          >
                            <Power size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50/70 px-4 py-4 text-xs text-gray-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <p>
              Showing {loading ? 0 : configurations.length}{" "}
              {activeTab === "status" ? "statuses" : "sources"}
            </p>

            <p>
              Changes are saved to your backend database.
            </p>
          </div>
        </section>
      </div>

      {/* Create/Edit modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-gray-950/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="configuration-modal-title"
            className="my-auto w-full max-w-xl rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-5 sm:px-6">
              <div>
                <h2
                  id="configuration-modal-title"
                  className="text-xl font-bold text-gray-900"
                >
                  {editingConfiguration
                    ? "Edit Configuration"
                    : `Add ${activeTab === "status" ? "Lead Status" : "Lead Source"}`}
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  {editingConfiguration
                    ? "Update the configuration details below."
                    : "Enter the details for your new configuration."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                aria-label="Close dialog"
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="space-y-5 px-5 py-6 sm:px-6">
                {formError && (
                  <div
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {formError}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="configuration-name"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Name <span className="text-red-500">*</span>
                  </label>

                  <input
                    id="configuration-name"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={form.name}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        name: event.target.value,
                      }))
                    }
                    placeholder={
                      activeTab === "status"
                        ? "e.g. Qualified"
                        : "e.g. Website"
                    }
                    className="w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="configuration-description"
                    className="mb-2 block text-sm font-semibold text-gray-700"
                  >
                    Description
                  </label>

                  <textarea
                    id="configuration-description"
                    rows={3}
                    maxLength={500}
                    value={form.description}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Enter a short description (optional)"
                    className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <p className="mt-1 text-right text-xs text-gray-400">
                    {form.description.length}/500
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="configuration-color"
                      className="mb-2 block text-sm font-semibold text-gray-700"
                    >
                      Display Color
                    </label>

                    <div className="flex h-12 items-center gap-3 rounded-lg border border-gray-300 px-3">
                      <input
                        id="configuration-color"
                        type="color"
                        value={form.color}
                        onChange={(event) =>
                          setForm((previous) => ({
                            ...previous,
                            color: event.target.value,
                          }))
                        }
                        className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                      />

                      <span className="font-mono text-sm text-gray-600">
                        {form.color}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="configuration-sort-order"
                      className="mb-2 block text-sm font-semibold text-gray-700"
                    >
                      Sort Order
                    </label>

                    <input
                      id="configuration-sort-order"
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={form.sortOrder}
                      onChange={(event) =>
                        setForm((previous) => ({
                          ...previous,
                          sortOrder: event.target.value,
                        }))
                      }
                      className="h-12 w-full rounded-lg border border-gray-300 px-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />

                    <p className="mt-1 text-xs text-gray-400">
                      Lower numbers appear first.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 rounded-b-2xl border-t border-gray-200 bg-gray-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:opacity-60"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {saving
                    ? "Saving..."
                    : editingConfiguration
                      ? "Save Changes"
                      : "Create Configuration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}