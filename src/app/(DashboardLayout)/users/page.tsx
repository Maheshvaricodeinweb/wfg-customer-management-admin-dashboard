
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import {
  Plus,
  RefreshCw,
  Search,
  Users as UsersIcon,
  X,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  CalendarDays,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  UserCheck,
  UserX,
  ShieldAlert,
  LogOut,
  KeyRound,
  Send,
  Ban,
} from "lucide-react";

import {
  apiGet,
  apiPost,
  apiRequest,
} from "@/lib/api";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

interface User {
  _id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  phone?: string;
  employeeId?: string;
  timezone?: string;
  joiningDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
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

interface UserResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
  };
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

interface EditUserForm {
  fullName: string;
  phone: string;
  employeeId: string;
  timezone: string;
  joiningDate: string;
}

type LifecycleAction =
  | "suspend"
  | "deactivate"
  | "reactivate"
  | "force-logout"
  | "reset-password"
  | "resend-invitation"
  | "revoke-invitation";

interface LifecycleResponse {
  success?: boolean;
  message?: string;
  data?: {
    user?: User;
    resetToken?: string;
    invitationToken?: string;
  };
}

interface LeadSummary {
  _id: string;
}

interface LeadsResponse {
  success: boolean;
  message?: string;
  data: {
    leads: LeadSummary[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface ReassignmentState {
  user: User;
  action: "suspend" | "deactivate";
  leads: LeadSummary[];
  replacementUsers: User[];
}

// --------------------------------------------------
// HELPER FUNCTIONS
// --------------------------------------------------

function formatDate(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInitials(fullName?: string): string {
  if (!fullName) {
    return "U";
  }

  return fullName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getStatusClass(status: string): string {
  switch (status.toLowerCase()) {
    case "active":
      return "bg-green-100 text-green-700";

    case "invited":
      return "bg-blue-100 text-blue-700";

    case "suspended":
      return "bg-orange-100 text-orange-700";

    case "deactivated":
      return "bg-gray-100 text-gray-700";

    case "pending_deletion":
      return "bg-red-100 text-red-700";

    case "deleted":
      return "bg-red-100 text-red-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

function getRoleClass(role: string): string {
  return role.toLowerCase() === "admin"
    ? "bg-purple-100 text-purple-700"
    : "bg-blue-100 text-blue-700";
}

// --------------------------------------------------
// LIFECYCLE ACTION CONFIGURATION
// --------------------------------------------------

const lifecycleActionDetails: Record<
  LifecycleAction,
  {
    label: string;
    description: (name: string) => string;
    successMessage: string;
    requiresConfirmation: boolean;
  }
> = {
  suspend: {
    label: "Suspend User",
    description: (name) =>
      `Suspend ${name}? Their account access will be restricted.`,
    successMessage: "User suspended successfully.",
    requiresConfirmation: true,
  },

  deactivate: {
    label: "Deactivate User",
    description: (name) =>
      `Deactivate ${name}? They will no longer be able to use their account.`,
    successMessage: "User deactivated successfully.",
    requiresConfirmation: true,
  },

  reactivate: {
    label: "Reactivate User",
    description: (name) => `Reactivate ${name}'s account?`,
    successMessage: "User reactivated successfully.",
    requiresConfirmation: true,
  },

  "force-logout": {
    label: "Force Logout",
    description: (name) =>
      `Revoke all refresh sessions belonging to ${name}?`,
    successMessage: "User sessions revoked successfully.",
    requiresConfirmation: true,
  },

  "reset-password": {
    label: "Reset Password",
    description: (name) =>
      `Generate a password reset request for ${name}?`,
    successMessage: "Password reset request processed successfully.",
    requiresConfirmation: true,
  },

  "resend-invitation": {
    label: "Resend Invitation",
    description: (name) =>
      `Generate a replacement invitation for ${name}?`,
    successMessage: "Invitation resent successfully.",
    requiresConfirmation: true,
  },

  "revoke-invitation": {
    label: "Revoke Invitation",
    description: (name) =>
      `Revoke the pending invitation for ${name}?`,
    successMessage: "Invitation revoked successfully.",
    requiresConfirmation: true,
  },
};

// --------------------------------------------------
// MAIN COMPONENT
// --------------------------------------------------

export default function UsersPage() {
  // User list
  const [users, setUsers] = useState<User[]>([]);

  const [pagination, setPagination] = useState<Pagination>({
    currentPage: 1,
    limit: 10,
    totalUsers: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPreviousPage: false,
  });

  // Search and filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  // Lifecycle actions
  const [lifecycleUserId, setLifecycleUserId] = useState<string | null>(
    null,
  );

  const [openActionsUserId, setOpenActionsUserId] = useState<string | null>(
    null,
  );

  const [confirmAction, setConfirmAction] = useState<{
    user: User;
    action: LifecycleAction;
  } | null>(null);

  // Lead reassignment before suspending/deactivating a user
  const [checkingAssignmentsUserId, setCheckingAssignmentsUserId] =
    useState<string | null>(null);
  const [reassignment, setReassignment] =
    useState<ReassignmentState | null>(null);
  const [replacementUserId, setReplacementUserId] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [reassignmentError, setReassignmentError] = useState("");

  // Notifications
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Create user modal
  const [showCreateForm, setShowCreateForm] = useState(false);

  const [createForm, setCreateForm] = useState<CreateUserForm>({
    fullName: "",
    email: "",
    role: "user",
    phone: "",
    employeeId: "",
    timezone: "Asia/Kolkata",
    joiningDate: "",
  });

  const [createError, setCreateError] = useState("");

  // View user modal
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Edit user modal
  const [showEditForm, setShowEditForm] = useState(false);
  const [editError, setEditError] = useState("");

  const [editForm, setEditForm] = useState<EditUserForm>({
    fullName: "",
    phone: "",
    employeeId: "",
    timezone: "Asia/Kolkata",
    joiningDate: "",
  });

  // --------------------------------------------------
  // FETCH USERS
  // --------------------------------------------------

  const fetchUsers = useCallback(
    async (showRefreshIndicator = false) => {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const params = new URLSearchParams();

        params.set("page", String(currentPage));
        params.set("limit", String(pagination.limit));

        if (search.trim()) {
          params.set("search", search.trim());
        }

        if (roleFilter) {
          params.set("role", roleFilter);
        }

        if (statusFilter) {
          params.set("status", statusFilter);
        }

        const response = await apiGet<UsersResponse>(
          `/admin/users?${params.toString()}`,
        );

        setUsers(response.data.users ?? []);

        setPagination({
          currentPage:
            response.data.pagination?.currentPage ?? currentPage,
          limit: response.data.pagination?.limit ?? 10,
          totalUsers:
            response.data.pagination?.totalUsers ??
            response.data.users?.length ??
            0,
          totalPages: Math.max(
            1,
            response.data.pagination?.totalPages ?? 1,
          ),
          hasNextPage:
            response.data.pagination?.hasNextPage ?? false,
          hasPreviousPage:
            response.data.pagination?.hasPreviousPage ?? false,
        });
      } catch (err: unknown) {
        setUsers([]);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load users. Please try again.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      currentPage,
      pagination.limit,
      roleFilter,
      search,
      statusFilter,
    ],
  );

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // --------------------------------------------------
  // RESET FILTERS
  // --------------------------------------------------

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const handleRoleChange = (value: string) => {
    setRoleFilter(value);
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > pagination.totalPages) {
      return;
    }

    setCurrentPage(page);
  };

  // --------------------------------------------------
  // CREATE USER
  // --------------------------------------------------

  const handleCreateUser = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setCreating(true);
    setCreateError("");
    setError("");
    setSuccess("");

    try {
      const payload: Record<string, string> = {
        fullName: createForm.fullName.trim(),
        email: createForm.email.trim(),
        role: createForm.role,
        timezone: createForm.timezone,
      };

      if (createForm.phone.trim()) {
        payload.phone = createForm.phone.trim();
      }

      if (createForm.employeeId.trim()) {
        payload.employeeId = createForm.employeeId.trim();
      }

      if (createForm.joiningDate) {
        payload.joiningDate = createForm.joiningDate;
      }

      const response = await apiPost<UserResponse>(
        "/admin/users",
        payload,
      );

      setSuccess(
        response.message ||
          "User created and invitation generated successfully.",
      );

      setShowCreateForm(false);

      setCreateForm({
        fullName: "",
        email: "",
        role: "user",
        phone: "",
        employeeId: "",
        timezone: "Asia/Kolkata",
        joiningDate: "",
      });

      setCurrentPage(1);

      // Immediately refresh if already on page one.
      if (currentPage === 1) {
        await fetchUsers(true);
      }
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error
          ? err.message
          : "Unable to create user.",
      );
    } finally {
      setCreating(false);
    }
  };

  // --------------------------------------------------
  // VIEW USER DETAILS
  // --------------------------------------------------

  const handleViewUser = async (userId: string) => {
    setDetailsLoading(true);
    setError("");
    setSuccess("");
    setShowDetails(false);
    setShowEditForm(false);
    setShowCreateForm(false);
    setOpenActionsUserId(null);

    try {
      const response = await apiGet<UserResponse>(
        `/admin/users/${userId}`,
      );

      setSelectedUser(response.data.user);
      setShowDetails(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load user details.",
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  // --------------------------------------------------
  // OPEN EDIT USER FORM
  // --------------------------------------------------

  const handleEditUser = (user: User) => {
    setSelectedUser(user);

    setEditForm({
      fullName: user.fullName || "",
      phone: user.phone || "",
      employeeId: user.employeeId || "",
      timezone: user.timezone || "Asia/Kolkata",
      joiningDate: user.joiningDate
        ? user.joiningDate.substring(0, 10)
        : "",
    });

    setEditError("");
    setError("");
    setSuccess("");

    setShowDetails(false);
    setShowCreateForm(false);
    setShowEditForm(true);
    setOpenActionsUserId(null);
  };

  // --------------------------------------------------
  // SAVE USER EDITS
  // --------------------------------------------------

  const handleSaveUser = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    if (!selectedUser) {
      return;
    }

    setSavingEdit(true);
    setEditError("");
    setError("");
    setSuccess("");

    try {
      const payload: Record<string, string | null> = {
        fullName: editForm.fullName.trim(),
        timezone: editForm.timezone.trim(),
        joiningDate: editForm.joiningDate || null,
      };

      // Keep existing values when fields are left blank.
      if (editForm.phone.trim()) {
        payload.phone = editForm.phone.trim();
      }

      if (editForm.employeeId.trim()) {
        payload.employeeId = editForm.employeeId.trim();
      }

      const response = await apiRequest<UserResponse>(
        `/admin/users/${selectedUser._id}`,
        {
          method: "PATCH",
          body: payload,
        },
      );

      setSelectedUser(response.data.user);
      setShowEditForm(false);

      setSuccess(
        response.message || "User updated successfully.",
      );

      await fetchUsers(true);
    } catch (err: unknown) {
      setEditError(
        err instanceof Error
          ? err.message
          : "Unable to update the user.",
      );
    } finally {
      setSavingEdit(false);
    }
  };

  // --------------------------------------------------
  // USER LIFECYCLE ACTIONS
  // --------------------------------------------------

  const executeLifecycleAction = async (
    user: User,
    action: LifecycleAction,
  ) => {
    setLifecycleUserId(user._id);
    setOpenActionsUserId(null);
    setConfirmAction(null);
    setError("");
    setSuccess("");

    try {
      const response = await apiPost<LifecycleResponse>(
        `/admin/users/${user._id}/${action}`,
      );

      const actionDetails = lifecycleActionDetails[action];

      setSuccess(
        response.message || actionDetails.successMessage,
      );

      // Update the selected user details if that modal is open.
      if (response.data?.user) {
        setSelectedUser(response.data.user);
      }

      // Refresh the list to display the latest status.
      await fetchUsers(true);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to complete ${lifecycleActionDetails[action].label.toLowerCase()}.`,
      );
    } finally {
      setLifecycleUserId(null);
    }
  };

  const requestLifecycleAction = async (
    user: User,
    action: LifecycleAction,
  ) => {
    setOpenActionsUserId(null);
    setError("");
    setSuccess("");
    setReassignmentError("");

    // Other lifecycle actions can use the existing confirmation modal.
    if (action !== "suspend" && action !== "deactivate") {
      setConfirmAction({ user, action });
      return;
    }

    setCheckingAssignmentsUserId(user._id);

    try {
      // Fetch every page of this user's active, non-archived leads.
      const firstLeadParams = new URLSearchParams({
        ownerId: user._id,
        archived: "false",
        page: "1",
        limit: "100",
      });

      const firstLeadResponse = await apiGet<LeadsResponse>(
        `/leads?${firstLeadParams.toString()}`,
      );

      const assignedLeads: LeadSummary[] = [
        ...(firstLeadResponse.data.leads ?? []),
      ];

      const totalLeadPages =
        firstLeadResponse.data.pagination?.totalPages ?? 1;

      for (let page = 2; page <= totalLeadPages; page += 1) {
        const params = new URLSearchParams({
          ownerId: user._id,
          archived: "false",
          page: String(page),
          limit: "100",
        });

        const response = await apiGet<LeadsResponse>(
          `/leads?${params.toString()}`,
        );

        assignedLeads.push(...(response.data.leads ?? []));
      }

      // No active leads: proceed with the usual confirmation.
      if (assignedLeads.length === 0) {
        setConfirmAction({ user, action });
        return;
      }

      // Load all users so the replacement list is not limited to
      // the currently visible page or active filters.
      const firstUsersResponse = await apiGet<UsersResponse>(
        "/admin/users?page=1&limit=100",
      );

      const allUsers: User[] = [
        ...(firstUsersResponse.data.users ?? []),
      ];

      const totalUserPages =
        firstUsersResponse.data.pagination?.totalPages ?? 1;

      for (let page = 2; page <= totalUserPages; page += 1) {
        const response = await apiGet<UsersResponse>(
          `/admin/users?page=${page}&limit=100`,
        );

        allUsers.push(...(response.data.users ?? []));
      }

      const replacementUsers = allUsers.filter(
        (candidate) =>
          candidate._id !== user._id &&
          candidate.role.toLowerCase() === "user" &&
          candidate.status.toLowerCase() === "active",
      );

      if (replacementUsers.length === 0) {
        setError(
          `${user.fullName} owns ${assignedLeads.length} active lead(s), but no other active regular user is available to receive them.`,
        );
        return;
      }

      setReplacementUserId("");
      setReassignment({
        user,
        action,
        leads: assignedLeads,
        replacementUsers,
      });
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to check the user's assigned leads.",
      );
    } finally {
      setCheckingAssignmentsUserId(null);
    }
  };

  const handleReassignAndContinue = async () => {
    const currentReassignment = reassignment;

    if (!currentReassignment || !replacementUserId) {
      return;
    }

    setReassigning(true);
    setReassignmentError("");
    setError("");
    setSuccess("");

    let reassignedCount = 0;

    try {
      const { user, action, leads } = currentReassignment;

      // The backend accepts a maximum of 100 lead IDs per request.
      for (let index = 0; index < leads.length; index += 100) {
        const batch = leads.slice(index, index + 100);

        await apiPost<LifecycleResponse>(
          "/admin/leads/bulk-assign",
          {
            ownerId: replacementUserId,
            leadIds: batch.map((lead) => lead._id),
          },
        );

        reassignedCount += batch.length;
      }

      // Only run the lifecycle action after every batch succeeds.
      setReassignment(null);
      setReplacementUserId("");
      setReassignmentError("");

      await executeLifecycleAction(user, action);
    } catch (err: unknown) {
      setReassignmentError(
        `Reassignment stopped after ${reassignedCount} of ${currentReassignment.leads.length} leads. The user has NOT been ${
          currentReassignment.action === "suspend"
            ? "suspended"
            : "deactivated"
        }. ${
          err instanceof Error ? err.message : "Please try again."
        }`,
      );
    } finally {
      setReassigning(false);
    }
  };

  // --------------------------------------------------
  // CLOSE MODALS
  // --------------------------------------------------

  const closeModals = () => {
    setShowCreateForm(false);
    setShowDetails(false);
    setShowEditForm(false);
    setCreateError("");
    setEditError("");
  };

  // --------------------------------------------------
  // RENDER
  // --------------------------------------------------

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* PAGE HEADER */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              User Management
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              Manage users, invitations, account status, and user information.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void fetchUsers(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw
                size={16}
                className={refreshing ? "animate-spin" : ""}
              />

              Refresh
            </button>

            <button
              type="button"
              onClick={() => {
                setCreateError("");
                setError("");
                setSuccess("");
                setShowCreateForm(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              <Plus size={18} />
              Create User
            </button>
          </div>
        </div>

        {/* SUCCESS MESSAGE */}

        {success && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
            <CheckCircle2
              size={20}
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

        {/* ERROR MESSAGE */}

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle
              size={20}
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

        {/* TOTAL USERS CARDS */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Total Users
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {pagination.totalUsers}
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-3 text-blue-600">
                <UsersIcon size={24} />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Active Users
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {
                    users.filter(
                      (user) =>
                        user.status.toLowerCase() === "active",
                    ).length
                  }
                </p>
              </div>

              <div className="rounded-xl bg-green-50 p-3 text-green-600">
                <CheckCircle2 size={24} />
              </div>
            </div>

            <p className="mt-2 text-xs text-gray-400">
              Active users on this page
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Administrators
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {
                    users.filter(
                      (user) =>
                        user.role.toLowerCase() === "admin",
                    ).length
                  }
                </p>
              </div>

              <div className="rounded-xl bg-purple-50 p-3 text-purple-600">
                <ShieldCheck size={24} />
              </div>
            </div>

            <p className="mt-2 text-xs text-gray-400">
              Administrators on this page
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">
                  Current Page
                </p>

                <p className="mt-2 text-3xl font-bold text-gray-900">
                  {pagination.currentPage}
                  <span className="text-lg font-medium text-gray-400">
                    {" "}
                    / {pagination.totalPages}
                  </span>
                </p>
              </div>

              <div className="rounded-xl bg-orange-50 p-3 text-orange-600">
                <CalendarDays size={24} />
              </div>
            </div>
          </div>
        </div>

        {/* SEARCH AND FILTERS */}

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label
                htmlFor="userSearch"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Search users
              </label>

              <div className="relative">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  id="userSearch"
                  type="search"
                  value={search}
                  onChange={(event) =>
                    handleSearchChange(event.target.value)
                  }
                  placeholder="Search by name, email, or employee ID..."
                  className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="roleFilter"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Filter by role
              </label>

              <select
                id="roleFilter"
                value={roleFilter}
                onChange={(event) =>
                  handleRoleChange(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Roles</option>
                <option value="admin">Administrator</option>
                <option value="user">User</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="statusFilter"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Filter by status
              </label>

              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(event) =>
                  handleStatusChange(event.target.value)
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">All Statuses</option>
                <option value="invited">Invited</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="deactivated">Deactivated</option>
                <option value="pending_deletion">Pending Deletion</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          </div>
        </section>

        {/* USERS TABLE */}

        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                All Users
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                View and manage registered users.
              </p>
            </div>

            <span className="text-sm text-gray-500">
              {pagination.totalUsers} total users
            </span>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <div className="flex items-center gap-3 text-gray-500">
                <LoaderCircle
                  size={24}
                  className="animate-spin"
                />

                <span className="text-sm">Loading users...</span>
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
              <div className="mb-4 rounded-full bg-gray-100 p-4">
                <UsersIcon
                  size={32}
                  className="text-gray-400"
                />
              </div>

              <h3 className="text-base font-semibold text-gray-800">
                No users found
              </h3>

              <p className="mt-1 max-w-md text-sm text-gray-500">
                Try changing your search or filters, or create a new user.
              </p>

              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("");
                  setStatusFilter("");
                  setCurrentPage(1);
                }}
                className="mt-4 text-sm font-semibold text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] border-collapse text-left">
                  <thead className="bg-gray-50">
                    <tr className="border-b border-gray-200">
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        User
                      </th>

                      <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Employee ID
                      </th>

                      <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Phone
                      </th>

                      <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Role
                      </th>

                      <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Status
                      </th>

                      <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Created
                      </th>

                      <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-100">
                    {users.map((user) => {
                      const normalizedStatus = user.status.toLowerCase();
                      const isBusy =
                        lifecycleUserId === user._id ||
                        checkingAssignmentsUserId === user._id;
                      const isMenuOpen = openActionsUserId === user._id;

                      const isActive = normalizedStatus === "active";
                      const isInvited = normalizedStatus === "invited";
                      const canReactivate = [
                        "suspended",
                        "deactivated",
                      ].includes(normalizedStatus);

                      const canUseLifecycleActions =
                        isActive || isInvited || canReactivate;

                      return (
                        <tr
                          key={user._id}
                          className="transition hover:bg-gray-50"
                        >
                          {/* USER */}

                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                                {getInitials(user.fullName)}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-900">
                                  {user.fullName}
                                </p>

                                <p className="mt-1 truncate text-xs text-gray-500">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* EMPLOYEE ID */}

                          <td className="px-4 py-4 text-sm text-gray-600">
                            {user.employeeId || "—"}
                          </td>

                          {/* PHONE */}

                          <td className="px-4 py-4 text-sm text-gray-600">
                            {user.phone || "—"}
                          </td>

                          {/* ROLE */}

                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${getRoleClass(
                                user.role,
                              )}`}
                            >
                              {user.role}
                            </span>
                          </td>

                          {/* STATUS */}

                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusClass(
                                user.status,
                              )}`}
                            >
                              {user.status.replaceAll("_", " ")}
                            </span>
                          </td>

                          {/* CREATED DATE */}

                          <td className="px-4 py-4 text-sm text-gray-600">
                            {formatDate(user.createdAt)}
                          </td>

                          {/* ACTIONS */}

                          <td className="px-4 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  void handleViewUser(user._id)
                                }
                                title="View user details"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <Eye size={14} />
                                View
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEditUser(user)}
                                title="Edit user"
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                              >
                                <Pencil size={14} />
                                Edit
                              </button>

                              {canUseLifecycleActions && (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenActionsUserId(
                                        isMenuOpen ? null : user._id,
                                      )
                                    }
                                    disabled={isBusy}
                                    aria-expanded={isMenuOpen}
                                    aria-label={`More actions for ${user.fullName}`}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {isBusy ? (
                                      <LoaderCircle
                                        size={14}
                                        className="animate-spin"
                                      />
                                    ) : (
                                      <MoreHorizontal size={16} />
                                    )}

                                    Actions
                                  </button>

                                  {isMenuOpen && (
                                    <div className="absolute right-0 top-full z-40 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
                                      {isActive && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              requestLifecycleAction(
                                                user,
                                                "suspend",
                                              )
                                            }
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-amber-700 transition hover:bg-amber-50"
                                          >
                                            <ShieldAlert size={15} />
                                            Suspend user
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              requestLifecycleAction(
                                                user,
                                                "deactivate",
                                              )
                                            }
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-50"
                                          >
                                            <UserX size={15} />
                                            Deactivate user
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              requestLifecycleAction(
                                                user,
                                                "force-logout",
                                              )
                                            }
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100"
                                          >
                                            <LogOut size={15} />
                                            Force logout
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              requestLifecycleAction(
                                                user,
                                                "reset-password",
                                              )
                                            }
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100"
                                          >
                                            <KeyRound size={15} />
                                            Reset password
                                          </button>
                                        </>
                                      )}

                                      {canReactivate && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            requestLifecycleAction(
                                              user,
                                              "reactivate",
                                            )
                                          }
                                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-green-700 transition hover:bg-green-50"
                                        >
                                          <UserCheck size={15} />
                                          Reactivate user
                                        </button>
                                      )}

                                      {isInvited && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              requestLifecycleAction(
                                                user,
                                                "resend-invitation",
                                              )
                                            }
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-blue-700 transition hover:bg-blue-50"
                                          >
                                            <Send size={15} />
                                            Resend invitation
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() =>
                                              requestLifecycleAction(
                                                user,
                                                "revoke-invitation",
                                              )
                                            }
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-700 transition hover:bg-red-50"
                                          >
                                            <Ban size={15} />
                                            Revoke invitation
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION */}

              <div className="flex flex-col gap-4 border-t border-gray-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gray-500">
                  Page{" "}
                  <span className="font-semibold text-gray-800">
                    {pagination.currentPage}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-gray-800">
                    {pagination.totalPages}
                  </span>
                </p>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      handlePageChange(currentPage - 1)
                    }
                    disabled={!pagination.hasPreviousPage}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handlePageChange(currentPage + 1)
                    }
                    disabled={!pagination.hasNextPage}
                    className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      {/* ================================================== */}
      {/* CREATE USER MODAL                                  */}
      {/* ================================================== */}

      {showCreateForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModals();
            }
          }}
        >
          <section className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Create User
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Add a user and generate an invitation.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModals}
                aria-label="Close create user form"
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-800"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleCreateUser}
              className="space-y-5 p-6"
            >
              {createError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {createError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="createFullName"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Full Name *
                  </label>

                  <input
                    id="createFullName"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={createForm.fullName}
                    onChange={(event) =>
                      setCreateForm({
                        ...createForm,
                        fullName: event.target.value,
                      })
                    }
                    placeholder="Enter full name"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="createEmail"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Email Address *
                  </label>

                  <input
                    id="createEmail"
                    type="email"
                    required
                    value={createForm.email}
                    onChange={(event) =>
                      setCreateForm({
                        ...createForm,
                        email: event.target.value,
                      })
                    }
                    placeholder="user@example.com"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="createRole"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Role *
                  </label>

                  <select
                    id="createRole"
                    required
                    value={createForm.role}
                    onChange={(event) =>
                      setCreateForm({
                        ...createForm,
                        role: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="user">User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="createEmployeeId"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Employee ID
                  </label>

                  <input
                    id="createEmployeeId"
                    type="text"
                    maxLength={50}
                    value={createForm.employeeId}
                    onChange={(event) =>
                      setCreateForm({
                        ...createForm,
                        employeeId: event.target.value,
                      })
                    }
                    placeholder="e.g. EMP1003"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="createPhone"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Phone Number
                  </label>

                  <input
                    id="createPhone"
                    type="tel"
                    value={createForm.phone}
                    onChange={(event) =>
                      setCreateForm({
                        ...createForm,
                        phone: event.target.value,
                      })
                    }
                    placeholder="+91 9876543210"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="createTimezone"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Timezone *
                  </label>

                  <select
                    id="createTimezone"
                    required
                    value={createForm.timezone}
                    onChange={(event) =>
                      setCreateForm({
                        ...createForm,
                        timezone: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="Asia/Kolkata">
                      Asia/Kolkata (India)
                    </option>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Dubai">Asia/Dubai</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">
                      America/New_York
                    </option>
                    <option value="America/Los_Angeles">
                      America/Los_Angeles
                    </option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="createJoiningDate"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Joining Date
                  </label>

                  <input
                    id="createJoiningDate"
                    type="date"
                    value={createForm.joiningDate}
                    onChange={(event) =>
                      setCreateForm({
                        ...createForm,
                        joiningDate: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModals}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creating && (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {creating ? "Creating..." : "Create User"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ================================================== */}
      {/* VIEW USER DETAILS MODAL                            */}
      {/* ================================================== */}

      {detailsLoading && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white px-6 py-5 shadow-xl">
            <LoaderCircle
              size={22}
              className="animate-spin text-blue-600"
            />

            <span className="text-sm font-medium text-gray-700">
              Loading user details...
            </span>
          </div>
        </div>
      )}

      {showDetails && selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModals();
            }
          }}
        >
          <section className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  User Details
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  View the selected user&apos;s information.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModals}
                aria-label="Close user details"
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              <div className="flex flex-col items-center gap-3 rounded-xl bg-gray-50 p-6 sm:flex-row sm:text-left">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xl font-bold text-blue-700">
                  {getInitials(selectedUser.fullName)}
                </div>

                <div className="min-w-0 text-center sm:text-left">
                  <h3 className="break-words text-xl font-bold text-gray-900">
                    {selectedUser.fullName}
                  </h3>

                  <p className="mt-1 break-all text-sm text-gray-500">
                    {selectedUser.email}
                  </p>

                  <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${getRoleClass(
                        selectedUser.role,
                      )}`}
                    >
                      {selectedUser.role}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClass(
                        selectedUser.status,
                      )}`}
                    >
                      {selectedUser.status.replaceAll("_", " ")}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-4 text-base font-semibold text-gray-900">
                  Personal Information
                </h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DetailItem
                    icon={<UserRound size={17} />}
                    label="Full Name"
                    value={selectedUser.fullName}
                  />

                  <DetailItem
                    icon={<Mail size={17} />}
                    label="Email Address"
                    value={selectedUser.email}
                  />

                  <DetailItem
                    icon={<Phone size={17} />}
                    label="Phone Number"
                    value={selectedUser.phone || "Not provided"}
                  />

                  <DetailItem
                    icon={<UserRound size={17} />}
                    label="Employee ID"
                    value={selectedUser.employeeId || "Not provided"}
                  />

                  <DetailItem
                    icon={<CalendarDays size={17} />}
                    label="Joining Date"
                    value={formatDate(selectedUser.joiningDate)}
                  />

                  <DetailItem
                    icon={<CalendarDays size={17} />}
                    label="Account Created"
                    value={formatDate(selectedUser.createdAt)}
                  />

                  <DetailItem
                    icon={<CalendarDays size={17} />}
                    label="Last Login"
                    value={formatDate(selectedUser.lastLoginAt)}
                  />

                  <DetailItem
                    icon={<ShieldCheck size={17} />}
                    label="Timezone"
                    value={selectedUser.timezone || "Asia/Kolkata"}
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModals}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Close
                </button>

                <button
                  type="button"
                  onClick={() => handleEditUser(selectedUser)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <Pencil size={16} />
                  Edit User
                </button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* ================================================== */}
      {/* EDIT USER MODAL                                    */}
      {/* ================================================== */}

      {showEditForm && selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModals();
            }
          }}
        >
          <section className="my-auto w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  Edit User
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Update information for {selectedUser.fullName}.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModals}
                aria-label="Close edit user form"
                className="rounded-lg p-2 text-gray-500 transition hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={handleSaveUser}
              className="space-y-5 p-6"
            >
              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {editError}
                </div>
              )}

              <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
                <p className="text-xs font-medium text-blue-700">
                  Email: {selectedUser.email}
                </p>

                <p className="mt-1 text-xs text-blue-600">
                  Email and role are not changed by this form.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="editFullName"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Full Name *
                  </label>

                  <input
                    id="editFullName"
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={editForm.fullName}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        fullName: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="editEmployeeId"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Employee ID
                  </label>

                  <input
                    id="editEmployeeId"
                    type="text"
                    maxLength={50}
                    value={editForm.employeeId}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        employeeId: event.target.value,
                      })
                    }
                    placeholder="Enter employee ID"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="editPhone"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Phone Number
                  </label>

                  <input
                    id="editPhone"
                    type="tel"
                    value={editForm.phone}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        phone: event.target.value,
                      })
                    }
                    placeholder="+91 9876543210"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <p className="mt-1 text-xs text-gray-400">
                    Leave blank to keep the existing phone number.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="editTimezone"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Timezone *
                  </label>

                  <select
                    id="editTimezone"
                    required
                    value={editForm.timezone}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        timezone: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="Asia/Kolkata">
                      Asia/Kolkata (India)
                    </option>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Dubai">Asia/Dubai</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="America/New_York">
                      America/New_York
                    </option>
                    <option value="America/Los_Angeles">
                      America/Los_Angeles
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="editJoiningDate"
                    className="mb-2 block text-sm font-medium text-gray-700"
                  >
                    Joining Date
                  </label>

                  <input
                    id="editJoiningDate"
                    type="date"
                    value={editForm.joiningDate}
                    onChange={(event) =>
                      setEditForm({
                        ...editForm,
                        joiningDate: event.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />

                  <p className="mt-1 text-xs text-gray-400">
                    Clear the date to remove the existing joining date.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModals}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingEdit && (
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                  )}

                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* ================================================== */}
      {/* LEAD REASSIGNMENT MODAL                            */}
      {/* ================================================== */}

      {reassignment && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto bg-black/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="reassignmentTitle"
            className="my-auto w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between border-b border-gray-200 px-6 py-5">
              <div>
                <h2
                  id="reassignmentTitle"
                  className="text-xl font-bold text-gray-900"
                >
                  Reassign Leads Before{" "}
                  {reassignment.action === "suspend"
                    ? "Suspending"
                    : "Deactivating"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Reassign this user's active leads before continuing.
                </p>
              </div>

              <button
                type="button"
                disabled={reassigning}
                onClick={() => {
                  setReassignment(null);
                  setReplacementUserId("");
                  setReassignmentError("");
                }}
                aria-label="Close reassignment modal"
                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
                    {getInitials(reassignment.user.fullName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {reassignment.user.fullName}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {reassignment.user.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      Active leads assigned
                    </p>
                    <p className="mt-1 text-3xl font-bold text-blue-900">
                      {reassignment.leads.length}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white p-3 text-blue-600">
                    <UsersIcon size={24} />
                  </div>
                </div>
              </div>

              <div>
                <label
                  htmlFor="replacementUser"
                  className="mb-2 block text-sm font-semibold text-gray-700"
                >
                  Select replacement user *
                </label>
                <select
                  id="replacementUser"
                  value={replacementUserId}
                  onChange={(event) =>
                    setReplacementUserId(event.target.value)
                  }
                  disabled={reassigning}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                >
                  <option value="">Select an active user</option>
                  {reassignment.replacementUsers.map((candidate) => (
                    <option key={candidate._id} value={candidate._id}>
                      {candidate.fullName} ({candidate.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle
                    size={18}
                    className="mt-0.5 shrink-0 text-amber-700"
                  />
                  <p className="text-xs leading-5 text-amber-800">
                    All {reassignment.leads.length} active leads will be
                    assigned to the selected user. The{" "}
                    {reassignment.action === "suspend"
                      ? "suspension"
                      : "deactivation"}{" "}
                    will happen only after all leads have been reassigned
                    successfully.
                  </p>
                </div>
              </div>

              {reassignmentError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  <AlertCircle
                    size={18}
                    className="mt-0.5 shrink-0"
                  />
                  <p className="leading-5">{reassignmentError}</p>
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={reassigning}
                onClick={() => {
                  setReassignment(null);
                  setReplacementUserId("");
                  setReassignmentError("");
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={!replacementUserId || reassigning}
                onClick={() => void handleReassignAndContinue()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reassigning ? (
                  <>
                    <LoaderCircle
                      size={17}
                      className="animate-spin"
                    />
                    Reassigning Leads...
                  </>
                ) : (
                  "Reassign & Continue"
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ================================================== */}
      {/* LIFECYCLE CONFIRMATION MODAL                       */}
      {/* ================================================== */}

      {confirmAction && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/50 p-4"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !lifecycleUserId
            ) {
              setConfirmAction(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="lifecycleConfirmTitle"
            className="my-auto w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-start gap-4 p-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                <ShieldAlert size={24} />
              </div>

              <div className="min-w-0 flex-1">
                <h2
                  id="lifecycleConfirmTitle"
                  className="text-lg font-bold text-gray-900"
                >
                  {lifecycleActionDetails[confirmAction.action].label}
                </h2>

                <p className="mt-2 break-words text-sm leading-6 text-gray-600">
                  {
                    lifecycleActionDetails[
                      confirmAction.action
                    ].description(confirmAction.user.fullName)
                  }
                </p>

                <p className="mt-3 break-all text-xs text-gray-500">
                  {confirmAction.user.email}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={lifecycleUserId !== null}
                aria-label="Close confirmation"
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={lifecycleUserId !== null}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={lifecycleUserId !== null}
                onClick={() => {
                  if (!confirmAction) {
                    return;
                  }

                  void executeLifecycleAction(
                    confirmAction.user,
                    confirmAction.action,
                  );
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {lifecycleUserId === confirmAction.user._id ? (
                  <>
                    <LoaderCircle
                      size={16}
                      className="animate-spin"
                    />
                    Processing...
                  </>
                ) : (
                  `Confirm ${lifecycleActionDetails[confirmAction.action].label}`
                )}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

// --------------------------------------------------
// USER DETAILS ITEM
// --------------------------------------------------

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-gray-100 p-3">
      <div className="mb-2 flex items-center gap-2 text-gray-400">
        {icon}

        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>

      <p className="break-words text-sm font-medium text-gray-800">
        {value}
      </p>
    </div>
  );
}
