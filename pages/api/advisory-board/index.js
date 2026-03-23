import { supabaseServer } from "../../../lib/supabaseServer";
import { requireRole } from "../../../lib/adminAuth";

function getToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length);
}

function normalizeOptional(value) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

async function getNextOrderIndex(section) {
  const { data, error } = await supabaseServer
    .from("advisory_board")
    .select("order_index")
    .eq("section", section)
    .order("order_index", { ascending: false })
    .limit(1);

  if (error) throw error;

  const max =
    Array.isArray(data) && data[0]?.order_index ? data[0].order_index : 0;

  return (max ?? 0) + 1;
}

export default async function handler(req, res) {
  if (!["POST", "DELETE", "PATCH"].includes(req.method || "")) {
    res.setHeader("Allow", "POST, DELETE, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Enforce auth because this endpoint uses the service role key.
  const auth = await requireRole(req, res, ["admin", "editor"]);
  if (!auth) return;

  try {
    if (req.method === "POST") {
      const {
        id,
        create,
        section,
        name,
        degrees,
        department,
        institution,
        location,
        email,
        order_index,
      } = req.body || {};

      if (!section || !name) {
        return res
          .status(400)
          .json({ error: "Missing required fields: section, name" });
      }

      const payload = {
        section,
        name,
        degrees: normalizeOptional(degrees),
        department: normalizeOptional(department),
        institution: normalizeOptional(institution),
        location: normalizeOptional(location),
        email: normalizeOptional(email),
      };

      if (order_index != null) {
        payload.order_index = order_index;
      }

      if (id && !create) {
        const { data, error } = await supabaseServer
          .from("advisory_board")
          .update(payload)
          .eq("id", id)
          .select();

        if (error) throw error;
        const member = Array.isArray(data) ? data[0] : data;
        return res.status(200).json({ ok: true, member });
      }

      const finalOrder = payload.order_index ?? (await getNextOrderIndex(section));
      const insertRow = {
        ...payload,
        active: true,
        order_index: finalOrder,
      };
      if (id) {
        insertRow.id = id;
      }
      const { data, error } = await supabaseServer
        .from("advisory_board")
        .insert(insertRow)
        .select();

      if (error) throw error;
      const member = Array.isArray(data) ? data[0] : data;
      return res.status(200).json({ ok: true, member });
    }

    if (req.method === "DELETE") {
      const { id } = req.body || {};
      if (!id) {
        return res.status(400).json({ error: "Missing id" });
      }

      const { error } = await supabaseServer
        .from("advisory_board")
        .update({ active: false })
        .eq("id", id);

      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (req.method === "PATCH") {
      const { action, section, newSection } = req.body || {};

      if (action === "rename_section") {
        const from = String(section || "").trim();
        const to = String(newSection || "").trim();
        if (!from || !to) {
          return res
            .status(400)
            .json({ error: "Missing section or newSection" });
        }

        const { error } = await supabaseServer
          .from("advisory_board")
          .update({ section: to })
          .eq("section", from)
          .eq("active", true);

        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      if (action === "delete_section") {
        const target = String(section || "").trim();
        if (!target) {
          return res.status(400).json({ error: "Missing section" });
        }

        const { error } = await supabaseServer
          .from("advisory_board")
          .update({ active: false })
          .eq("section", target)
          .eq("active", true);

        if (error) throw error;
        return res.status(200).json({ ok: true });
      }

      return res.status(400).json({ error: "Invalid action" });
    }
  } catch (err) {
    return res
      .status(500)
      .json({ error: err?.message || "Unexpected error", ok: false });
  }
}
