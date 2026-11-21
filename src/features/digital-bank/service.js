export function createBankService(client, config, checked, signVersions) {
  async function call(name, args = {}) {
    const result = await client.rpc(name, args);
    if (result.error?.code === "PGRST202")
      throw Error(
        /^collab_/.test(name)
          ? "Collaboration database setup is required. Apply supabase/collaboration.sql in the Supabase SQL Editor, then refresh."
          : /curriculum|competency/.test(name)
            ? "Curriculum catalog setup is required. Ask the administrator to apply curriculum-catalog.sql."
            : /reject|assign|account_|report|share|colleague|attach|detach|transfer|announcement/.test(
                  name,
                )
              ? "This feature needs a database update. Ask the administrator to apply supabase/teacher-tools.sql."
              : "Digital Bank setup is required. Ask the administrator to apply digital-bank.sql.",
      );
    return checked(result);
  }
  return {
    async collaboration(mid = null) {
      const value = await call("collab_state", { mid });
      if (value.proposals)
        value.proposals = await signVersions(value.proposals);
      return value;
    },
    collaborationAction: (args) => call("collab_action", args),
    curriculum: () => call("bank_curriculum"),
    competencies: (filters, page = 1) =>
      call("bank_competency_list", { filters, page_no: page }),
    competency: async (id) =>
      checked(
        await client
          .from("curriculum_competencies")
          .select("*")
          .eq("id", id)
          .maybeSingle(),
      ),
    competencyCoverage: () => call("bank_competency_coverage"),
    list: (filters, page) => call("bank_list", { filters, page_no: page }),
    stats: () => call("bank_stats"),
    facets: () => call("bank_facets"),
    async details(id) {
      const detail = await call("bank_details", { mid: id });
      detail.versions = await signVersions(detail.versions);
      if (detail.attachments)
        detail.attachments = await signVersions(detail.attachments);
      return detail;
    },
    // Teacher and head-teacher tools (supabase/teacher-tools.sql).
    reject: (args) => call("bank_reject", args),
    assign: (mid, reviewer) => call("bank_assign", { mid, reviewer }),
    assigned: () => call("bank_assigned"),
    setRole: (uid, role, coordinator) =>
      call("set_account_role", { uid, new_role: role, coordinator }),
    setActive: (uid, active) => call("set_account_active", { uid, active }),
    report: (mid, reason, details) =>
      call("bank_report", { mid, reason, details }),
    reports: () => call("report_list"),
    resolveReport: (rid, note) => call("report_resolve", { rid, note }),
    share: (mid, recipient, note) =>
      call("bank_share", { mid, recipient, note }),
    colleagues: () => call("colleague_list"),
    async hide(mid, hidden) {
      const user = checked(await client.auth.getUser()).user;
      checked(
        await (hidden
          ? client
              .from("hidden_resources")
              .upsert(
                { owner: user.id, module: mid },
                { onConflict: "owner,module", ignoreDuplicates: true },
              )
          : client
              .from("hidden_resources")
              .delete()
              .eq("owner", user.id)
              .eq("module", mid)),
      );
    },
    async attachments(list) {
      return signVersions(list || []);
    },
    attach: (mid, object_key, label) =>
      call("bank_attach", { mid, object_key, label }),
    detach: (aid) => call("bank_detach", { aid }),
    transfer: (mid, expected_revision, new_owner) =>
      call("collab_transfer", { mid, expected_revision, new_owner }),
    announcements: () => call("announcement_list"),
    announce: (title, body, expires) =>
      call("announcement_post", { title, body, expires: expires || null }),
    removeAnnouncement: (aid) => call("announcement_delete", { aid }),
    reportRows: () => call("report_rows"),
    save: (args) => call("bank_save", args),
    edit: (args) => call("bank_edit", args),
    revise: (args) => call("bank_revise", args),
    decide: (args) => call("bank_decide", args),
    archive: (args) => call("bank_archive", args),
    deleteDraft: (args) => call("bank_delete_draft", args),
    async saved(id, value) {
      checked(
        await (value
          ? client.from("stars").upsert(
              {
                module: id,
                owner: checked(await client.auth.getUser()).user.id,
              },
              { onConflict: "owner,module", ignoreDuplicates: true },
            )
          : client
              .from("stars")
              .delete()
              .eq("module", id)
              .eq("owner", checked(await client.auth.getUser()).user.id)),
      );
    },
    async upload(id, file, onProgress) {
      const session = checked(await client.auth.getSession()).session;
      if (!session) throw Error("Sign in again before uploading.");
      const body = new FormData();
      body.set("file", file);
      body.set("module", id);
      return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open(
          "POST",
          config.supabaseUrl.replace(/\/$/, "") + "/functions/v1/bank-upload",
        );
        request.setRequestHeader(
          "Authorization",
          "Bearer " + session.access_token,
        );
        request.setRequestHeader("apikey", config.supabasePublishableKey);
        request.timeout = 120000;
        request.upload.onprogress = (event) => {
          if (event.lengthComputable)
            onProgress?.(Math.round((event.loaded / event.total) * 100));
        };
        request.onerror = () =>
          reject(
            Error(
              "Upload could not connect. Check your connection and the Digital Bank upload service.",
            ),
          );
        request.ontimeout = () =>
          reject(Error("Upload timed out. Try again on a stable connection."));
        request.onload = () => {
          let result;
          try {
            result = JSON.parse(request.responseText);
          } catch {
            result = {};
          }
          if (
            request.status >= 200 &&
            request.status < 300 &&
            result.object_key
          )
            resolve(result.object_key);
          else
            reject(
              Error(
                result.error ||
                  "Upload failed. Ask the administrator to verify the bank-upload service.",
              ),
            );
        };
        request.send(body);
      });
    },
  };
}
