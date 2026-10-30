
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";

import CardBox from "../shared/CardBox";

import BreadcrumbComp from "@/app/(DashboardLayout)/layout/shared/breadcrumb/BreadcrumbComp";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  apiGet,
  apiPatch,
  apiPost,
} from "@/lib/api";

// --------------------------------------------------
// TYPES
// --------------------------------------------------

interface Profile {
  _id?: string;
  id?: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  phone?: string;
  employeeId?: string;
  timezone?: string;
  joiningDate?: string | null;
  invitationAcceptedAt?: string | null;
  lastLoginAt?: string | null;
  passwordChangedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

interface ProfileResponse {
  success: boolean;
  message: string;
  data: {
    user: Profile;
  };
}

interface ApiResponse {
  success: boolean;
  message: string;
}

interface ProfileForm {
  fullName: string;
  phone: string;
  employeeId: string;
  timezone: string;
  joiningDate: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
};

const formatDate = (date?: string | null): string => {
  if (!date) {
    return "Not available";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "Not available";
  }

  return parsedDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const getDateInputValue = (date?: string | null): string => {
  if (!date) {
    return "";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  return parsedDate.toISOString().split("T")[0];
};

const UserProfile = () => {
  // --------------------------------------------------
  // STATE
  // --------------------------------------------------

  const [profile, setProfile] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);

  const [openProfileDialog, setOpenProfileDialog] = useState(false);
  const [openPasswordDialog, setOpenPasswordDialog] = useState(false);

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [profileForm, setProfileForm] = useState<ProfileForm>({
    fullName: "",
    phone: "",
    employeeId: "",
    timezone: "Asia/Kolkata",
    joiningDate: "",
  });

  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // --------------------------------------------------
  // BREADCRUMB
  // --------------------------------------------------

  const BCrumb = [
    {
      to: "/",
      title: "Home",
    },
    {
      title: "User Profile",
    },
  ];

  // --------------------------------------------------
  // LOAD PROFILE
  // --------------------------------------------------

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await apiGet<ProfileResponse>("/profile");

      const user = response.data.user;

      setProfile(user);

      setProfileForm({
        fullName: user.fullName || "",
        phone: user.phone || "",
        employeeId: user.employeeId || "",
        timezone: user.timezone || "Asia/Kolkata",
        joiningDate: getDateInputValue(user.joiningDate),
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchProfile();
  }, []);

  // --------------------------------------------------
  // OPEN PROFILE EDIT DIALOG
  // --------------------------------------------------

  const handleOpenProfileDialog = () => {
    if (!profile) {
      return;
    }

    setProfileForm({
      fullName: profile.fullName || "",
      phone: profile.phone || "",
      employeeId: profile.employeeId || "",
      timezone: profile.timezone || "Asia/Kolkata",
      joiningDate: getDateInputValue(profile.joiningDate),
    });

    setError("");
    setSuccess("");
    setOpenProfileDialog(true);
  };

  // --------------------------------------------------
  // UPDATE PROFILE
  // PATCH /api/v1/profile
  // --------------------------------------------------

  const handleUpdateProfile = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    try {
      setSavingProfile(true);
      setError("");
      setSuccess("");

      const payload: ProfileForm = {
        fullName: profileForm.fullName.trim(),
        phone: profileForm.phone.trim(),
        employeeId: profileForm.employeeId.trim(),
        timezone: profileForm.timezone.trim(),
        joiningDate: profileForm.joiningDate,
      };

      await apiPatch<ProfileResponse>("/profile", payload);

      await fetchProfile();

      setOpenProfileDialog(false);
      setSuccess("Profile updated successfully.");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  // --------------------------------------------------
  // CHANGE PASSWORD
  // POST /api/v1/auth/change-password
  // --------------------------------------------------

  const handleChangePassword = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      passwordForm.newPassword !== passwordForm.confirmPassword
    ) {
      setError("New password and confirm password do not match.");
      return;
    }

    try {
      setSavingPassword(true);

      await apiPost<ApiResponse>(
        "/auth/change-password",
        passwordForm,
      );

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });

      setOpenPasswordDialog(false);

      setSuccess(
        "Password changed successfully. Please log in again when your session expires.",
      );
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  // --------------------------------------------------
  // LOADING STATE
  // --------------------------------------------------

  if (loading) {
    return (
      <>
        <BreadcrumbComp title="User Profile" items={BCrumb} />

        <CardBox className="p-8">
          <div className="flex items-center justify-center gap-3 py-8">
            <Icon
              icon="eos-icons:loading"
              width="25"
              height="25"
            />

            <p className="text-sm text-gray-500">
              Loading your profile...
            </p>
          </div>
        </CardBox>
      </>
    );
  }

  // --------------------------------------------------
  // ERROR STATE
  // --------------------------------------------------

  if (!profile) {
    return (
      <>
        <BreadcrumbComp title="User Profile" items={BCrumb} />

        <CardBox className="p-6">
          <div className="text-center py-8">
            <Icon
              icon="solar:user-cross-rounded-linear"
              width="45"
              height="45"
              className="mx-auto mb-3 text-error"
            />

            <h5 className="card-title">
              Unable to load profile
            </h5>

            <p className="text-sm text-error mt-2">
              {error || "Please try again."}
            </p>

            <Button
              color="primary"
              className="mt-5"
              onClick={() => void fetchProfile()}
            >
              Try Again
            </Button>
          </div>
        </CardBox>
      </>
    );
  }

  // --------------------------------------------------
  // MAIN UI
  // --------------------------------------------------

  return (
    <>
      <BreadcrumbComp title="User Profile" items={BCrumb} />

      <div className="flex flex-col gap-6">

        {/* SUCCESS / ERROR MESSAGE */}

        {success && (
          <div className="rounded-lg border border-success bg-lightsuccess p-4 text-sm text-success">
            {success}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-error bg-lighterror p-4 text-sm text-error">
            {error}
          </div>
        )}

        {/* PROFILE HEADER */}

        <CardBox className="p-6 overflow-hidden">
          <div className="flex flex-col sm:flex-row items-center gap-6">

            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-lightprimary text-primary dark:bg-darkprimary">
              <Icon
                icon="solar:user-circle-bold"
                width="65"
                height="65"
              />
            </div>

            <div className="flex flex-wrap gap-4 justify-between items-center w-full">

              <div className="flex flex-col gap-2 sm:text-left text-center">

                <h5 className="card-title">
                  {profile.fullName}
                </h5>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {profile.email}
                </p>

                <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">

                  <span className="rounded-full bg-lightprimary px-3 py-1 text-xs font-medium text-primary">
                    {profile.role.toUpperCase()}
                  </span>

                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      profile.status === "active"
                        ? "bg-lightsuccess text-success"
                        : "bg-lighterror text-error"
                    }`}
                  >
                    {profile.status.toUpperCase()}
                  </span>

                </div>

              </div>

              <Button
                color="primary"
                className="flex items-center gap-2 rounded-md"
                onClick={handleOpenProfileDialog}
              >
                <Icon icon="ic:outline-edit" width="18" height="18" />
                Edit Profile
              </Button>

            </div>
          </div>
        </CardBox>

        {/* PROFILE DETAILS */}

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* PERSONAL INFORMATION */}

          <div className="space-y-6 rounded-xl border border-border md:p-6 p-4">

            <div className="flex items-center justify-between">
              <h5 className="card-title">
                Personal Information
              </h5>

              <Icon
                icon="solar:user-id-linear"
                width="25"
                height="25"
                className="text-primary"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Full Name
                </p>
                <p className="font-medium">
                  {profile.fullName}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Email Address
                </p>
                <p className="font-medium break-all">
                  {profile.email}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Phone Number
                </p>
                <p className="font-medium">
                  {profile.phone || "Not provided"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Employee ID
                </p>
                <p className="font-medium">
                  {profile.employeeId || "Not assigned"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Role
                </p>
                <p className="font-medium capitalize">
                  {profile.role}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Account Status
                </p>
                <p className="font-medium capitalize">
                  {profile.status}
                </p>
              </div>

            </div>

            <div className="flex justify-end">
              <Button
                color="primary"
                className="flex items-center gap-2 rounded-md"
                onClick={handleOpenProfileDialog}
              >
                <Icon icon="ic:outline-edit" width="18" height="18" />
                Edit Information
              </Button>
            </div>

          </div>

          {/* ACCOUNT INFORMATION */}

          <div className="space-y-6 rounded-xl border border-border md:p-6 p-4">

            <div className="flex items-center justify-between">
              <h5 className="card-title">
                Account Information
              </h5>

              <Icon
                icon="solar:settings-linear"
                width="25"
                height="25"
                className="text-primary"
              />
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Timezone
                </p>
                <p className="font-medium">
                  {profile.timezone || "Not provided"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Joining Date
                </p>
                <p className="font-medium">
                  {formatDate(profile.joiningDate)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Account Created
                </p>
                <p className="font-medium">
                  {formatDate(profile.createdAt)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Last Login
                </p>
                <p className="font-medium">
                  {formatDate(profile.lastLoginAt)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Invitation Accepted
                </p>
                <p className="font-medium">
                  {formatDate(profile.invitationAcceptedAt)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">
                  Password Last Changed
                </p>
                <p className="font-medium">
                  {formatDate(profile.passwordChangedAt)}
                </p>
              </div>

            </div>

            <div className="flex justify-end">
              <Button
                color="primary"
                className="flex items-center gap-2 rounded-md"
                onClick={() => {
                  setError("");
                  setSuccess("");
                  setOpenPasswordDialog(true);
                }}
              >
                <Icon
                  icon="solar:lock-password-linear"
                  width="18"
                  height="18"
                />
                Change Password
              </Button>
            </div>

          </div>

        </div>

      </div>

      {/* EDIT PROFILE DIALOG */}

      <Dialog
        open={openProfileDialog}
        onOpenChange={setOpenProfileDialog}
      >
        <DialogContent className="max-w-2xl">

          <DialogHeader>
            <DialogTitle>
              Edit Profile Information
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateProfile}>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mt-4">

              <div className="flex flex-col gap-2">
                <Label htmlFor="fullName">
                  Full Name
                </Label>

                <Input
                  id="fullName"
                  value={profileForm.fullName}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      fullName: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email">
                  Email Address
                </Label>

                <Input
                  id="email"
                  value={profile.email}
                  disabled
                />

                <p className="text-xs text-gray-500">
                  Email cannot be changed here.
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">
                  Phone Number
                </Label>

                <Input
                  id="phone"
                  value={profileForm.phone}
                  placeholder="Enter phone number"
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      phone: e.target.value,
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="employeeId">
                  Employee ID
                </Label>

                <Input
                  id="employeeId"
                  value={profileForm.employeeId}
                  placeholder="Enter employee ID"
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      employeeId: e.target.value,
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="timezone">
                  Timezone
                </Label>

                <Input
                  id="timezone"
                  value={profileForm.timezone}
                  placeholder="Asia/Kolkata"
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      timezone: e.target.value,
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="joiningDate">
                  Joining Date
                </Label>

                <Input
                  id="joiningDate"
                  type="date"
                  value={profileForm.joiningDate}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      joiningDate: e.target.value,
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="role">
                  Role
                </Label>

                <Input
                  id="role"
                  value={profile.role}
                  disabled
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="status">
                  Account Status
                </Label>

                <Input
                  id="status"
                  value={profile.status}
                  disabled
                />
              </div>

            </div>

            {error && (
              <p className="text-sm text-error mt-4">
                {error}
              </p>
            )}

            <DialogFooter className="flex gap-2 mt-6">

              <Button
                type="submit"
                color="primary"
                className="rounded-md"
                disabled={savingProfile}
              >
                {savingProfile ? "Saving..." : "Save Changes"}
              </Button>

              <Button
                type="button"
                color="lighterror"
                className="rounded-md bg-lighterror text-error hover:bg-error hover:text-white"
                onClick={() => setOpenProfileDialog(false)}
                disabled={savingProfile}
              >
                Cancel
              </Button>

            </DialogFooter>

          </form>

        </DialogContent>
      </Dialog>

      {/* CHANGE PASSWORD DIALOG */}

      <Dialog
        open={openPasswordDialog}
        onOpenChange={setOpenPasswordDialog}
      >
        <DialogContent className="max-w-lg">

          <DialogHeader>
            <DialogTitle>
              Change Password
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleChangePassword}>

            <div className="flex flex-col gap-4 mt-4">

              <div className="flex flex-col gap-2">
                <Label htmlFor="currentPassword">
                  Current Password
                </Label>

                <Input
                  id="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="newPassword">
                  New Password
                </Label>

                <Input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="confirmPassword">
                  Confirm New Password
                </Label>

                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <p className="text-xs text-gray-500">
                After changing your password, your existing refresh
                sessions will be revoked.
              </p>

            </div>

            {error && (
              <p className="text-sm text-error mt-4">
                {error}
              </p>
            )}

            <DialogFooter className="flex gap-2 mt-6">

              <Button
                type="submit"
                color="primary"
                className="rounded-md"
                disabled={savingPassword}
              >
                {savingPassword ? "Updating..." : "Update Password"}
              </Button>

              <Button
                type="button"
                color="lighterror"
                className="rounded-md bg-lighterror text-error hover:bg-error hover:text-white"
                onClick={() => setOpenPasswordDialog(false)}
                disabled={savingPassword}
              >
                Cancel
              </Button>

            </DialogFooter>

          </form>

        </DialogContent>
      </Dialog>

    </>
  );
};

export default UserProfile;
