
/**
 * Migration script to move files from Airtable attachments to Supabase Storage
 * Run with: tsx scripts/migrateFilesToSupabase.ts
 */

import { createClient } from '@supabase/supabase-js';
import Airtable from 'airtable';

// Configuration
const AIRTABLE_PAT = process.env.AIRTABLE_PAT || '';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || '';
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

// Initialize clients
const airtable = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Table configurations
const TABLES = [
  {
    name: 'TrainingModules',
    fileField: 'moduleFile',
    supabaseBucket: 'clinical-programs',
    pathPrefix: 'clinical-programs',
  },
  {
    name: 'ProtocolManuals',
    fileField: 'protocolFile',
    supabaseBucket: 'clinical-programs',
    pathPrefix: 'clinical-programs',
  },
  {
    name: 'DocumentationForms',
    fileField: 'formFile',
    supabaseBucket: 'clinical-programs',
    pathPrefix: 'clinical-programs',
  },
  {
    name: 'AdditionalResources',
    fileField: 'resourceFile',
    supabaseBucket: 'clinical-programs',
    pathPrefix: 'clinical-programs',
  },
  {
    name: 'PatientHandouts',
    fileField: 'handoutFile',
    supabaseBucket: 'resource-library',
    pathPrefix: 'resource-library',
  },
  {
    name: 'ClinicalGuidelines',
    fileField: 'guidelineFile',
    supabaseBucket: 'resource-library',
    pathPrefix: 'resource-library',
  },
  {
    name: 'MedicalBillingResources',
    fileField: 'billingresourceFile',
    supabaseBucket: 'resource-library',
    pathPrefix: 'resource-library',
  },
];

async function downloadFile(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${url}`);
  }
  return response.blob();
}

async function uploadToSupabase(
  bucket: string,
  path: string,
  file: Blob,
  contentType: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  return data.path;
}

async function migrateTable(tableName: string, fileField: string, bucket: string, pathPrefix: string) {
  console.log(`\nMigrating table: ${tableName}`);
  
  const records = await airtable(tableName).select().all();
  let migrated = 0;
  let failed = 0;

  for (const record of records) {
    const attachments = record.get(fileField) as any[] || [];
    
    if (attachments.length === 0) {
      continue;
    }

    const attachment = attachments[0];
    const fileName = attachment.filename;
    const fileType = attachment.type || 'application/octet-stream';
    
    try {
      // Create Supabase path
      const programSlug = record.get('programSlug') as string || 'uncategorized';
      const supabasePath = `${pathPrefix}/${programSlug}/${fileName}`;
      
      // Download from Airtable
      console.log(`Downloading: ${fileName}`);
      const fileBlob = await downloadFile(attachment.url);
      
      // Upload to Supabase
      console.log(`Uploading to: ${supabasePath}`);
      await uploadToSupabase(bucket, supabasePath, fileBlob, fileType);
      
      // Update Airtable record with Supabase path
      await airtable(tableName).update(record.id, {
        supabaseFilePath: supabasePath,
      });
      
      migrated++;
      console.log(`✓ Migrated: ${fileName}`);
    } catch (error) {
      failed++;
      console.error(`✗ Failed to migrate ${fileName}:`, error.message);
    }
  }

  console.log(`Table ${tableName} complete: ${migrated} migrated, ${failed} failed`);
}

async function main() {
  console.log('Starting file migration from Airtable to Supabase...\n');

  for (const table of TABLES) {
    await migrateTable(table.name, table.fileField, table.supabaseBucket, table.pathPrefix);
  }

  console.log('\nMigration complete!');
}

main().catch(console.error);
