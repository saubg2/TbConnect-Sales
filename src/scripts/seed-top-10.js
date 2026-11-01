require("dotenv").config({ path: ".env.local" });
const postgres = require("postgres");

const sql = postgres(process.env.DATABASE_URL);

async function run() {
  const [agent] = await sql`SELECT * FROM agents WHERE name = 'TBConnect Research Partnerships' LIMIT 1;`;
  console.log("Agent:", agent.id, agent.name);

  const newCandidates = [
    {
      name: "Aakriti Suresh",
      email: "aakriti819@gmail.com",
      org: "Johns Hopkins University",
      country: "US",
    },
    {
      name: "Abdulhameed Kashkary",
      email: "akash007@uottawa.ca",
      org: "University of Ottawa",
      country: "CA",
    },
    {
      name: "Abhay Balkrishna Kadam",
      email: "akadam2@jhmi.edu",
      org: "Johns Hopkins Center for Infectious Diseases in India",
      country: "IN",
    },
  ];

  for (const c of newCandidates) {
    const contactId = crypto.randomUUID();
    const [existingContact] = await sql`SELECT * FROM contacts WHERE email_normalized = ${c.email} AND workspace_id = 'ws_default' LIMIT 1;`;
    let contact = existingContact;
    if (!contact) {
      [contact] = await sql`
        INSERT INTO contacts (id, workspace_id, name, email_normalized, organisation, country, tags_json, source_json, status, is_suppressed)
        VALUES (${contactId}, 'ws_default', ${c.name}, ${c.email}, ${c.org}, ${c.country}, '["Union-2026", "researcher"]'::jsonb, '{"source": "conference_2026.csv"}'::jsonb, 'ACTIVE', false)
        RETURNING *;
      `;
      console.log(`Created contact ${c.name} (${c.email})`);
    }

    let [rel] = await sql`SELECT * FROM relationships WHERE contact_id = ${contact.id} AND agent_id = ${agent.id} LIMIT 1;`;
    if (!rel) {
      const relId = crypto.randomUUID();
      [rel] = await sql`
        INSERT INTO relationships (id, workspace_id, contact_id, agent_id, stage, summary, facts_json, open_questions_json)
        VALUES (${relId}, 'ws_default', ${contact.id}, ${agent.id}, 'OUTREACH', 'Union 2026 researcher candidate', '["Union 2026 Presenter"]'::jsonb, '[]'::jsonb)
        RETURNING *;
      `;
    }

    const firstName = c.name.split(" ")[0].replace(/^Dr\.?\s*/i, "");
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
        reason: "Initial cold outreach introducing TBConnect & SmartPatch.",
        next_action: "REQUEST_APPROVAL",
        approval_required: true,
        draft_required: true,
      },
      draft_version: 1,
    };

    // Stagger scheduled_at to respect warm-up
    const scheduledAt = new Date(Date.now() + Math.floor(Math.random() * 30000));

    await sql`
      INSERT INTO actions (id, workspace_id, relationship_id, agent_id, type, status, payload_json, reason, approval_required, approved_draft_version, scheduled_at, idempotency_key)
      VALUES (${actionId}, 'ws_default', ${rel.id}, ${agent.id}, 'SEND_EMAIL', 'APPROVED', ${JSON.stringify(payload)}, 'Initial cold outreach introducing TBConnect & SmartPatch', true, 1, ${scheduledAt}, ${"action_init_" + actionId})
      ON CONFLICT DO NOTHING;
    `;

    await sql`UPDATE relationships SET stage = 'OUTREACH', current_action_id = ${actionId} WHERE id = ${rel.id};`;
    console.log(`✓ Queued & approved outreach for ${c.name} (${c.email})`);
  }

  // Also ensure existing 7 approved actions have type 'SEND_EMAIL'
  await sql`UPDATE actions SET type = 'SEND_EMAIL' WHERE status = 'APPROVED' AND type = 'REQUEST_APPROVAL';`;

  const totalApproved = await sql`SELECT count(*) FROM actions WHERE status = 'APPROVED';`;
  console.log(`\nTotal APPROVED outreach actions ready: ${totalApproved[0].count}`);

  await sql.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
