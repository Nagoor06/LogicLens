import axios from "axios";

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").trim();
const inferredBaseUrl = import.meta.env.DEV ? "http://localhost:8000" : window.location.origin;
const API_BASE_URL = (configuredBaseUrl || inferredBaseUrl).replace(/\/$/, "");

const API = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
});

const responseCache = new Map();
const inflightRequests = new Map();
const reviewCache = new Map();

const CACHE_TTL_MS = {
  me: 30_000,
  history: 20_000,
  review: 120_000,
};

function getToken() {
  return localStorage.getItem("token") || "anon";
}

function getCacheKey(key) {
  return `${getToken()}:${key}`;
}

function getCachedValue(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.value;
}

function setCachedValue(key, value, ttlMs) {
  responseCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

async function withCachedRequest(cacheKey, ttlMs, requestFactory) {
  const cached = getCachedValue(cacheKey);
  if (cached) return cached;

  if (inflightRequests.has(cacheKey)) {
    return inflightRequests.get(cacheKey);
  }

  const request = requestFactory()
    .then((response) => setCachedValue(cacheKey, response, ttlMs))
    .finally(() => inflightRequests.delete(cacheKey));

  inflightRequests.set(cacheKey, request);
  return request;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function invalidateApiCache(scope = "all") {
  if (scope === "all") {
    responseCache.clear();
    inflightRequests.clear();
    reviewCache.clear();
    return;
  }

  const scopes = Array.isArray(scope) ? scope : [scope];
  for (const cacheKey of [...responseCache.keys()]) {
    if (scopes.some((item) => cacheKey.includes(`:${item}`))) {
      responseCache.delete(cacheKey);
    }
  }
  for (const requestKey of [...inflightRequests.keys()]) {
    if (scopes.some((item) => requestKey.includes(`:${item}`))) {
      inflightRequests.delete(requestKey);
    }
  }
  for (const reviewKey of [...reviewCache.keys()]) {
    if (scopes.some((item) => reviewKey.includes(`:${item}`))) {
      reviewCache.delete(reviewKey);
    }
  }
}

API.interceptors.request.use((req) => {
  const token = localStorage.getItem("token");
  if (token) {
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config || {};
    const shouldRetry = !error.response && !config.__retried && String(config.method || "").toLowerCase() === "get";

    if (shouldRetry) {
      config.__retried = true;
      return API(config);
    }

    return Promise.reject(error);
  }
);

export const getHistory = () => withCachedRequest(getCacheKey("history"), CACHE_TTL_MS.history, () => API.get("/history/"));
export const deleteHistoryEntry = async (sessionId) => {
  const response = await API.delete(`/history/${sessionId}`);
  invalidateApiCache("history");
  return response;
};
export const clearHistory = async () => {
  const response = await API.delete("/history/");
  invalidateApiCache("history");
  return response;
};
export const getMe = () => withCachedRequest(getCacheKey("me"), CACHE_TTL_MS.me, () => API.get("/me"));

export const loginUser = async (payload) => {
  const response = await API.post("/auth/login", payload);
  invalidateApiCache(["me", "history"]);
  return response;
};
export const registerUser = (payload) => API.post("/auth/register", payload);
export const googleLoginUser = async (payload) => {
  const response = await API.post("/auth/google", payload);
  invalidateApiCache(["me", "history"]);
  return response;
};
export const verifyEmailToken = (payload) => API.post("/auth/verify-email", payload);
export const resendVerificationEmail = (payload) => API.post("/auth/resend-verification", payload);
export const changePassword = (payload) => API.post("/auth/change-password", payload);
export const updateProfile = async (payload) => {
  const response = await API.put("/auth/profile", payload);
  invalidateApiCache("me");
  return response;
};

export async function streamReview(payload, handlers = {}) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 60000);
  const reviewKey = getCacheKey(`review:${stableStringify(payload)}`);
  const cachedReview = reviewCache.get(reviewKey);

  if (cachedReview && Date.now() <= cachedReview.expiresAt) {
    handlers.onStatus?.("Loaded from cache");
    handlers.onFinal?.(cachedReview.value);
    window.clearTimeout(timeoutId);
    return;
  }

  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${API_BASE_URL}/review/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok || !response.body) {
      const errorText = await response.text();
      throw new Error(errorText || "Streaming request failed");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const line = chunk.trim();
        if (!line.startsWith("data:")) continue;

        const payloadText = line.replace(/^data:\s*/, "");
        const event = JSON.parse(payloadText);

        if (event.type === "status") handlers.onStatus?.(event.content);
        if (event.type === "token") handlers.onToken?.(event.content);
        if (event.type === "final") {
          reviewCache.set(reviewKey, { value: event, expiresAt: Date.now() + CACHE_TTL_MS.review });
          invalidateApiCache("history");
          handlers.onFinal?.(event);
        }
        if (event.type === "error") handlers.onError?.(event.content);
      }
    }
  } finally {
    window.clearTimeout(timeoutId);
  }
}
