export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<{ data: T; meta?: any }> {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  if (!headers["Content-Type"] && typeof window !== "undefined" && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  } else if (!headers["Content-Type"] && typeof window === "undefined" && options.body && typeof options.body === "string") {
     headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const baseUrl = typeof window !== "undefined" 
    ? "" // Klientské prostredie: použije relatívnu cestu k rovnakému origin (localhost:3001)
    : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001");
    
  const fullUrl = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  let json;
  try {
    json = await response.json();
  } catch (err) {
    throw new Error("Failed to parse JSON response");
  }

  // Handle errors: if success is false or response not ok
  if (!response.ok || (json && json.success === false)) {
    const errorMessage = typeof json.error === 'string' 
      ? json.error 
      : (json.error?.message || json.message || "API request failed");
    throw new Error(errorMessage);
  }

  // The new backend envelope wraps payload in `data` and sometimes `meta`
  if (json && json.success === true && json.data !== undefined) {
    return { data: json.data, meta: json.meta };
  }

  // Fallback in case endpoint wasn't updated to envelope yet
  return { data: json as any };
}
