
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api/v1";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  auth?: boolean;
};

interface ApiErrorResponse {
  success?: boolean;
  message?: string;
  error?: string;
  errors?: Array<{
    field?: string;
    message?: string;
  }>;
}

interface RefreshResponse {
  success: boolean;
  message: string;
  data?: {
    accessToken: string;
    refreshToken: string;
    tokenType: "Bearer";
    expiresIn: string;
  };
}

interface InternalRequestResult {
  response: Response;
  data: unknown;
}

// Share one refresh operation between simultaneous API requests.
let refreshPromise: Promise<string> | null = null;

/**
 * Refresh the access token using the saved refresh token.
 *
 * The backend rotates refresh tokens, so both replacement tokens
 * must be saved after every successful refresh.
 */
async function refreshAccessToken(): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("Authentication is only available in the browser.");
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async (): Promise<string> => {
    const refreshToken = localStorage.getItem("refreshToken");

    if (!refreshToken) {
      throw new Error("Your session has expired. Please log in again.");
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
    });

    const responseText = await response.text();

    let data: RefreshResponse | ApiErrorResponse | null;

    try {
      data = responseText
        ? (JSON.parse(responseText) as
            | RefreshResponse
            | ApiErrorResponse)
        : null;
    } catch {
      data = null;
    }

    const refreshData = data as RefreshResponse | null;

    if (
      !response.ok ||
      !refreshData?.success ||
      !refreshData.data?.accessToken ||
      !refreshData.data?.refreshToken
    ) {
      const errorData = data as ApiErrorResponse | null;

      throw new Error(
        errorData?.message ||
          "Your session has expired. Please log in again.",
      );
    }

    // Save both tokens: the previous refresh token is now consumed.
    localStorage.setItem(
      "accessToken",
      refreshData.data.accessToken,
    );

    localStorage.setItem(
      "refreshToken",
      refreshData.data.refreshToken,
    );

    return refreshData.data.accessToken;
  })();

  try {
    return await refreshPromise;
  } catch (error) {
    // The refresh token cannot be used. Clear this session.
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");

    throw error;
  } finally {
    refreshPromise = null;
  }
}

/**
 * Send one HTTP request and parse its response.
 */
async function sendRequest(
  endpoint: string,
  options: ApiRequestOptions,
  accessToken?: string | null,
): Promise<InternalRequestResult> {
  const {
    auth = true,
    headers: customHeaders,
    body,
    ...requestOptions
  } = options;

  const headers = new Headers(customHeaders);

  if (auth && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let requestBody: BodyInit | undefined;

  if (body !== undefined && body !== null) {
    if (
      typeof body === "string" ||
      body instanceof FormData ||
      body instanceof URLSearchParams ||
      body instanceof Blob
    ) {
      requestBody = body as BodyInit;
    } else {
      headers.set("Content-Type", "application/json");
      requestBody = JSON.stringify(body);
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...requestOptions,
    headers,
    body: requestBody,
    cache: "no-store",
  });

  const responseText = await response.text();

  let data: unknown;

  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = responseText;
  }

  return { response, data };
}

/**
 * Convert an unsuccessful HTTP response into an ApiError.
 * Existing validation-error handling is preserved.
 */
function throwApiError(
  response: Response,
  data: unknown,
): never {
  const errorData = data as ApiErrorResponse | null;

  const validationMessages = errorData?.errors
    ?.map((item) => {
      if (item.field && item.message) {
        return `${item.field}: ${item.message}`;
      }

      return item.message || item.field || "";
    })
    .filter((message) => message.length > 0);

  const message =
    validationMessages && validationMessages.length > 0
      ? `${
          errorData?.message || "Request validation failed."
        } ${validationMessages.join(" ")}`
      : errorData?.message ||
        errorData?.error ||
        (typeof data === "string" && data.trim()
          ? data
          : `Request failed with status ${response.status}`);

  throw new ApiError(message, response.status, data);
}

/**
 * Main API request function.
 *
 * If an authenticated request fails because its access token is invalid
 * or expired, refresh the token and retry the original request once.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { auth = true } = options;

  let accessToken: string | null = null;

  if (auth && typeof window !== "undefined") {
    accessToken = localStorage.getItem("accessToken");
  }

  let result = await sendRequest(
    endpoint,
    options,
    accessToken,
  );

  if (
    auth &&
    result.response.status === 401 &&
    typeof window !== "undefined"
  ) {
    const errorData = result.data as ApiErrorResponse | null;
    const message = errorData?.message || "";

    const isAccessTokenError =
      /invalid or expired access token|invalid access token/i.test(
        message,
      );

    if (isAccessTokenError) {
      try {
        const newAccessToken = await refreshAccessToken();

        // Retry the original request exactly once.
        result = await sendRequest(
          endpoint,
          options,
          newAccessToken,
        );
      } catch (error) {
        if (error instanceof ApiError) {
          throw error;
        }

        throw new ApiError(
          error instanceof Error
            ? error.message
            : "Your session has expired. Please log in again.",
          401,
        );
      }
    }
  }

  if (!result.response.ok) {
    throwApiError(result.response, result.data);
  }

  return result.data as T;
}

/**
 * GET request.
 */
export function apiGet<T>(
  endpoint: string,
  auth = true,
): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: "GET",
    auth,
  });
}

/**
 * POST request.
 */
export function apiPost<T>(
  endpoint: string,
  body?: unknown,
  auth = true,
): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: "POST",
    body,
    auth,
  });
}

/**
 * PATCH request.
 */
export function apiPatch<T>(
  endpoint: string,
  body?: unknown,
  auth = true,
): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: "PATCH",
    body,
    auth,
  });
}

/**
 * DELETE request.
 */
export function apiDelete<T>(
  endpoint: string,
  auth = true,
): Promise<T> {
  return apiRequest<T>(endpoint, {
    method: "DELETE",
    auth,
  });
}
