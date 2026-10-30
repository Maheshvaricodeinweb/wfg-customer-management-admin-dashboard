"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Icon } from "@iconify/react/dist/iconify.js";
import CardBox from "../shared/CardBox";
import { ApexOptions } from "apexcharts";
import { apiGet } from "@/lib/api";

const Chart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
});

type Lead = {
  _id?: string;
  id?: string;
  statusId?: string | { _id?: string; id?: string; name?: string; color?: string };
  status?: string | { name?: string; color?: string };
  createdAt?: string;
};

type LeadsResponse = {
  success?: boolean;
  data?: {
    leads?: Lead[];
    pagination?: {
      totalPages?: number;
      total?: number;
    };
  };
  leads?: Lead[];
  pagination?: {
    totalPages?: number;
    total?: number;
  };
};

type StatusSummary = {
  name: string;
  count: number;
  color?: string;
};

function getLeadsResponse(response: LeadsResponse): {
  leads: Lead[];
  totalPages: number;
} {
  const data = response?.data;

  return {
    leads: data?.leads ?? response?.leads ?? [],
    totalPages:
      data?.pagination?.totalPages ??
      response?.pagination?.totalPages ??
      1,
  };
}

function getStatus(lead: Lead): { name: string; color?: string } {
  const statusValue = lead.statusId ?? lead.status;

  if (statusValue && typeof statusValue === "object") {
    return {
      name: statusValue.name || "Unknown",
      color: statusValue.color,
    };
  }

  return {
    name: typeof statusValue === "string" ? statusValue : "Unknown",
  };
}

const FALLBACK_COLORS = [
  "var(--color-primary)",
  "var(--color-lightprimary)",
  "var(--color-secondary)",
  "#13DEB9",
  "#FA896B",
  "#FFAE1F",
  "#539BFF",
];

const YearlyBreakup = () => {
  const [statuses, setStatuses] = useState<StatusSummary[]>([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchLeadStatuses = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const firstResponse = await apiGet<LeadsResponse>(
        "/leads?page=1&limit=100"
      );

      const firstPage = getLeadsResponse(firstResponse);
      const allLeads = [...firstPage.leads];

      for (let page = 2; page <= firstPage.totalPages; page += 1) {
        const response = await apiGet<LeadsResponse>(
          `/leads?page=${page}&limit=100`
        );

        allLeads.push(...getLeadsResponse(response).leads);
      }

      const statusMap = new Map<string, StatusSummary>();

      allLeads.forEach((lead) => {
        const status = getStatus(lead);
        const existing = statusMap.get(status.name);

        if (existing) {
          existing.count += 1;

          if (!existing.color && status.color) {
            existing.color = status.color;
          }
        } else {
          statusMap.set(status.name, {
            name: status.name,
            count: 1,
            color: status.color,
          });
        }
      });

      setStatuses(
        Array.from(statusMap.values()).sort((a, b) => b.count - a.count)
      );
      setTotalLeads(allLeads.length);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load lead status summary."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLeadStatuses();
  }, [fetchLeadStatuses]);

  const chartSeries = statuses.map((status) => status.count);

  const chartOptions: ApexOptions = {
    chart: {
      type: "donut",
      fontFamily: "inherit",
      foreColor: "#adb0bb",
      height: 200,
      offsetX: 18,
      toolbar: {
        show: false,
      },
    },
    plotOptions: {
      pie: {
        startAngle: 0,
        endAngle: 360,
        donut: {
          size: "75%",
        },
      },
    },
    stroke: {
      show: false,
    },
    dataLabels: {
      enabled: false,
    },
    legend: {
      show: false,
    },
    labels: statuses.map((status) => status.name),
    colors: statuses.map(
      (status, index) =>
        status.color || FALLBACK_COLORS[index % FALLBACK_COLORS.length]
    ),
    tooltip: {
      theme: "dark",
      y: {
        formatter: (value: number) => `${value} leads`,
      },
    },
    noData: {
      text: "No lead data available",
    },
  };

  return (
    <CardBox>
      <div className="grid grid-cols-12">
        <div className="col-span-7 flex flex-col md:col-span-6 lg:col-span-6">
          <div>
            <h5 className="card-title mb-4">Lead Status Summary</h5>

            <h4 className="mb-2 text-xl">
              {loading ? "Loading..." : totalLeads.toLocaleString("en-IN")}
            </h4>

            <div className="mb-3 flex items-center gap-2">
              <span className="flex items-center justify-center rounded-full bg-lightsuccess p-1 dark:bg-darksuccess">
                <Icon
                  icon="tabler:users"
                  className="text-success"
                />
              </span>

              <p className="mb-0 text-muted-foreground">
                {loading
                  ? "Fetching leads"
                  : `${statuses.length} lead statuses`}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {statuses.slice(0, 5).map((status, index) => (
              <div key={status.name} className="flex items-center">
                <Icon
                  icon="tabler:point-filled"
                  className="me-1 text-xl"
                  style={{
                    color:
                      status.color ||
                      FALLBACK_COLORS[index % FALLBACK_COLORS.length],
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {status.name} ({status.count})
                </span>
              </div>
            ))}
          </div>

          {error && (
            <div className="mt-3">
              <p className="mb-2 text-sm text-error">{error}</p>
              <button
                type="button"
                onClick={() => void fetchLeadStatuses()}
                className="text-sm text-primary underline"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && totalLeads === 0 && (
            <p className="mt-3 text-sm text-muted-foreground">
              No leads found yet.
            </p>
          )}
        </div>

        <div className="col-span-5 md:col-span-6 lg:col-span-6">
          <div className="flex justify-center">
            {!loading && statuses.length > 0 && (
              <Chart
                options={chartOptions}
                series={chartSeries}
                type="donut"
                height={200}
                width={180}
              />
            )}

            {loading && (
              <div className="flex h-[200px] items-center justify-center">
                <Icon
                  icon="tabler:loader-2"
                  className="animate-spin text-2xl text-primary"
                />
              </div>
            )}

            {!loading && !error && statuses.length === 0 && (
              <div className="flex h-[200px] items-center justify-center text-center text-sm text-muted-foreground">
                No chart data
              </div>
            )}
          </div>
        </div>
      </div>
    </CardBox>
  );
};

export { YearlyBreakup };