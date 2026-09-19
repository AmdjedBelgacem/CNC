// Bootstraps the local MinIO bucket that `docker-compose.yml` normally creates
// via the `minio-create-bucket` one-shot container.
//
// Why this exists: the compose path needs Docker, and Docker is not always
// available (it is not in the sandbox this repo is developed in). When MinIO is
// started natively there is no `mc` client to run `mc mb` / `mc anonymous set
// public` with, so the bucket never gets created and every presigned URL 404s.
//
// This does the same three things the compose container does, using the AWS SDK
// that the backend already depends on:
//   1. create the bucket (idempotent)
//   2. apply a public-read object policy
//   3. verify with HEAD
//
// Usage (from apps/backend, so `@aws-sdk/client-s3` resolves):
//   node scripts/minio-bootstrap.mjs
//
// Env: S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION
// all fall back to the local-dev defaults below.
//
// NOTE: the HTTP_PROXY/HTTPS_PROXY variables must be cleared for this to reach
// a loopback MinIO. `curl` skips the proxy for localhost on its own; Node does
// not, and a proxied S3 request fails with an opaque socket error.
import {
  S3Client,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  ListBucketsCommand,
} from '@aws-sdk/client-s3';

const endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
const bucket = process.env.S3_BUCKET ?? 'titans-local';
const region = process.env.S3_REGION ?? 'us-east-1';

const client = new S3Client({
  region,
  endpoint,
  forcePathStyle: true, // required for MinIO; see docs/storage/COURSE_VIDEO_STORAGE.md
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? 'minioadmin',
    secretAccessKey: process.env.S3_SECRET_KEY ?? 'minioadmin',
  },
});

console.log(`minio-bootstrap: endpoint=${endpoint} bucket=${bucket}`);

try {
  await client.send(new CreateBucketCommand({ Bucket: bucket }));
  console.log(`  created bucket: ${bucket}`);
} catch (e) {
  if (e.name === 'BucketAlreadyOwnedByYou' || e.name === 'BucketAlreadyExists') {
    console.log(`  bucket already exists: ${bucket}`);
  } else {
    console.error(`  create failed: ${e.name} — ${e.message}`);
    process.exit(1);
  }
}

// Matches `mc anonymous set public local/titans-local` from the compose file.
const policy = {
  Version: '2012-10-17',
  Statement: [
    {
      Effect: 'Allow',
      Principal: { AWS: ['*'] },
      Action: ['s3:GetObject'],
      Resource: [`arn:aws:s3:::${bucket}/*`],
    },
  ],
};

try {
  await client.send(
    new PutBucketPolicyCommand({ Bucket: bucket, Policy: JSON.stringify(policy) }),
  );
  console.log('  public-read policy applied');
} catch (e) {
  console.error(`  policy failed: ${e.name} — ${e.message}`);
  process.exit(1);
}

const head = await client.send(new HeadBucketCommand({ Bucket: bucket }));
console.log(`  HEAD bucket -> ${head.$metadata.httpStatusCode}`);

const list = await client.send(new ListBucketsCommand({}));
console.log(`  buckets: ${(list.Buckets ?? []).map((b) => b.Name).join(', ') || '(none)'}`);
console.log('minio-bootstrap: OK');
