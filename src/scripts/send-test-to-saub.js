require("dotenv").config({ path: ".env.local" });
const postgres = require("postgres");

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  const [agent] = await sql`SELECT * FROM agents WHERE name = 'TBConnect Research Partnerships' LIMIT 1;`;
  console.log("Agent:", agent.id, agent.name);

  const testUser = {
    name: "Saub Consulting",
    email: "saubconsulting@gmail.com",
    org: "Saub Research Consultancy",
    country: "IN",
  };

  const contactId = crypto.randomUUID();
  let [contact] = await sql`SELECT * FROM contacts WHERE email_normalized = ${testUser.email} AND workspace_id = 'ws_default' LIMIT 1;`;
  if (!contact) {
    [contact] = await sql`
      INSERT INTO contacts (id, workspace_id, name, email_normalized, organisation, country, tags_json, source_json, status, is_suppressed)
      VALUES (${contactId}, 'ws_default', ${testUser.name}, ${testUser.email}, ${testUser.org}, ${testUser.country}, '["VIP", "researcher"]'::jsonb, '{"source": "direct_test_saub"}'::jsonb, 'ACTIVE', false)
      RETURNING *;
    `;
    console.log(`Created contact ${testUser.name} (${testUser.email})`);
  }

  let [rel] = await sql`SELECT * FROM relationships WHERE contact_id = ${contact.id} AND agent_id = ${agent.id} LIMIT 1;`;
  if (!rel) {
    const relId = crypto.randomUUID();
    [rel] = await sql`
      INSERT INTO relationships (id, workspace_id, contact_id, agent_id, stage, summary, facts_json, open_questions_json)
      VALUES (${relId}, 'ws_default', ${contact.id}, ${agent.id}, 'OUTREACH', 'Testing live end-to-end outreach with Saub Consulting', '["Principal Consultant"]'::jsonb, '[]'::jsonb)
      RETURNING *;
    `;
  }

  const subject = "Digital TST measurement with TBConnect & SmartPatch";
  const bodyText = `Hi Saub,

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
      reason: "Live email outreach test with Saub Consulting.",
      next_action: "REQUEST_APPROVAL",
      approval_required: true,
      draft_required: true,
    },
    draft_version: 1,
  };

  await sql`
    INSERT INTO actions (id, workspace_id, relationship_id, agent_id, type, status, payload_json, reason, approval_required, approved_draft_version, scheduled_at, idempotency_key)
    VALUES (${actionId}, 'ws_default', ${rel.id}, ${agent.id}, 'SEND_EMAIL', 'APPROVED', ${JSON.stringify(payload)}, 'Live email outreach test with Saub Consulting', true, 1, ${new Date()}, ${"action_saub_" + actionId})
    ON CONFLICT DO NOTHING;
  `;

  await sql`UPDATE relationships SET stage = 'OUTREACH', current_action_id = ${actionId} WHERE id = ${rel.id};`;
  console.log(`✓ Queued and approved test outreach for Saub Consulting (${testUser.email})`);

  await sql.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
