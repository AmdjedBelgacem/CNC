import { buildConfig } from 'payload';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { s3Storage } from '@payloadcms/storage-s3';
import { seoPlugin } from '@payloadcms/plugin-seo';
import { Tenants } from './collections/Tenants';
import { Users } from './collections/Users';
import { Courses } from './collections/Courses';
import { Series } from './collections/Series';
import { Lessons } from './collections/Lessons';
import { Products } from './collections/Products';
import { Posts } from './collections/Posts';
import { Comments } from './collections/Comments';
import { Certifications } from './collections/Certifications';
import { Events } from './collections/Events';
import { Sponsors } from './collections/Sponsors';
import { Media } from './collections/Media';
import { Navigation } from './collections/Navigation';
import { Themes } from './collections/Themes';
import { Pages } from './collections/Pages';
import { CertTemplates } from './collections/CertTemplates';

const hasS3Storage = Boolean(process.env.S3_BUCKET);
const hasS3Credentials = Boolean(
  process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY,
);
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to start the Payload admin. Copy apps/admin/.env.example to apps/admin/.env and configure PostgreSQL first.',
  );
}

export default buildConfig({
  // Payload requires a stable secret for session and token signing. Configure
  // PAYLOAD_SECRET outside development; the fallback keeps local startup usable.
  secret: process.env.PAYLOAD_SECRET || 'development-only-change-me',
  admin: {
    user: 'users',
    meta: {
      titleSuffix: ' - TITANS Admin',
    },
  },
  collections: [
    Tenants,
    Users,
    Courses,
    Series,
    Lessons,
    Products,
    Posts,
    Comments,
    Certifications,
    Events,
    Sponsors,
    Media,
    Navigation,
    Themes,
    Pages,
    CertTemplates,
  ],
  editor: lexicalEditor({}),
  db: postgresAdapter({
    pool: {
      connectionString: databaseUrl,
    },
  }),
  plugins: [
    s3Storage({
      bucket: process.env.S3_BUCKET || 'titans-cnc',
      collections: {
        media: true,
      },
      // Without an explicitly configured bucket, retain Payload's local upload
      // adapter so development does not try to upload to a placeholder bucket.
      enabled: hasS3Storage,
      disableLocalStorage: hasS3Storage,
      config: {
        region: process.env.S3_REGION || 'us-east-1',
        ...(hasS3Credentials
          ? {
              credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY!,
                secretAccessKey: process.env.S3_SECRET_KEY!,
              },
            }
          : {}),
        endpoint: process.env.S3_ENDPOINT,
        forcePathStyle: true,
      },
    }),
    seoPlugin({
      collections: ['courses', 'series', 'lessons', 'products', 'events', 'pages'],
      uploadsCollection: 'media',
    }),
  ],
});
