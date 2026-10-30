"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";

interface User {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  phone?: string;
  employeeId?: string;
  timezone?: string;
  joiningDate?: string;
  createdAt?: string;
  lastLoginAt?: string;
}

interface Pagination {
  currentPage: number;
  limit: number;
  totalUsers: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface UsersResponse {
  success: boolean;
  message: string;
  data: {
    users: User[];
    pagination: Pagination;
  };
}

interface CreateUserResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

interface CreateUserForm {
  fullName: string;
  email: string;
  role: string;
  phone: string;
  employeeId: string;
  timezone: string;
  joiningDate: string;
}

const initialForm: CreateUserForm = {
  fullName: "",
  email: "",
  role: "user",
  phone: "",
  employeeId: "",
  timezone: "Asia/Kolkata",
  joiningDate: "",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState<CreateUserForm>(initialForm);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: "10",
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      if (search.trim()) params.set("search", search.trim());
      if (role) params.set("role", role);
      if (status) params.set("status", status);

      const response = await apiGet<UsersResponse>(
        `/admin/users?${params.toString()}`,
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || "Unable to load users.");
      }

      setUsers(response.data.users);
      setPagination(response.data.pagination);
    } catch (err: unknown) {
      setUsers([]);
      setPagination(null);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading users.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, search, role, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchUsers();
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [fetchUsers]);

  const updateForm = (
    field: keyof CreateUserForm,
    value: string,
  ) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleCreateUser = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setCreateError("");
    setSuccess("");

    if (!form.fullName.trim() || !form.email.trim()) {
      setCreateError("Please enter the user's full name and email.");
      return;
    }

    setCreating(true);

    try {
      const payload: Record<string, string> = {
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        role: form.role,
        timezone: form.timezone.trim() || "Asia/Kolkata",
      };

      // Only include optional fields when the user enters a value.
      if (form.phone.trim()) {
        payload.phone = form.phone.trim();
      }

      if (form.employeeId.trim()) {
        payload.employeeId = form.employeeId.trim();
      }

      if (form.joiningDate) {
        payload.joiningDate = form.joiningDate;
      }

      const response = await apiPost<CreateUserResponse>(
        "/admin/users",
        payload,
      );

      if (!response.success) {
        throw new Error(response.message || "Unable to create user.");
      }

      setSuccess(
        response.message || "User created successfully.",
      );

      setForm(initialForm);
      setShowCreateForm(false);

      // Return to the first page so the newest user can appear.
      setPage(1);
      setSearch("");
      setRole("");
      setStatus("");

      // If already on page 1 with no filters, refresh immediately.
      if (page === 1 && !search && !role && !status) {
        await fetchUsers();
      }
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error
          ? err.message
          : "Something went wrong while creating the user.",
      );
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (value?: string) => {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const statusClass = (value: string) => {
    switch (value.toLowerCase()) {
      case "active":
        return "bg-green-100 text-green-700";
      case "invited":
        return "bg-blue-100 text-blue-700";
      case "suspended":
        return "bg-yellow-100 text-yellow-800";
      case "deactivated":
        return "bg-gray-100 text-gray-700";
      case "pending_deletion":
        return "bg-orange-100 text-orange-700";
      case "deleted":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      {/* Page heading */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            User Management
          </h1>

          <p className="mt-1 text-sm text-muted-foreground">
            View and manage the users who have access to your system.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSuccess("");
              setCreateError("");
              setShowCreateForm((current) => !current);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            {showCreateForm ? <X size={16} /> : <Plus size={16} />}

            {showCreateForm ? "Close Form" : "Create User"}
          </button>

          <button
            type="button"
            onClick={() => void fetchUsers()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-60"
          >
            <RefreshCw
              size={16}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Success message */}
      {success && (
        <div
          role="status"
          className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-700"
        >
          {success}
        </div>
      )}

      {/* Create user form */}
      {showCreateForm && (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-semibold">
              Create New User
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Enter the user's details below.
            </p>
          </div>

          {createError && (
            <div
              role="alert"
              className="mb-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              {createError}
            </div>
          )}

          <form onSubmit={handleCreateUser}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Full name */}
              <div>
                <label
                  htmlFor="fullName"
                  className="mb-2 block text-sm font-medium"
                >
                  Full Name *
                </label>

                <input
                  id="fullName"
                  type="text"
                  value={form.fullName}
                  onChange={(event) =>
                    updateForm("fullName", event.target.value)
                  }
                  placeholder="Enter full name"
                  required
                  maxLength={100}
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium"
                >
                  Email Address *
                </label>

                <input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) =>
                    updateForm("email", event.target.value)
                  }
                  placeholder="user@example.com"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Role */}
              <div>
                <label
                  htmlFor="role"
                  className="mb-2 block text-sm font-medium"
                >
                  Role *
                </label>

                <select
                  id="role"
                  value={form.role}
                  onChange={(event) =>
                    updateForm("role", event.target.value)
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {/* Phone */}
              <div>
                <label
                  htmlFor="phone"
                  className="mb-2 block text-sm font-medium"
                >
                  Phone
                </label>

                <input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    updateForm("phone", event.target.value)
                  }
                  placeholder="Enter phone number"
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Employee ID */}
              <div>
                <label
                  htmlFor="employeeId"
                  className="mb-2 block text-sm font-medium"
                >
                  Employee ID
                </label>

                <input
                  id="employeeId"
                  type="text"
                  value={form.employeeId}
                  onChange={(event) =>
                    updateForm("employeeId", event.target.value)
                  }
                  placeholder="e.g. EMP1003"
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Timezone */}
              <div>
                <label
                  htmlFor="timezone"
                  className="mb-2 block text-sm font-medium"
                >
                  Timezone *
                </label>

                <input
                  id="timezone"
                  type="text"
                  value={form.timezone}
                  onChange={(event) =>
                    updateForm("timezone", event.target.value)
                  }
                  placeholder="Asia/Kolkata"
                  required
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Joining date */}
              <div>
                <label
                  htmlFor="joiningDate"
                  className="mb-2 block text-sm font-medium"
                >
                  Joining Date
                </label>

                <input
                  id="joiningDate"
                  type="date"
                  value={form.joiningDate}
                  onChange={(event) =>
                    updateForm("joiningDate", event.target.value)
                  }
                  className="w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">
              * Required by this form. Optional fields can be left blank.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {creating && (
                  <RefreshCw size={16} className="animate-spin" />
                )}

                {creating ? "Creating User..." : "Create User"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateError("");
                  setForm(initialForm);
                }}
                disabled={creating}
                className="rounded-md border border-border px-5 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Total users */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-100 p-3 text-blue-700">
              <Users size={22} />
            </div>

            <div>
              <p className="text-sm text-muted-foreground">
                Total Users
              </p>

              <p className="mt-1 text-2xl font-semibold">
                {pagination?.totalUsers ?? (loading ? "…" : users.length)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Users table */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">All Users</h2>

          <p className="mt-1 text-sm text-muted-foreground">
            Search users and filter by role or account status.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />

            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, email, phone..."
              className="w-full rounded-md border border-border bg-background py-2.5 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <select
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="user">User</option>
          </select>

          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-md border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All statuses</option>
            <option value="invited">Invited</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
            <option value="pending_deletion">Pending deletion</option>
            <option value="deleted">Deleted</option>
          </select>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            <p className="font-semibold">Unable to load users</p>
            <p className="mt-1">{error}</p>

            <button
              type="button"
              onClick={() => void fetchUsers()}
              className="mt-3 font-medium underline"
            >
              Try again
            </button>
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Employee ID</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    Loading users...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    User list could not be loaded.
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user._id}
                    className="border-b border-border last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-4">
                      <div className="font-medium text-foreground">
                        {user.fullName}
                      </div>

                      <div className="mt-1 text-xs text-muted-foreground">
                        {user.email}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      {user.employeeId || "—"}
                    </td>

                    <td className="px-4 py-4">
                      {user.phone || "—"}
                    </td>

                    <td className="px-4 py-4">
                      <span className="capitalize">{user.role}</span>
                    </td>

                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(user.status)}`}
                      >
                        {user.status.replaceAll("_", " ")}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {formatDate(user.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-col justify-between gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
          <p className="text-sm text-muted-foreground">
            {pagination
              ? `Page ${pagination.currentPage} of ${Math.max(pagination.totalPages, 1)} · ${pagination.totalUsers} total users`
              : ""}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={
                loading ||
                !pagination ||
                !pagination.hasPreviousPage
              }
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>

            <button
              type="button"
              disabled={
                loading ||
                !pagination ||
                !pagination.hasNextPage
              }
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}