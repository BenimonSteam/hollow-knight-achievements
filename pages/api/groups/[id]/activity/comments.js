import { supabaseAdmin } from "../../../../../lib/supabaseAdmin";
import { requireUser } from "../../../../../lib/auth";

function normalizeEventId(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim();
}

function normalizeText(raw) {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, 500);
}

function toCommentDto(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    text: row.text,
    createdAt: row.created_at,
    user: {
      id: row?.user?.id ? String(row.user.id) : "",
      displayName: row?.user?.display_name || row?.user?.steamid64 || "Unknown",
      avatarUrl: row?.user?.avatar_url || "",
      steamid64: row?.user?.steamid64 || "",
    },
  };
}

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;

  const groupId = req.query.id;
  const { data: membership } = await supabaseAdmin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .single();
  if (!membership) return res.status(403).json({ error: "Not a member" });

  if (req.method === "GET") {
    const eventId = normalizeEventId(req.query.eventId);
    if (!eventId) return res.status(400).json({ error: "Missing eventId" });

    const { data: rows, error } = await supabaseAdmin
      .from("group_feed_comments")
      .select("id,event_id,text,created_at,user:users(id,display_name,avatar_url,steamid64)")
      .eq("group_id", groupId)
      .eq("event_id", eventId)
      .order("created_at", { ascending: true });

    if (error) return res.status(500).json({ error: String(error.message || error) });
    return res.status(200).json({ comments: (rows || []).map(toCommentDto) });
  }

  if (req.method === "POST") {
    const eventId = normalizeEventId(req.body?.eventId);
    const text = normalizeText(req.body?.text);
    if (!eventId) return res.status(400).json({ error: "Missing eventId" });
    if (!text) return res.status(400).json({ error: "Missing text" });

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("group_feed_comments")
      .insert({
        group_id: groupId,
        event_id: eventId,
        user_id: user.id,
        text,
      })
      .select("id,event_id,text,created_at,user:users(id,display_name,avatar_url,steamid64)")
      .single();

    if (insertError) return res.status(500).json({ error: String(insertError.message || insertError) });
    return res.status(200).json({ comment: toCommentDto(inserted) });
  }

  if (req.method === "DELETE") {
    const commentId = req.body?.commentId;
    if (!commentId) return res.status(400).json({ error: "Missing commentId" });

    const { data: current, error: currentError } = await supabaseAdmin
      .from("group_feed_comments")
      .select("id,user_id,group_id")
      .eq("id", commentId)
      .eq("group_id", groupId)
      .single();
    if (currentError || !current) return res.status(404).json({ error: "Comment not found" });
    if (String(current.user_id) !== String(user.id)) return res.status(403).json({ error: "Only author can delete" });

    const { error: deleteError } = await supabaseAdmin
      .from("group_feed_comments")
      .delete()
      .eq("id", commentId)
      .eq("group_id", groupId);
    if (deleteError) return res.status(500).json({ error: String(deleteError.message || deleteError) });

    return res.status(200).json({ ok: true, deletedId: current.id });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
