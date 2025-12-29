// lib/requireAdmin.js

function getCookieValue(cookieHeader, name) {
  if (!cookieHeader) return null;

  // cookieHeader is like: "a=1; bmtt_teacher=%7B...%7D; b=2"
  const parts = String(cookieHeader).split(";");

  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) {
      const v = rest.join("=");
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return null;
}

/**
 * Reads bmtt_teacher cookie and enforces admin role.
 * Returns { ok:true, teacher } or { ok:false, status, error }.
 */
export function requireAdmin(req) {
  try {
    const cookieHeader = req.headers?.cookie || "";
    const raw = getCookieValue(cookieHeader, "bmtt_teacher");

    if (!raw) {
      return { ok: false, status: 401, error: "Not logged in" };
    }

    let teacher;
    try {
      teacher = JSON.parse(raw);
    } catch (e) {
      return { ok: false, status: 401, error: "Invalid login cookie" };
    }

    if (teacher?.role !== "admin") {
      return { ok: false, status: 403, error: "Admin only" };
    }

    return { ok: true, teacher };
  } catch (e) {
    return { ok: false, status: 500, error: "Auth check failed" };
  }
}

// Also export default for safety
export default requireAdmin;
