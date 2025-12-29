// lib/requireAdmin.js
import { parse } from "cookie";

/**
 * Reads bmtt_teacher cookie and enforces admin role.
 * Returns { ok:true, teacher } or { ok:false, status, error }.
 */
export function requireAdmin(req) {
  try {
    const cookies = parse(req.headers?.cookie || "");
    const raw = cookies.bmtt_teacher;
    if (!raw) {
      return { ok: false, status: 401, error: "Not logged in" };
    }

    let teacher;
    try {
      teacher = JSON.parse(raw);
    } catch (e) {
      return { ok: false, status: 401, error: "Invalid login cookie" };
    }

    const role = teacher?.role;
    if (role !== "admin") {
      return { ok: false, status: 403, error: "Admin only" };
    }

    return { ok: true, teacher };
  } catch (e) {
    return { ok: false, status: 500, error: "Auth check failed" };
  }
}

// ALSO export default for safety (prevents future import mismatches)
export default requireAdmin;
