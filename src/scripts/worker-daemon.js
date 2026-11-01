const https = require("https");

const RAILWAY_BASE = "https://tbconnect-sales-production.up.railway.app";
const WORKSPACE_ID = "ws_default";
const INTERVAL_MS = 45 * 1000; // run every 45 seconds

function postJSON(url, payload) {
  return new Promise((resolve) => {
    const data = JSON.stringify(payload);
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(data),
        },
        timeout: 25000,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body));
          } catch {
            resolve({ raw: body, statusCode: res.statusCode });
          }
        });
      }
    );

    req.on("error", (err) => {
      resolve({ error: err.message });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ error: "Request timed out" });
    });

    req.write(data);
    req.end();
  });
}

async function cycle() {
  const timestamp = new Date().toLocaleString();
  console.log(`\n[${timestamp}] --- Running Background Worker Cycle ---`);

  // 1. Sync Inbound IMAP from Hostinger Webmail
  try {
    const syncRes = await postJSON(`${RAILWAY_BASE}/api/inbox/sync?workspaceId=${WORKSPACE_ID}`, {});
    if (syncRes.ok) {
      console.log(`✓ IMAP Sync: ${syncRes.processedCount} messages checked/processed.`);
    } else {
      console.log(`- IMAP Sync note:`, syncRes.error || syncRes);
    }
  } catch (err) {
    console.error("! IMAP Sync exception:", err.message);
  }

  // 2. Run Action Worker to claim and dispatch due scheduled emails
  try {
    const workerRes = await postJSON(`${RAILWAY_BASE}/api/actions`, {
      action: "run_worker",
      workspaceId: WORKSPACE_ID,
    });

    if (workerRes.success && workerRes.summary) {
      const s = workerRes.summary;
      if (s.claimedCount > 0) {
        console.log(`🚀 DISPATCHED: ${s.completedCount} email(s) sent! (Failed: ${s.failedCount}, Retried: ${s.retriedCount})`);
      } else {
        console.log(`- Queue Check: 0 actions due at this second.`);
      }
    } else {
      console.log(`- Action Worker note:`, workerRes);
    }
  } catch (err) {
    console.error("! Action Worker exception:", err.message);
  }
}

async function main() {
  console.log("=================================================");
  console.log("TBConnect 24/7 Autonomous Background SDR Worker");
  console.log(`Target: ${RAILWAY_BASE}`);
  console.log(`Interval: Every ${INTERVAL_MS / 1000}s`);
  console.log("Human-in-the-Loop: Strict (all replies require approval)");
  console.log("=================================================");

  // Run first cycle immediately
  await cycle();

  // Run on interval
  setInterval(cycle, INTERVAL_MS);
}

main().catch(console.error);
