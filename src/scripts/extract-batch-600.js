const fs = require('fs');

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const rows = [];
  for (const line of lines) {
    const row = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    row.push(cur.trim());
    rows.push(row);
  }
  return rows;
}

const csvText = fs.readFileSync('conference_2026.csv', 'utf8');
const rows = parseCSV(csvText);
const header = rows[0];
const emailIdx = header.indexOf('email');
const nameIdx = header.indexOf('name');
const orgIdx = header.indexOf('organization');
const countryIdx = header.indexOf('organization_country_code');
const titleIdx = header.indexOf('Abstract title');
const descIdx = header.indexOf('description');

const existing = new Set([
  'saurabhjaipur@gmail.com',
  'saubconsulting@gmail.com',
  'ayuba.a@arfh-ng.org',
  'abel.kjaersgaard@lshtm.ac.uk',
  'dearaby27@gmail.com',
  'abigaildaniel689@gmail.com',
  'abigail.devilliers@uni-heidelberg.de',
  'ademola@bgri.org.ng',
  'adeoluwagbemiga@gmail.com',
  'aakriti819@gmail.com',
  'akash007@uottawa.ca',
  'akadam2@jhmi.edu',
  'team@email.hostinger.com',
  'saurabh@soniccloud.com',
  'inquiry@acme-partner.com',
  'draakshikalra@gmail.com'
]);

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const candidates = [];
const seenEmails = new Set();

for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const email = (row[emailIdx] || '').toLowerCase().trim();
  const name = (row[nameIdx] || '').trim();
  const org = (row[orgIdx] || '').trim();
  const country = (row[countryIdx] || '').trim();
  const abstractTitle = (row[titleIdx] || '').trim();
  const description = (row[descIdx] || '').trim();

  if (!email || !emailRegex.test(email)) continue;
  if (email.includes('kncv') || org.toLowerCase().includes('kncv')) continue;
  if (existing.has(email) || seenEmails.has(email)) continue;

  seenEmails.add(email);
  candidates.push({
    name,
    email,
    org,
    country,
    abstractTitle,
    description: description.slice(0, 300)
  });
}

// Slice from index 300 to 900 (600 candidates)
const batch600 = candidates.slice(300, 900);
console.log('Total eligible in pool:', candidates.length);
console.log('Extracted batch 600 count:', batch600.length);
console.log('Sample 1 of batch 600:', batch600[0]);
console.log('Sample 600 of batch 600:', batch600[batch600.length - 1]);

fs.writeFileSync('batch_600_candidates.json', JSON.stringify(batch600, null, 2));
console.log('Wrote batch_600_candidates.json successfully.');
