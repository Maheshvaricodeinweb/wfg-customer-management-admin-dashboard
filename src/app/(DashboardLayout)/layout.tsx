"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import Header from "./layout/header/Header";
import Sidebar from "./layout/sidebar/Sidebar";

interface AuthenticatedUser {
  id?: string;
  fullName?: string;
  email?: string;
  role?: string;
  status?: string;
}

export default function Layout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const router = useRouter();

  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuthentication = () => {
      try {
        const accessToken = localStorage.getItem("accessToken");
        const savedUser = localStorage.getItem("user");

        // No saved login information: send the visitor to login.
        if (!accessToken || !savedUser) {
          router.replace("/auth/login");
          return;
        }

        // Read the saved user information.
        const user = JSON.parse(savedUser) as AuthenticatedUser;

        // Only administrators can use this dashboard.
        if (
          !user ||
          typeof user !== "object" ||
          user.role?.toLowerCase() !== "admin"
        ) {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");

          router.replace("/auth/login");
          return;
        }

        // Login information exists and the saved role is admin.
        setIsAuthenticated(true);
      } catch {
        // Invalid saved user information: clear it and redirect.
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");

        router.replace("/auth/login");
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuthentication();
  }, [router]);

  // Show a loading screen while checking authentication.
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />

          <p className="text-sm text-muted-foreground">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  // Do not render the dashboard while redirecting.
  if (!isAuthenticated) {
    return null;
  }

  // Display the original dashboard after authentication succeeds.
  return (
    <div className="flex min-h-screen w-full">
      <div className="page-wrapper flex w-full">
        {/* Sidebar */}
        <div className="hidden xl:block">
          <Sidebar />
        </div>

        {/* Main dashboard area */}
        <div className="body-wrapper w-full bg-background">
          {/* Top header */}
          <Header />

          {/* Dashboard page content */}
          <div className="container mx-auto px-6 py-30">
            {children}
          </div>
        </div>
      </div>

      {/* Original Vercel button */}
      <a
        href="#!"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2.5 rounded-full border border-border bg-black px-5 py-2.5 text-white shadow-2xl transition-all duration-200 hover:scale-105 hover:bg-black/90 active:scale-95"
      >
        <svg
          viewBox="0 0 76 65"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4 fill-white"
        >
          <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
        </svg>

        <span className="text-sm font-semibold tracking-tight">
          Deploy to Vercel
        </span>
      </a>
    </div>
  );
}