"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

import CardBox from "../shared/CardBox";
import { apiGet } from "@/lib/api";

interface Lead {
  _id: string;
  ownerId:
    | string
    | {
        _id?: string;
        fullName?: string;
        email?: string;
      }
    | null;
}

interface LeadsResponse {
  success: boolean;
  message?: string;
  data: {
    leads: Lead[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

interface UsersResponse {
  success: boolean;
  message?: string;
  data: {
    users: unknown[];
    pagination: {
      currentPage: number;
      limit: number;
      totalUsers: number;
      totalPages: number;
    };
  };
}

interface DashboardStats {
  totalLeads: number;
  activeUsers: number;
  assignedLeads: number;
  unassignedLeads: number;
}

const initialStats: DashboardStats = {
  totalLeads: 0,
  activeUsers: 0,
  assignedLeads: 0,
  unassignedLeads: 0,
};

const cardInfo = [
  {
    key: "totalLeads",
    title: "Total Leads",
    image: "/images/svgs/icon-connect.svg",
    color: "text-primary",
    background: "bg-primary/10 dark:bg-lightprimary",
    href: "/leads",
  },
  {
    key: "activeUsers",
    title: "Active Users",
    image: "/images/svgs/icon-user-male.svg",
    color: "text-success",
    background: "bg-success/10 dark:bg-success/10",
    href: "/users",
  },
  {
    key: "assignedLeads",
    title: "Assigned Leads",
    image: "/images/svgs/icon-briefcase.svg",
    color: "text-info",
    background: "bg-info/10 dark:bg-info/10",
    href: "/leads",
  },
  {
    key: "unassignedLeads",
    title: "Unassigned Leads",
    image: "/images/svgs/icon-mailbox.svg",
    color: "text-warning",
    background: "bg-warning/10 dark:bg-warning/10",
    href: "/leads",
  },
] as const;

export const TopCards = () => {
  const [stats, setStats] = useState<DashboardStats>(initialStats);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboardStats = useCallback(async () => {
    setError("");
    setRefreshing(true);

    try {
      // Request the first page to obtain the total lead count
      // and the number of pages available.
      const firstPage = await apiGet<LeadsResponse>(
        "/leads?page=1&limit=100",
      );

      const totalLeads = firstPage.data.pagination.total;
      const totalPages = firstPage.data.pagination.totalPages;

      let allLeads = [...firstPage.data.leads];

      // Retrieve the remaining pages so that assigned and
      // unassigned counts cover the complete lead collection.
      for (let page = 2; page <= totalPages; page += 1) {
        const result = await apiGet<LeadsResponse>(
          `/leads?page=${page}&limit=100`,
        );

        allLeads = allLeads.concat(result.data.leads);
      }

      // Ask the backend for the total number of active users.
      // A limit of 1 is sufficient because the API returns
      // the total count in its pagination metadata.
      const usersResult = await apiGet<UsersResponse>(
        "/admin/users?page=1&limit=1&status=active",
      );

      const assignedLeads = allLeads.filter((lead) => {
        if (!lead.ownerId) {
          return false;
        }

        if (typeof lead.ownerId === "string") {
          return lead.ownerId.trim().length > 0;
        }

        return Boolean(lead.ownerId._id);
      }).length;

      setStats({
        totalLeads,
        activeUsers: usersResult.data.pagination.totalUsers,
        assignedLeads,
        unassignedLeads: Math.max(totalLeads - assignedLeads, 0),
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to load dashboard statistics.";

      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboardStats();
  }, [loadDashboardStats]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h5 className="card-title">Lead Management Overview</h5>
          <p className="text-sm text-muted-foreground">
            A summary of your current leads and users.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadDashboardStats()}
          disabled={refreshing}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-lightprimary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span
            className={refreshing ? "animate-spin" : ""}
            aria-hidden="true"
          >
            ↻
          </span>
          {refreshing ? "Refreshing..." : "Refresh Data"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-lg border border-error/30 bg-error/5 px-4 py-3"
        >
          <p className="text-sm font-medium text-error">
            Could not load dashboard statistics.
          </p>

          <p className="mt-1 text-sm text-muted-foreground">{error}</p>

          <button
            type="button"
            onClick={() => void loadDashboardStats()}
            className="mt-2 text-sm font-semibold text-primary hover:underline"
          >
            Try again
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cardInfo.map((item) => {
          const value = stats[item.key];

          return (
            <Link
              key={item.key}
              href={item.href}
              className="block rounded-xl transition hover:-translate-y-0.5"
            >
              <CardBox className="h-full w-full border-none! shadow-none">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl ${item.background}`}
                  >
                    <Image
                      src={item.image}
                      width={36}
                      height={36}
                      alt=""
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      {item.title}
                    </p>

                    <h4
                      className={`mt-1 text-2xl font-bold ${item.color}`}
                    >
                      {loading ? "..." : value.toLocaleString("en-IN")}
                    </h4>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {loading ? "Loading data..." : "Live backend data"}
                    </p>
                  </div>
                </div>
              </CardBox>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default TopCards;