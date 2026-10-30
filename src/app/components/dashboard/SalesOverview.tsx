"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import CardBox from "../shared/CardBox";
import { apiGet } from "@/lib/api";
import type { ApexOptions } from "apexcharts";

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

interface LeadStatus {
  _id?: string;
  name?: string;
  color?: string;
}

interface Lead {
  _id: string;
  statusId?: LeadStatus | string | null;
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

interface StatusSummary {
  name: string;
  color: string;
  count: number;
}

const DEFAULT_COLORS = [
  "#5D87FF",
  "#49BEFF",
  "#13DEB9",
  "#FFAE1F",
  "#FA896B",
  "#8965E5",
  "#E85D9E",
  "#7C8FAC",
];

const SalesOverview: React.FC = () => {
  const [statuses, setStatuses] = useState<StatusSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadLeadStatuses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const firstPage = await apiGet<LeadsResponse>(
        "/leads?page=1&limit=100",
      );

      const allLeads: Lead[] = [...(firstPage.data?.leads ?? [])];

      const totalPages = firstPage.data?.pagination?.totalPages ?? 1;

      for (let page = 2; page <= totalPages; page += 1) {
        const response = await apiGet<LeadsResponse>(
          `/leads?page=${page}&limit=100`,
        );

        allLeads.push(...(response.data?.leads ?? []));
      }

      const counts = new Map<
        string,
        {
          name: string;
          color: string;
          count: number;
        }
      >();

      for (const lead of allLeads) {
        const status = lead.statusId;

        let statusName = "Unspecified";
        let statusColor = "#7C8FAC";

        if (status && typeof status === "object") {
          statusName = status.name || "Unspecified";
          statusColor = status.color || "#7C8FAC";
        } else if (typeof status === "string" && status.trim()) {
          statusName = "Other status";
        }

        const existing = counts.get(statusName);

        if (existing) {
          existing.count += 1;
        } else {
          counts.set(statusName, {
            name: statusName,
            color: statusColor,
            count: 1,
          });
        }
      }

      const summary = Array.from(counts.values()).sort(
        (a, b) => b.count - a.count,
      );

      setStatuses(summary);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load lead status analytics.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLeadStatuses();
  }, [loadLeadStatuses, refreshKey]);

  const colors = statuses.map(
    (status, index) =>
      status.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
  );

  const chartOptions: ApexOptions = {
    chart: {
      type: "bar",
      toolbar: {
        show: false,
      },
      fontFamily: "inherit",
      foreColor: "#7C8FAC",
    },
    colors,
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 5,
        barHeight: "55%",
        distributed: true,
      },
    },
    dataLabels: {
      enabled: true,
      formatter: (value) => String(value),
      style: {
        fontSize: "12px",
        fontWeight: 600,
      },
    },
    legend: {
      show: false,
    },
    grid: {
      borderColor: "rgba(0,0,0,0.1)",
      strokeDashArray: 3,
    },
    xaxis: {
      categories: statuses.map((status) => status.name),
      min: 0,
      title: {
        text: "Number of leads",
      },
      labels: {
        formatter: (value) => String(Math.round(Number(value))),
      },
    },
    yaxis: {
      labels: {
        maxWidth: 150,
      },
    },
    tooltip: {
      theme: "dark",
      y: {
        formatter: (value) =>
          `${value} lead${value === 1 ? "" : "s"}`,
      },
    },
    noData: {
      text: "No leads available",
    },
  };

  const totalLeads = statuses.reduce(
    (total, status) => total + status.count,
    0,
  );

  return (
    <CardBox className="pb-0 h-full w-full">
      <div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h5 className="card-title">Lead Status Distribution</h5>
          <p className="text-sm font-normal text-muted-foreground">
            Actual leads grouped by their current status
          </p>
        </div>

        <button
          type="button"
          onClick={() => setRefreshKey((current) => current + 1)}
          disabled={loading}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh Data"}
        </button>
      </div>

      {loading ? (
        <div className="flex h-[316px] items-center justify-center text-sm text-muted-foreground">
          Loading lead analytics...
        </div>
      ) : error ? (
        <div className="flex h-[316px] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-red-500">{error}</p>

          <button
            type="button"
            onClick={() => setRefreshKey((current) => current + 1)}
            className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          >
            Try Again
          </button>
        </div>
      ) : statuses.length === 0 ? (
        <div className="flex h-[316px] flex-col items-center justify-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            No leads available to display.
          </p>

          <p className="text-xs text-muted-foreground">
            Create a lead to see the status distribution.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 text-sm text-muted-foreground">
            Total leads analyzed:{" "}
            <span className="font-semibold text-foreground">
              {totalLeads}
            </span>
          </div>

          <Chart
            options={chartOptions}
            series={[
              {
                name: "Leads",
                data: statuses.map((status) => status.count),
              },
            ]}
            type="bar"
            height={Math.max(316, statuses.length * 55)}
            width="100%"
          />

          <div className="mb-5 mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {statuses.map((status, index) => (
              <div
                key={status.name}
                className="flex items-center justify-between rounded-lg border border-border p-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        status.color ||
                        DEFAULT_COLORS[index % DEFAULT_COLORS.length],
                    }}
                  />

                  <span className="truncate text-sm font-medium">
                    {status.name}
                  </span>
                </div>

                <span className="ml-3 text-sm font-semibold">
                  {status.count}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </CardBox>
  );
};

export default SalesOverview;