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

type DailyActivity = {
  label: string;
  dateKey: string;
  count: number;
};

function getLeadsResponse(response: LeadsResponse): {
  leads: Lead[];
  totalPages: number;
} {
  return {
    leads: response?.data?.leads ?? response?.leads ?? [],
    totalPages:
      response?.data?.pagination?.totalPages ??
      response?.pagination?.totalPages ??
      1,
  };
}

function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

const MonthlyEarning = () => {
  const [activity, setActivity] = useState<DailyActivity[]>([]);
  const [totalCreated, setTotalCreated] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchRecentActivity = useCallback(async () => {
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

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const dailyActivity: DailyActivity[] = [];

      for (let daysAgo = 6; daysAgo >= 0; daysAgo -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - daysAgo);

        dailyActivity.push({
          label: date.toLocaleDateString("en-IN", {
            weekday: "short",
          }),
          dateKey: getLocalDateKey(date),
          count: 0,
        });
      }

      const activityByDate = new Map(
        dailyActivity.map((day) => [day.dateKey, day])
      );

      allLeads.forEach((lead) => {
        if (!lead.createdAt) {
          return;
        }

        const createdDate = new Date(lead.createdAt);

        if (Number.isNaN(createdDate.getTime())) {
          return;
        }

        const dateKey = getLocalDateKey(createdDate);
        const day = activityByDate.get(dateKey);

        if (day) {
          day.count += 1;
        }
      });

      setActivity(dailyActivity);
      setTotalCreated(
        dailyActivity.reduce((total, day) => total + day.count, 0)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load recent lead activity."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRecentActivity();
  }, [fetchRecentActivity]);

  const chartSeries = [
    {
      name: "Leads created",
      data: activity.map((day) => day.count),
    },
  ];

  const chartOptions: ApexOptions = {
    chart: {
      id: "recent-lead-activity",
      type: "area",
      height: 60,
      sparkline: {
        enabled: true,
      },
      fontFamily: "inherit",
      foreColor: "#adb0bb",
      toolbar: {
        show: false,
      },
    },
    stroke: {
      curve: "smooth",
      width: 2,
    },
    fill: {
      type: "gradient",
      gradient: {
        shadeIntensity: 0,
        inverseColors: false,
        opacityFrom: 0.2,
        opacityTo: 0,
        stops: [20, 100],
      },
    },
    markers: {
      size: 0,
    },
    colors: ["var(--color-secondary)"],
    tooltip: {
      theme: "dark",
      x: {
        show: true,
        formatter: (_value: number, options?: { dataPointIndex?: number }) => {
          const index = options?.dataPointIndex ?? 0;
          return activity[index]?.label ?? "";
        },
      },
      y: {
        formatter: (value: number) =>
          `${value} ${value === 1 ? "lead" : "leads"}`,
      },
    },
    noData: {
      text: "No activity data available",
    },
  };

  return (
    <CardBox className="p-0! mt-0">
      <div className="px-6 pt-6">
        <div className="mb-2 flex items-center justify-between">
          <h5 className="card-title mb-0">Recent Lead Activity</h5>

          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary text-white">
            <Icon icon="tabler:chart-line" className="text-xl" />
          </div>
        </div>

        <div className="mb-4 grid grid-cols-12 gap-6">
          <div className="col-span-8 md:col-span-8 lg:col-span-8">
            <h4 className="mb-3 text-xl">
              {loading ? "Loading..." : totalCreated.toLocaleString("en-IN")}
            </h4>

            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center rounded-full bg-lightsuccess p-1 dark:bg-darksuccess">
                <Icon icon="tabler:calendar" className="text-success" />
              </span>

              <p className="mb-0 text-muted-foreground">
                Leads created in the last 7 days
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-3">
            <p className="mb-2 text-sm text-error">{error}</p>

            <button
              type="button"
              onClick={() => void fetchRecentActivity()}
              className="text-sm text-primary underline"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <div className="min-h-[60px]">
        {!loading && !error && (
          <Chart
            options={chartOptions}
            series={chartSeries}
            type="area"
            height={60}
            width="100%"
          />
        )}

        {loading && (
          <div className="flex h-[60px] items-center justify-center">
            <Icon
              icon="tabler:loader-2"
              className="animate-spin text-xl text-primary"
            />
          </div>
        )}
      </div>

      {!loading && !error && (
        <div className="flex justify-between px-6 pb-4 pt-2">
          {activity.map((day) => (
            <div
              key={day.dateKey}
              className="text-center text-xs text-muted-foreground"
              title={`${day.count} leads created`}
            >
              <div className="font-medium">{day.label}</div>
              <div>{day.count}</div>
            </div>
          ))}
        </div>
      )}
    </CardBox>
  );
};

export { MonthlyEarning };