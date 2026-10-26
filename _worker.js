
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/use-key") {
      if (request.method !== "POST") {
        return Response.json(
          { ok: false, message: "Use POST" },
          { status: 405 }
        );
      }

      try {
        const body = await request.json();
        const key = String(body.key || "").trim();

        if (!key || key.length > 100) {
          return Response.json(
            { ok: false, message: "Invalid KEY" },
            { status: 400 }
          );
        }

        const db = env.DB;

        const result = await db.prepare(`
          UPDATE scanner_keys
          SET scans_used = scans_used + 1
          WHERE key_code = ?
            AND status = 'active'
            AND (
              expires_at IS NULL
              OR datetime(expires_at) > datetime('now')
            )
            AND (
              scans_used < scans_total
              OR package = '24h_unlimited'
            )
        `).bind(key).run();

        if (!result.meta.changes) {
          return Response.json({
            ok: false,
            message: "KEY invalid, expired, or used up"
          }, { status: 403 });
        }

        const saved = await db.prepare(`
          SELECT package, scans_total, scans_used, expires_at
          FROM scanner_keys
          WHERE key_code = ?
        `).bind(key).first();

        return Response.json({
          ok: true,
          package: saved.package,
          scansRemaining:
            saved.package === "24h_unlimited"
              ? "unlimited"
              : saved.scans_total - saved.scans_used,
          expiresAt: saved.expires_at
        });
      } catch {
        return Response.json(
          { ok: false, message: "Server error" },
          { status: 500 }
        );
      }
    }

    return env.ASSETS.fetch(request);
  }
};
