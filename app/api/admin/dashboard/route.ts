import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { ApiError, jsonError, noStoreHeaders } from "@/lib/http";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await requireAdmin(); const db = createSupabaseServiceClient();
    const [{ data: metrics, error: metricsError }, { data: recentRows, error: recentError }, { data: activityRows, error: activityError }] = await Promise.all([
      db.rpc("get_saxn_dashboard_metrics"),
      db.from("deliveries").select("id,client_id,track_title,service_type,status,created_at,expires_at,zip_size").order("created_at", { ascending: false }).limit(8),
      db.from("download_events").select("id,delivery_id,event_type,created_at").order("created_at", { ascending: false }).limit(8),
    ]);
    if (metricsError || recentError || activityError) throw new ApiError(503, "Could not load the live dashboard. Check that the current database migrations have been applied.", "DASHBOARD_QUERY_FAILED");
    const stats = Array.isArray(metrics) ? metrics[0] : null;
    if (!stats) throw new ApiError(503, "Dashboard metric aggregation returned no data.", "DASHBOARD_QUERY_FAILED");

    const recentClientIds = [...new Set((recentRows ?? []).map((row) => row.client_id))];
    let recentClients: Array<{ id: string; name: string }> = [];
    if (recentClientIds.length) {
      const result = await db.from("clients").select("id,name").in("id", recentClientIds);
      if (result.error) throw new ApiError(503, "Could not load recent client details.", "DASHBOARD_QUERY_FAILED");
      recentClients = result.data ?? [];
    }
    const recentClientMap = new Map(recentClients.map((client) => [client.id, client]));
    const recent = (recentRows ?? []).map((row) => ({ ...row, clients: recentClientMap.get(row.client_id) ?? null }));

    const activityDeliveryIds = [...new Set((activityRows ?? []).map((event) => event.delivery_id))];
    let activityDeliveries: Array<{ id: string; track_title: string; client_id: string }> = [];
    if (activityDeliveryIds.length) {
      const result = await db.from("deliveries").select("id,track_title,client_id").in("id", activityDeliveryIds);
      if (result.error) throw new ApiError(503, "Could not load recent access details.", "DASHBOARD_QUERY_FAILED");
      activityDeliveries = result.data ?? [];
    }
    const activityClientIds = [...new Set(activityDeliveries.map((delivery) => delivery.client_id))];
    let activityClients: Array<{ id: string; name: string }> = [];
    if (activityClientIds.length) {
      const result = await db.from("clients").select("id,name").in("id", activityClientIds);
      if (result.error) throw new ApiError(503, "Could not load recent access clients.", "DASHBOARD_QUERY_FAILED");
      activityClients = result.data ?? [];
    }
    const activityDeliveryMap = new Map(activityDeliveries.map((delivery) => [delivery.id, { ...delivery, clients: activityClients.find((client) => client.id === delivery.client_id) ?? null }]));
    const activity = (activityRows ?? []).map((event) => ({ ...event, deliveries: activityDeliveryMap.get(event.delivery_id) ?? null }));

    return NextResponse.json({ stats: { total: Number(stats.total), ready: Number(stats.ready), downloaded: Number(stats.downloaded), awaiting: Number(stats.awaiting), expired: Number(stats.expired), revoked: Number(stats.revoked), storageBytes: Number(stats.storage_bytes) }, recent, activity }, { headers: noStoreHeaders() });
  } catch (error) { return jsonError(error); }
}
