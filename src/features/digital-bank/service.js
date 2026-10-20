export function createBankService(client, config, checked, signVersions) {
  async function call(name, args = {}) {
    const result = await client.rpc(name, args);
    if (result.error?.code === "PGRST202")
      throw Error(
        "Digital Bank setup is required. Ask the administrator to apply digital-bank.sql.",
      );
    return checked(result);
  }
  return {
    list: (filters, page) => call("bank_list", { filters, page_no: page }),
    stats: () => call("bank_stats"),
    facets: () => call("bank_facets"),
    async details(id) {
      const detail = await call("bank_details", { mid: id });
      detail.versions = await signVersions(detail.versions);
      return detail;
    },
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
