require("dotenv").config({ path: ".env.local" });
const fs = require("fs");
const postgres = require("postgres");

const sql = postgres(
  process.env.DATABASE_URL ||
  "postgresql://postgres.rknslpzvwtkuigincjae:NPBXUjUm51yeuhKj@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres"
);

function getFirstName(fullName) {
  if (!fullName) return "Colleague";
  const parts = fullName.trim().split(/\s+/);
  const filtered = parts.filter(p => !/^(dr\.?|prof\.?|mr\.?|ms\.?|mrs\.?)$/i.test(p));
  return filtered.length > 0 ? filtered[0] : parts[0];
}

async function run() {
  console.log("Loading batch 600 candidates from batch_600_candidates.json...");
  const raw = fs.readFileSync("batch_600_candidates.json", "utf8");
  const candidates = JSON.parse(raw);
  console.log(`Loaded ${candidates.length} candidates for tomorrow.`);

  const [agent] = await sql`SELECT * FROM agents WHERE name = 'TBConnect Research Partnerships' LIMIT 1;`;
  if (!agent) {
    throw new Error("Agent TBConnect Research Partnerships not found in DB");
  }
  console.log("Using Agent:", agent.id, agent.name);

  // Find the latest scheduled_at among existing actions so Batch 600 starts smoothly right after
  const [latestAction] = await sql`
    SELECT MAX(scheduled_at) as max_sched
    FROM actions
    WHERE workspace_id = 'ws_default' AND status = 'APPROVED';
  `;

  let startMs;
  if (latestAction && latestAction.max_sched) {
    // Start 5 minutes after the last email of Batch 300
    startMs = new Date(latestAction.max_sched).getTime() + 5 * 60 * 1000;
  } else {
    // Default to 8:00 AM tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);
    startMs = tomorrow.getTime();
  }

  console.log(`Batch 600 will start scheduling from: ${new Date(startMs).toLocaleString()}`);

  let currentScheduleMs = startMs;
  let insertedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const emailNorm = c.email.toLowerCase().trim();

    // Check if contact already exists
    let [contact] = await sql`
      SELECT id, is_suppressed FROM contacts
      WHERE email_normalized = ${emailNorm} AND workspace_id = 'ws_default'
      LIMIT 1;
    `;

    if (!contact) {
      const contactId = crypto.randomUUID();
      [contact] = await sql`
        INSERT INTO contacts (
          id, workspace_id, name, email_normalized, organisation, country,
          tags_json, source_json, status, is_suppressed
        ) VALUES (
          ${contactId}, 'ws_default', ${c.name}, ${emailNorm}, ${c.org}, ${c.country},
          ${JSON.stringify(["union-2026", "researcher", "cohort-600"])},
          ${JSON.stringify({ source: "conference_2026.csv", abstractTitle: c.abstractTitle })},
          'ACTIVE', false
        )
        RETURNING id, is_suppressed;
      `;
    }

    if (contact.is_suppressed) {
      skippedCount++;
      continue;
    }

    // Check or create relationship
    let [rel] = await sql`
      SELECT id FROM relationships
      WHERE contact_id = ${contact.id} AND agent_id = ${agent.id}
      LIMIT 1;
    `;

    if (!rel) {
      const relId = crypto.randomUUID();
      [rel] = await sql`
        INSERT INTO relationships (
          id, workspace_id, contact_id, agent_id, stage,
          summary, facts_json, open_questions_json
        ) VALUES (
          ${relId}, 'ws_default', ${contact.id}, ${agent.id}, 'OUTREACH',
          ${`Initial conference outreach queued for ${c.name} (${c.org})`},
          ${JSON.stringify([`Author of: ${c.abstractTitle}`])},
          '[]'::jsonb
        )
        RETURNING id;
      `;
    }

    // Check if an outreach action already exists
    const [existingAction] = await sql`
      SELECT id FROM actions
      WHERE relationship_id = ${rel.id} AND type = 'SEND_EMAIL'
      LIMIT 1;
    `;

    if (existingAction) {
      skippedCount++;
      continue;
    }

    // Stagger: 2 min + 10s - 30s jitter
    const jitterMs = Math.floor(Math.random() * 20000) + 10000;
    if (i > 0) {
      currentScheduleMs += 120 * 1000 + jitterMs;
    }
    const scheduledAt = new Date(currentScheduleMs);

    const firstName = getFirstName(c.name);
    const subject = "Digital TST measurement with TBConnect & SmartPatch";
    const bodyText = `Hi ${firstName},

I wanted to introduce TBConnect and SmartPatch, developed to support digital TST measurement and TB research studies.

SmartPatch is globally patented, has received approval from the Indian FDA, and has been used in field studies in India, Tajikistan, and Tanzania.

Both technologies are available without software licence fees, with technical support available for research deployments.

If you're attending the Union Conference, you can see SmartPatch at the KNCV booth and connect with investigators who have used it in field studies.

Would this be relevant to any research you're currently planning?

Best,
Dr. Mahek Aneja
TBConnect Research Desk
contact@tbconnect.in | https://www.tbconnect.in`;

    const actionId = crypto.randomUUID();
    const payload = {
      draft: {
        subject,
        body_text: bodyText,
        draft_version: 1,
      },
      decision: {
        stage: "OUTREACH",
        intent: "initial_outreach",
        reason: "Staggered cohort outreach for tomorrow approved by human operator.",
        next_action: "SEND_EMAIL",
        approval_required: true,
        draft_required: true,
      },
      draft_version: 1,
    };

    await sql`
      INSERT INTO actions (
        id, workspace_id, relationship_id, agent_id, type, status,
        payload_json, reason, approval_required, approved_draft_version,
        scheduled_at, idempotency_key
      ) VALUES (
        ${actionId}, 'ws_default', ${rel.id}, ${agent.id}, 'SEND_EMAIL', 'APPROVED',
        ${JSON.stringify(payload)},
        'Batch 600 tomorrow outreach: 1 email every 2 min',
        true, 1,
        ${scheduledAt},
        ${"action_cohort600_" + actionId}
      );
    `;

    await sql`
      UPDATE relationships
      SET stage = 'OUTREACH', current_action_id = ${actionId}
      WHERE id = ${rel.id};
    `;

    insertedCount++;
    if (insertedCount % 50 === 0 || insertedCount === candidates.length) {
      console.log(`[Batch 600 Progress] Queued ${insertedCount}/600 actions. Next scheduled: ${scheduledAt.toLocaleString()}`);
    }
  }

  const finalDate = new Date(currentScheduleMs);
  console.log(`\n========================================`);
  console.log(`✓ Batch 600 successfully queued: ${insertedCount} emails`);
  console.log(`- Skipped: ${skippedCount}`);
  console.log(`- Starts at: ${new Date(startMs).toLocaleString()}`);
  console.log(`- Ends at:   ${finalDate.toLocaleString()}`);
  console.log(`========================================`);

  await sql.end();
}

run().catch((err) => {
  console.error("Error in seeding batch 600:", err);
  process.exit(1);
});
