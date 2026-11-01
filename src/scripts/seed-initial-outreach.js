require("dotenv").config({ path: ".env.local" });
const postgres = require("postgres");
const fs = require("fs");

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  const lines = fs.readFileSync("pilot_candidates_non_kncv.csv", "utf-8").trim().split("\n");

  const [agent] = await sql`SELECT * FROM agents WHERE name = 'TBConnect Research Partnerships' LIMIT 1;`;
  console.log("Agent:", agent.id, agent.name);

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",");
    const fullName = parts[0]?.trim();
    const email = parts[1]?.trim().toLowerCase();
    const org = parts[2]?.trim();

    if (!email) continue;

    const firstName = fullName.split(" ")[0].replace(/^Dr\.?\s*/i, "");

    const [contact] = await sql`SELECT * FROM contacts WHERE email_normalized = ${email} AND workspace_id = 'ws_default' LIMIT 1;`;
    if (!contact) continue;

    let [rel] = await sql`SELECT * FROM relationships WHERE contact_id = ${contact.id} AND agent_id = ${agent.id} LIMIT 1;`;
    if (!rel) {
      const relId = crypto.randomUUID();
      [rel] = await sql`
        INSERT INTO relationships (id, workspace_id, contact_id, agent_id, stage, summary, facts_json, open_questions_json)
        VALUES (${relId}, 'ws_default', ${contact.id}, ${agent.id}, 'OUTREACH', 'Union 2026 researcher candidate', '["Union 2026 Presenter"]'::jsonb, '[]'::jsonb)
        RETURNING *;
      `;
    }

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
        draft_version: 1
      },
      decision: {
        stage: "OUTREACH",
        intent: "initial_outreach",
        reason: "Initial cold outreach introducing TBConnect & SmartPatch.",
        next_action: "REQUEST_APPROVAL",
        approval_required: true,
        draft_required: true
      },
      draft_version: 1
    };

    await sql`
      INSERT INTO actions (id, workspace_id, relationship_id, agent_id, type, status, payload_json, reason, approval_required, idempotency_key)
      VALUES (${actionId}, 'ws_default', ${rel.id}, ${agent.id}, 'REQUEST_APPROVAL', 'AWAITING_APPROVAL', ${JSON.stringify(payload)}, 'Initial cold outreach introducing TBConnect & SmartPatch', true, ${"action_init_" + actionId})
      ON CONFLICT DO NOTHING;
    `;

    await sql`UPDATE relationships SET stage = 'OUTREACH', current_action_id = ${actionId} WHERE id = ${rel.id};`;

    console.log(`✓ Queued exact outreach for ${fullName} (${email}) -> "Hi ${firstName}..."`);
  }

  console.log("\nAll 8 pilot outreach actions successfully created!");
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
