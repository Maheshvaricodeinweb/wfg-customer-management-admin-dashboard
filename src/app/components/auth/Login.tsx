"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import FullLogo from "@/app/(DashboardLayout)/layout/shared/logo/FullLogo";
import CardBox from "../shared/CardBox";

import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { apiPost } from "@/lib/api";

interface AuthenticatedUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  status: string;
  timezone: string;
}

interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    accessToken: string;
    refreshToken: string;
    tokenType: "Bearer";
    expiresIn: string;
    user: AuthenticatedUser;
  };
}

export const Login = () => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberDevice, setRememberDevice] = useState(true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const response = await apiPost<LoginResponse>(
        "/auth/login",
        {
          email: email.trim(),
          password,
        },
        false,
      );

      if (!response.success || !response.data) {
        throw new Error(response.message || "Unable to log in.");
      }

      const { accessToken, refreshToken, user } = response.data;

      // Temporary debugging: check token presence without exposing token values.
      console.log("Login token check:", {
        hasAccessToken: Boolean(accessToken),
        hasRefreshToken: Boolean(refreshToken),
      });

      // Validate the login response before saving authentication data.
      if (!accessToken || !refreshToken) {
        throw new Error(
          "Login response is missing an authentication token. Please check the backend login response.",
        );
      }

      if (!user || user.role?.toLowerCase() !== "admin") {
        throw new Error(
          "Administrator access is required. Please use an administrator account.",
        );
      }

      // Save authentication information in the browser.
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("user", JSON.stringify(user));

      // Confirm that both tokens were saved without printing their values.
      console.log("Login storage check:", {
        hasAccessToken: Boolean(localStorage.getItem("accessToken")),
        hasRefreshToken: Boolean(localStorage.getItem("refreshToken")),
      });

      // Remember-device is a UI preference for now.
      // It does not extend the backend token expiry.
      if (rememberDevice) {
        localStorage.setItem("rememberDevice", "true");
      } else {
        localStorage.removeItem("rememberDevice");
      }

      // Open the dashboard.
      router.replace("/");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex justify-center items-center bg-lightprimary px-4 py-8">
      <div className="w-full max-w-[450px]">
        <CardBox>
          <div className="flex justify-center mb-4">
            <FullLogo />
          </div>

          <h1 className="text-2xl font-semibold text-center mb-2">
            Admin Login
          </h1>

          <p className="text-sm text-muted-foreground text-center mb-6">
            Sign in to manage your leads, customers and users.
          </p>

          <form onSubmit={handleLogin}>
            {/* Email */}
            <div className="mb-5">
              <Label htmlFor="email" className="font-medium">
                Email Address
              </Label>

              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                required
                disabled={loading}
                className="mt-2"
              />
            </div>

            {/* Password */}
            <div className="mb-5">
              <Label htmlFor="password" className="font-medium">
                Password
              </Label>

              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
                className="mt-2"
              />
            </div>

            {/* Error message */}
            {error && (
              <div
                role="alert"
                className="mb-5 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* Remember device */}
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberDevice}
                  onCheckedChange={(checked) =>
                    setRememberDevice(checked === true)
                  }
                  disabled={loading}
                />

                <Label
                  htmlFor="remember"
                  className="text-sm font-normal cursor-pointer"
                >
                  Remember this device
                </Label>
              </div>

              <Link
                href="/auth/forgot-password"
                className="text-sm font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit */}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="text-sm text-muted-foreground text-center mt-6">
            Access is managed by your system administrator.
          </p>
        </CardBox>
      </div>
    </div>
  );
};