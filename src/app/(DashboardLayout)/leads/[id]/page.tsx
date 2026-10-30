"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Clock,
  Mail,
  Phone,
  RefreshCw,
  Tag,
  UserRound,
} from "lucide-react";

import { apiGet } from "@/lib/api";

interface Lead {
  _id: string;
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  statusId?: {
    _id?: string;
    name?: string;
    color?: string;
  } | string | null;
  sourceId?: {
    _id?: string;
    name?: string;
  } | string | null;
  ownerId?: {
    _id?: string;
    fullName?: string;
    email?: string;
  } | string | null;
  tags?: Array<
    | string
    | {
        _id?: string;
        name?: string;
      }
  >;
  lostReasonId?: {
    _id?: string;
    name?: string;
  } | string | null;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
}

interface LeadResponse {
  success: boolean;
  message?: string;
  data?: {
    lead?: Lead;
  };
}

function getName(
  value:
    | { name?: string; fullName?: string; email?: string }
    | string
    | null
    | undefined
) {
  if (!value) return "Not assigned";
  if (typeof value === "string") return value;
  return value.name || value.fullName || value.email || "Not available";
}

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function DetailItem({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-gray-500">{label}</p>
        <div className="mt-1 break-words text-sm font-medium text-gray-900">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function LeadDetailsPage() {
  const params = useParams<{ id: string }>();
  const leadId = params.id;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLead = useCallback(async () => {
    if (!leadId) return;

    setLoading(true);
    setError("");

    try {
      const response = await apiGet<LeadResponse>(`/leads/${leadId}`);

      if (!response?.data?.lead) {
        throw new Error("The lead details could not be found.");
      }

      setLead(response.data.lead);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load lead details."
      );
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    void loadLead();
  }, [loadLead]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-3 text-sm text-gray-500">
            Loading lead details...
          </p>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="mx-auto w-full max-w-5xl p-4 sm:p-6 lg:p-8">
        <Link
          href="/leads"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <ArrowLeft size={18} />
          Back to Leads
        </Link>

        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <h2 className="font-semibold text-red-800">
            Unable to load lead
          </h2>
          <p className="mt-2 break-words text-sm text-red-700">
            {error || "Lead not found."}
          </p>

          <button
            onClick={() => void loadLead()}
            className="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const statusName = getName(lead.statusId);
  const sourceName = getName(lead.sourceId);
  const ownerName = getName(lead.ownerId);

  const statusColor =
    typeof lead.statusId === "object" && lead.statusId
      ? lead.statusId.color
      : undefined;

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-6 lg:p-8">
      {/* Page header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/leads"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            <ArrowLeft size={18} />
            Back to Leads
          </Link>

          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">
            Lead Details
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            View the contact information and current status of this lead.
          </p>
        </div>

        <button
          onClick={() => void loadLead()}
          className="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:self-auto"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Lead summary */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-gray-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-xl font-bold text-blue-700">
              {lead.name?.trim().charAt(0).toUpperCase() || "L"}
            </div>

            <div className="min-w-0">
              <h2 className="break-words text-xl font-bold text-gray-900">
                {lead.name}
              </h2>
              <p className="mt-1 break-words text-sm text-gray-500">
                {lead.company || "No company provided"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium"
              style={
                statusColor
                  ? {
                      color: statusColor,
                      backgroundColor: `${statusColor}18`,
                    }
                  : undefined
              }
            >
              <span
                className={`mr-2 h-2 w-2 rounded-full ${
                  statusColor ? "" : "bg-blue-500"
                }`}
                style={statusColor ? { backgroundColor: statusColor } : undefined}
              />
              {statusName}
            </span>

            {lead.archivedAt && (
              <span className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600">
                Archived
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          <DetailItem icon={<UserRound size={19} />} label="Lead Name">
            {lead.name}
          </DetailItem>

          <DetailItem icon={<Building2 size={19} />} label="Company">
            {lead.company || "Not provided"}
          </DetailItem>

          <DetailItem icon={<Mail size={19} />} label="Email Address">
            {lead.email ? (
              <a
                href={`mailto:${lead.email}`}
                className="text-blue-600 hover:underline"
              >
                {lead.email}
              </a>
            ) : (
              "Not provided"
            )}
          </DetailItem>

          <DetailItem icon={<Phone size={19} />} label="Phone Number">
            {lead.phone ? (
              <a
                href={`tel:${lead.phone}`}
                className="text-blue-600 hover:underline"
              >
                {lead.phone}
              </a>
            ) : (
              "Not provided"
            )}
          </DetailItem>

          <DetailItem icon={<Tag size={19} />} label="Lead Source">
            {sourceName}
          </DetailItem>

          <DetailItem icon={<UserRound size={19} />} label="Assigned To">
            {ownerName}
          </DetailItem>
        </div>
      </div>

      {/* Additional information */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Tags & Classification
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Additional labels and classification for this lead.
          </p>

          <div className="mt-5">
            <p className="mb-2 text-sm font-medium text-gray-700">Tags</p>

            {lead.tags && lead.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {lead.tags.map((tag, index) => {
                  const tagName =
                    typeof tag === "string" ? tag : tag.name || tag._id || "Tag";

                  return (
                    <span
                      key={typeof tag === "string" ? tag : tag._id || index}
                      className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700"
                    >
                      {tagName}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No tags added.</p>
            )}
          </div>

          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700">Lost Reason</p>
            <p className="mt-2 text-sm text-gray-600">
              {getName(lead.lostReasonId)}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-gray-900">
            Record Information
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Creation and last-update timestamps.
          </p>

          <div className="mt-5 space-y-4">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Created At</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatDate(lead.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Last Updated</p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatDate(lead.updatedAt)}
                </p>
              </div>
            </div>

            {lead.archivedAt && (
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Archived At</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {formatDate(lead.archivedAt)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Footer navigation */}
      <div className="mt-6 flex justify-start">
        <Link
          href="/leads"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <ArrowLeft size={16} />
          Back to All Leads
        </Link>
      </div>
    </div>
  );
}