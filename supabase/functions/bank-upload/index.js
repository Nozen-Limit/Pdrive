import { createClient } from "@supabase/supabase-js";
import { validateResourceFile } from "../_shared/resource-file.js";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, x-client-info, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const reply = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return reply({ error: "Use a resource upload request." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Sign in before uploading." }, 401);
    const client = createClient(url, Deno.env.get("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
    });
    const { data: auth, error: authError } = await client.auth.getUser(token);
    if (authError || !auth.user)
      return reply({ error: "Sign in again before uploading." }, 401);
    const { data: profile } = await client
      .from("profiles")
      .select("approval_status")
      .eq("id", auth.user.id)
      .single();
    if (profile?.approval_status !== "approved")
      return reply({ error: "School account approval required." }, 403);
    // Bound the request stream before multipart parsing, including chunked requests.
    const limit = 21 * 1024 * 1024;
    const chunks = [];
    let total = 0;
    for await (const chunk of request.body || []) {
      total += chunk.byteLength;
      if (total > limit)
        return reply({ error: "Choose a file up to 20 MB." }, 413);
      chunks.push(chunk);
    }
    const bounded = new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: new Blob(chunks),
    });
    const form = await bounded.formData();
    const file = form.get("file"),
      module = form.get("module");
    if (
      !(file instanceof File) ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        module || "",
      )
    )
      return reply({ error: "Choose a file for this resource." }, 400);
    const { data: existing, error: lookupError } = await client
      .from("modules")
      .select("owner,bank_draft,status,archived,bank_category")
      .eq("id", module)
      .maybeSingle();
    if (lookupError)
      return reply({ error: "Digital Bank setup is required." }, 503);
    if (
      existing &&
      (existing.owner !== auth.user.id ||
        !existing.bank_category ||
        existing.archived ||
        (!existing.bank_draft && existing.status !== "returned"))
    )
      return reply(
        { error: "This resource cannot receive another file." },
        403,
      );
    let mime;
    try {
      mime = await validateResourceFile(file);
    } catch (error) {
      return reply({ error: error.message }, 400);
    }
    const bytes = await file.arrayBuffer();
    const sha256 = [
      ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    ]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    const key = `${auth.user.id}/${module}/${crypto.randomUUID()}.${mime === "application/pdf" ? "pdf" : "docx"}`;
    const { error: uploadError } = await client.storage
      .from("sikap-modules")
      .upload(key, bytes, { contentType: mime, upsert: false });
    if (uploadError)
      return reply(
        { error: "File could not be stored. Please try again." },
        503,
      );
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
    });
    const { error: receiptError } = await admin.from("bank_uploads").insert({
      key,
      owner: auth.user.id,
      module,
      filename: file.name,
      mime,
      bytes: file.size,
      sha256,
    });
    if (receiptError) {
      await admin.storage.from("sikap-modules").remove([key]);
      return reply(
        {
          error:
            "File verification could not be saved. Ask the administrator to check Digital Bank setup.",
        },
        503,
      );
    }
    return reply({ object_key: key });
  } catch {
    return reply(
      { error: "Upload failed. Check your connection and try again." },
      500,
    );
  }
});
