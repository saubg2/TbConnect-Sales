import { NextResponse } from 'next/server';
import { getDbAsync } from '@/db/client';
import { CSVContactImporter } from '@/core/contacts/csv-importer';

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let csvText = '';
    let workspaceId = 'ws_default';
    let filename = 'import.csv';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      csvText = body.csvText || '';
      workspaceId = body.workspaceId || 'ws_default';
      filename = body.filename || 'paste.csv';
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return NextResponse.json({ error: 'No CSV file uploaded' }, { status: 400 });
      }
      csvText = await file.text();
      filename = file.name;
      workspaceId = (formData.get('workspaceId') as string) || 'ws_default';
    } else {
      csvText = await req.text();
    }

    if (!csvText || csvText.trim().length === 0) {
      return NextResponse.json({ error: 'CSV content cannot be empty' }, { status: 400 });
    }

    const db = await getDbAsync();
    const importer = new CSVContactImporter(db);
    const result = await importer.importCSV(csvText, {
      workspaceId,
      filename,
      importedBy: 'web_operator',
    });

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
