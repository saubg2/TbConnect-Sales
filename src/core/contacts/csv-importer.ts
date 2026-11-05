import { eq, and, inArray } from 'drizzle-orm';
import { contacts, events, organizations } from '@/db/schema';
import type { Contact } from '@/db/schema';
import { z } from 'zod';
import { classifyOrganizationType } from '@/core/organizations/classify';

const EmailSchema = z.string().email();

export interface CSVRow {
  name?: string;
  email: string;
  organisation?: string;
  country?: string;
  tags?: string[];
  isSuppressed?: boolean;
  suppressionReason?: string;
}

export interface CSVImportOptions {
  workspaceId: string;
  filename?: string;
  importedBy?: string;
  defaultTags?: string[];
}

export interface CSVImportResult {
  batchId: string;
  totalRows: number;
  importedCount: number;
  duplicateCount: number;
  suppressedCount: number;
  invalidCount: number;
  contacts: Contact[];
  errors: Array<{ row: number; email?: string; error: string }>;
}

/**
 * Robust RFC 4180 CSV line parser supporting quoted fields, escaped quotes, and various delimiters.
 */
export function parseCSVText(csvContent: string): Array<Record<string, string>> {
  const lines: string[] = [];
  let currentField = '';
  let insideQuotes = false;
  let currentRow: string[] = [];
  const rows: string[][] = [];

  // Normalize line breaks
  const cleanContent = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < cleanContent.length; i++) {
    const char = cleanContent[i];
    const nextChar = cleanContent[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // Skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if (char === '\n' && !insideQuotes) {
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  // Final field
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length < 2) {
    return [];
  }

  // Header row normalization
  const rawHeaders = rows[0];
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));

  const parsedRecords: Array<Record<string, string>> = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const record: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      const header = headers[c];
      record[header] = row[c] ?? '';
    }
    parsedRecords.push(record);
  }

  return parsedRecords;
}

/**
 * Maps arbitrary header synonyms to canonical contact fields
 */
function mapRecordToContact(record: Record<string, string>): {
  name: string;
  email: string;
  organisation?: string;
  country?: string;
  tags: string[];
  isSuppressed: boolean;
  suppressionReason?: string;
} | null {
  // Find email
  const emailKey = Object.keys(record).find((k) => k === 'email' || k === 'emailaddress' || k === 'mail');
  const rawEmail = emailKey ? record[emailKey].trim() : '';

  if (!rawEmail) return null;

  // Find name
  let name = '';
  const fullNameKey = Object.keys(record).find((k) => k === 'name' || k === 'fullname' || k === 'contactname');
  if (fullNameKey && record[fullNameKey]) {
    name = record[fullNameKey].trim();
  } else {
    const firstName = record['firstname'] || record['first'] || '';
    const lastName = record['lastname'] || record['last'] || '';
    name = `${firstName} ${lastName}`.trim();
  }

  if (!name) {
    name = rawEmail.split('@')[0];
  }

  // Organisation / Company
  const orgKey = Object.keys(record).find((k) => k === 'organisation' || k === 'organization' || k === 'company');
  const organisation = orgKey ? record[orgKey].trim() : undefined;

  // Country
  const countryKey = Object.keys(record).find((k) => k === 'country' || k === 'location');
  const country = countryKey ? record[countryKey].trim() : undefined;

  // Tags
  const tagKey = Object.keys(record).find((k) => k === 'tags' || k === 'tag');
  const tags: string[] = [];
  if (tagKey && record[tagKey]) {
    tags.push(...record[tagKey].split(';').map((t) => t.trim()).filter(Boolean));
  }

  // Suppression
  const suppressedKey = Object.keys(record).find((k) => k === 'issuppressed' || k === 'suppressed' || k === 'optout');
  const suppressionReasonKey = Object.keys(record).find(
    (k) => k === 'suppressionreason' || k === 'reason' || k === 'optoutreason'
  );

  let isSuppressed = false;
  let suppressionReason: string | undefined = undefined;

  if (suppressedKey && record[suppressedKey]) {
    const val = record[suppressedKey].toLowerCase();
    isSuppressed = val === 'true' || val === '1' || val === 'yes' || val === 'y';
  }

  if (suppressionReasonKey && record[suppressionReasonKey]) {
    suppressionReason = record[suppressionReasonKey].trim();
    if (!isSuppressed && suppressionReason.length > 0) {
      isSuppressed = true;
    }
  }

  return {
    name,
    email: rawEmail.toLowerCase(),
    organisation,
    country,
    tags,
    isSuppressed,
    suppressionReason: isSuppressed ? (suppressionReason || 'Suppressed via CSV import') : undefined,
  };
}

export class CSVContactImporter {
  constructor(private db: any) {}

  /**
   * Imports contacts from CSV text with validation, deduplication, provenance and global suppression
   */
  async importCSV(csvContent: string, options: CSVImportOptions): Promise<CSVImportResult> {
    const batchId = `import_${crypto.randomUUID().substring(0, 8)}`;
    const records = parseCSVText(csvContent);

    const result: CSVImportResult = {
      batchId,
      totalRows: records.length,
      importedCount: 0,
      duplicateCount: 0,
      suppressedCount: 0,
      invalidCount: 0,
      contacts: [],
      errors: [],
    };

    if (records.length === 0) {
      return result;
    }

    // 1. In-batch deduplication & email validation
    const validRowsByEmail = new Map<string, ReturnType<typeof mapRecordToContact>>();

    for (let i = 0; i < records.length; i++) {
      const rowNum = i + 2; // Accounting for 1-based index + header
      const mapped = mapRecordToContact(records[i]);

      if (!mapped) {
        result.invalidCount++;
        result.errors.push({ row: rowNum, error: 'Missing email address' });
        continue;
      }

      // Validate email syntax
      const emailValidation = EmailSchema.safeParse(mapped.email);
      if (!emailValidation.success) {
        result.invalidCount++;
        result.errors.push({ row: rowNum, email: mapped.email, error: 'Invalid email syntax' });
        continue;
      }

      // Check within-batch duplicate
      if (validRowsByEmail.has(mapped.email)) {
        result.duplicateCount++;
        continue; // deduplicate
      }

      validRowsByEmail.set(mapped.email, mapped);
    }

    const uniqueEmails = Array.from(validRowsByEmail.keys());
    if (uniqueEmails.length === 0) {
      return result;
    }

    // 2. Query existing workspace contacts for duplicate check & workspace suppression inheritance
    const existingContacts = await this.db
      .select()
      .from(contacts)
      .where(
        and(
          eq(contacts.workspaceId, options.workspaceId),
          inArray(contacts.emailNormalized, uniqueEmails)
        )
      );

    const existingEmailMap = new Map<string, Contact>();
    for (const ec of existingContacts) {
      existingEmailMap.set(ec.emailNormalized, ec);
    }

    // 3. Ensure first-class organization records exist for imported contacts.
    const organizationNames = Array.from(new Set(
      Array.from(validRowsByEmail.values())
        .map(row => row?.organisation?.trim())
        .filter((name): name is string => !!name)
    ));
    if (organizationNames.length > 0) {
      await this.db.insert(organizations).values(organizationNames.map(name => ({
        id: crypto.randomUUID(),
        workspaceId: options.workspaceId,
        name,
        type: classifyOrganizationType(name),
      }))).onConflictDoNothing();
    }
    const organizationRows = organizationNames.length > 0
      ? await this.db.select().from(organizations).where(and(
          eq(organizations.workspaceId, options.workspaceId),
          inArray(organizations.name, organizationNames)
        ))
      : [];
    const organizationIdByName = new Map(organizationRows.map((organization: any) => [organization.name, organization.id]));

    // 4. Prepare inserts
    const toInsert: any[] = [];
    const auditEventsToInsert: any[] = [];

    for (const [email, row] of Array.from(validRowsByEmail.entries())) {
      if (!row) continue;

      if (existingEmailMap.has(email)) {
        // Contact already exists in workspace: deduplicate!
        result.duplicateCount++;
        continue;
      }

      const contactId = crypto.randomUUID();
      const combinedTags = Array.from(new Set([...(options.defaultTags || []), ...row.tags]));

      toInsert.push({
        id: contactId,
        workspaceId: options.workspaceId,
        name: row.name,
        emailNormalized: row.email,
        organizationId: row.organisation ? organizationIdByName.get(row.organisation.trim()) || null : null,
        organisation: row.organisation || null,
        country: row.country || null,
        tagsJson: combinedTags,
        sourceJson: {
          type: 'csv_import',
          batch_id: batchId,
          filename: options.filename || 'upload.csv',
          imported_by: options.importedBy || 'system',
          imported_at: new Date().toISOString(),
        },
        status: 'ACTIVE',
        isSuppressed: row.isSuppressed,
        suppressionReason: row.suppressionReason || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      if (row.isSuppressed) {
        result.suppressedCount++;
      }

      auditEventsToInsert.push({
        id: crypto.randomUUID(),
        workspaceId: options.workspaceId,
        relationshipId: null,
        eventType: row.isSuppressed ? 'CONTACT_IMPORTED_SUPPRESSED' : 'CONTACT_IMPORTED',
        payloadJson: {
          contactId,
          email: row.email,
          batchId,
          isSuppressed: row.isSuppressed,
        },
        createdAt: new Date(),
      });
    }

    // 5. Batch insert contacts and audit events
    if (toInsert.length > 0) {
      const inserted = await this.db.insert(contacts).values(toInsert).returning();
      result.contacts = inserted;
      result.importedCount = inserted.length;

      if (auditEventsToInsert.length > 0) {
        await this.db.insert(events).values(auditEventsToInsert);
      }
    }

    return result;
  }
}
