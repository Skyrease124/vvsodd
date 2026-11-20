#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const { validateCountyImport } = require('../netlify/lib/county-import-validation');

const [file, state, ...countyParts] = process.argv.slice(2);
const county = countyParts.join(' ');
if (!file || !state || !county) {
  console.error('Usage: node scripts/check-county-import.js <file.json> <STATE> <County Name>');
  process.exitCode = 2;
} else {
  try {
    const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
    const report = validateCountyImport(rows, { state, county });
    console.log(JSON.stringify({
      ...report.summary,
      readyToPublish: report.readyToPublish,
      errors: report.rejected.slice(0, 25)
    }, null, 2));
    if (!report.readyToPublish) process.exitCode = 1;
  } catch (error) {
    console.error('Import preflight failed:', error.message);
    process.exitCode = 1;
  }
}
