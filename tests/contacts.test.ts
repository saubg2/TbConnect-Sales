import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb, seedTestWorkspace } from './setup';
import { CSVContactImporter } from '@/core/contacts/csv-importer';
import { ContactService } from '@/core/contacts/service';
import { TenantAuthService } from '@/core/auth/tenant';
import { workspaces, memberships, contacts, events } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

describe('Phase 1: Contacts, Import & Relationship State Test Suite', () => {
  let db: any;
  let workspaceA: any;
  let workspaceB: any;
  let importer: CSVContactImporter;
  let contactService: ContactService;
  let authService: TenantAuthService;

  beforeEach(async () => {
    const context = await createTestDb();
    db = context.testDb;

    // Seed Workspace A
    const seededA = await seedTestWorkspace(db);
    workspaceA = seededA.workspace;

    // Seed Workspace B for isolation tests
    const [wsB] = await db
      .insert(workspaces)
      .values({
        id: 'ws_tenant_b_' + crypto.randomUUID().substring(0, 8),
        name: 'Beta Global Inc',
      })
      .returning();
    workspaceB = wsB;

    importer = new CSVContactImporter(db);
    contactService = new ContactService(db);
    authService = new TenantAuthService(db);
  });

  it('demonstrates Phase 1 Exit Gate: 100 test contacts import correctly with provenance and tags', async () => {
    // Generate 100 test contacts in RFC 4180 CSV
    let csvData = 'Name,Email,Company,Country,Tags,Suppressed,Reason\n';
    for (let i = 1; i <= 100; i++) {
      const isSupp = i % 20 === 0; // 5 contacts suppressed
      csvData += `Lead Number ${i},lead${i}@growthpartner.com,Company ${i % 10},United States,outreach;batch-100,${isSupp},${isSupp ? 'Regulatory opt-out' : ''}\n`;
    }

    const result = await importer.importCSV(csvData, {
      workspaceId: workspaceA.id,
      filename: 'bulk_100_leads.csv',
      importedBy: 'operator_dan',
    });

    expect(result.totalRows).toBe(100);
    expect(result.importedCount).toBe(100);
    expect(result.duplicateCount).toBe(0);
    expect(result.suppressedCount).toBe(5);
    expect(result.invalidCount).toBe(0);

    // Verify database count
    const workspaceAContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, workspaceA.id));

    expect(workspaceAContacts.length).toBe(100);

    // Check provenance
    const sample = workspaceAContacts[0];
    const source = sample.sourceJson as any;
    expect(source.type).toBe('csv_import');
    expect(source.filename).toBe('bulk_100_leads.csv');
    expect(source.batch_id).toBe(result.batchId);
    expect(source.imported_by).toBe('operator_dan');

    // Check tags
    expect(sample.tagsJson).toContain('outreach');
    expect(sample.tagsJson).toContain('batch-100');

    // Check suppression
    const suppressed = workspaceAContacts.filter((c: any) => c.isSuppressed);
    expect(suppressed.length).toBe(5);
    expect(suppressed[0].suppressionReason).toBe('Regulatory opt-out');
  });

  it('demonstrates Phase 1 Exit Gate: duplicate addresses within batch and across batches are deduplicated', async () => {
    // CSV with internal duplicate rows
    const duplicateCSV = `Name,Email,Company
Charlie Brown,charlie@peanuts.com,Peanuts Comic
Charlie Duplicate,charlie@peanuts.com,Peanuts Duplicate
Linus Van Pelt,linus@peanuts.com,Peanuts Comic
Charlie Third,charlie@peanuts.com,Peanuts Comic`;

    const result1 = await importer.importCSV(duplicateCSV, {
      workspaceId: workspaceA.id,
      filename: 'batch_duplicates.csv',
    });

    expect(result1.totalRows).toBe(4);
    expect(result1.importedCount).toBe(2); // Only charlie and linus
    expect(result1.duplicateCount).toBe(2);

    // Re-importing the same CSV again to test cross-batch deduplication
    const result2 = await importer.importCSV(duplicateCSV, {
      workspaceId: workspaceA.id,
      filename: 'batch_reimport.csv',
    });

    expect(result2.totalRows).toBe(4);
    expect(result2.importedCount).toBe(0); // 0 new contacts created
    expect(result2.duplicateCount).toBe(4); // All 4 rows are duplicates (2 in-batch + 2 existing in DB)

    // Total in database remains exactly 2
    const currentContacts = await db
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, workspaceA.id));
    expect(currentContacts.length).toBe(2);
  });

  it('demonstrates Phase 1 Exit Gate: two workspaces cannot access each others records', async () => {
    // Import 5 contacts into Workspace A
    const csvA = `Name,Email
Tenant A User 1,user1@tenanta.com
Tenant A User 2,user2@tenanta.com`;

    await importer.importCSV(csvA, {
      workspaceId: workspaceA.id,
    });

    // Import 1 contact into Workspace B
    const csvB = `Name,Email
Tenant B User 1,user1@tenantb.com`;

    await importer.importCSV(csvB, {
      workspaceId: workspaceB.id,
    });

    // 1. Workspace B listing cannot see Workspace A contacts
    const listForB = await contactService.listContacts({
      workspaceId: workspaceB.id,
    });
    expect(listForB.contacts.length).toBe(1);
    expect(listForB.contacts[0].emailNormalized).toBe('user1@tenantb.com');

    // 2. Workspace B cannot access a contact belonging to Workspace A
    const [contactA] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.workspaceId, workspaceA.id))
      .limit(1);

    const crossAccess = await contactService.getContact(workspaceB.id, contactA.id);
    expect(crossAccess).toBeNull();

    // 3. Same email normalized can exist independently across different workspaces without conflict
    const sharedEmailCSV = `Name,Email
Shared Lead,shared.lead@domain.com`;

    const resA = await importer.importCSV(sharedEmailCSV, { workspaceId: workspaceA.id });
    const resB = await importer.importCSV(sharedEmailCSV, { workspaceId: workspaceB.id });

    expect(resA.importedCount).toBe(1);
    expect(resB.importedCount).toBe(1);
  });

  it('manually toggles suppression status and creates an append-only audit event', async () => {
    const [contact] = await db
      .insert(contacts)
      .values({
        id: crypto.randomUUID(),
        workspaceId: workspaceA.id,
        name: 'Eva Green',
        emailNormalized: 'eva@greentech.org',
        isSuppressed: false,
      })
      .returning();

    // Suppress contact
    const suppressed = await contactService.setSuppression({
      workspaceId: workspaceA.id,
      contactId: contact.id,
      isSuppressed: true,
      reason: 'Requested GDPR erasure of marketing communications',
      userId: 'admin_user_99',
    });

    expect(suppressed.isSuppressed).toBe(true);
    expect(suppressed.suppressionReason).toContain('GDPR erasure');

    // Verify audit event
    const [auditEvt] = await db
      .select()
      .from(events)
      .where(
        and(
          eq(events.workspaceId, workspaceA.id),
          eq(events.eventType, 'CONTACT_SUPPRESSED')
        )
      );

    expect(auditEvt).toBeDefined();
    const payload = auditEvt.payloadJson as any;
    expect(payload.email).toBe('eva@greentech.org');
    expect(payload.reason).toContain('GDPR erasure');
    expect(payload.userId).toBe('admin_user_99');

    // Unsuppress contact
    const unsuppressed = await contactService.setSuppression({
      workspaceId: workspaceA.id,
      contactId: contact.id,
      isSuppressed: false,
      userId: 'admin_user_99',
    });

    expect(unsuppressed.isSuppressed).toBe(false);
    expect(unsuppressed.suppressionReason).toBeNull();
  });
});
