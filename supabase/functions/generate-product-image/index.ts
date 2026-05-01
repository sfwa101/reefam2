// Generates a unique AI image per product and uploads it to storage
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "product-images";

function buildPrompt(name: string, source: string | null): string {
  const ctx = (source ?? "").toLowerCase();
  const ctxHint =
    ctx === "pharmacy" ? "pharmacy product packaging on white background"
    : ctx === "produce" ? "fresh produce, vibrant, on light wooden surface"
    : ctx === "meat" ? "raw butcher cut, professional food photography"
    : ctx === "dairy" ? "dairy product packaging, soft daylight"
    : ctx === "sweets" ? "Egyptian/Middle-Eastern dessert, plated, warm light"
    : ctx === "library" ? "stationery item, flat lay on desk"
    : ctx === "restaurants" || ctx === "recipes" ? "served meal, top-down food photography"
    : "Egyptian supermarket product on clean studio background";
  return `Professional commercial product photo of "${name}". ${ctxHint}. Sharp focus, soft shadows, e-commerce catalog style, square 1:1, high detail, no text overlays, no watermarks.`;
}

async function generateImage(prompt: string): Promise<Uint8Array> {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-image",
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
    }),
  });
  if (!r.ok) throw new Error(`AI ${r.status}: ${await r.text()}`);
  const j = await r.json();
  const dataUrl: string | undefined = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!dataUrl) throw new Error("No image returned");
  const b64 = dataUrl.split(",")[1] ?? dataUrl;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { ids, limit } = await req.json().catch(() => ({}));
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

    let query = sb.from("products").select("id, name, source").limit(limit ?? 50);
    if (Array.isArray(ids) && ids.length) query = sb.from("products").select("id, name, source").in("id", ids);
    const { data: rows, error } = await query;
    if (error) throw error;

    const results: { id: string; ok: boolean; url?: string; error?: string }[] = [];
    for (const row of rows ?? []) {
      try {
        const png = await generateImage(buildPrompt(row.name, row.source));
        const path = `ai/${row.id}-${Date.now()}.png`;
        const up = await sb.storage.from(BUCKET).upload(path, png, {
          contentType: "image/png",
          upsert: true,
        });
        if (up.error) throw up.error;
        const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
        const url = pub.publicUrl;
        const { error: uErr } = await sb.from("products").update({ image_url: url, image: url }).eq("id", row.id);
        if (uErr) throw uErr;
        results.push({ id: row.id, ok: true, url });
      } catch (e) {
        results.push({ id: row.id, ok: false, error: (e as Error).message });
      }
    }
    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
