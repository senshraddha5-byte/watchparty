import { S3Client } from '@aws-sdk/client-s3';

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const endpoint = process.env.AWS_ENDPOINT_URL_S3;
const region = process.env.AWS_REGION || 'auto';

if (!accessKeyId || !secretAccessKey || !endpoint) {
  console.error('Missing Tigris AWS credentials in .env.local');
}

export const s3Client = new S3Client({
  region,
  endpoint,
  credentials: {
    accessKeyId: accessKeyId || '',
    secretAccessKey: secretAccessKey || ''
  },
  // Force path style is often required for non-AWS S3 compatible storage
  forcePathStyle: true,
});

export const BUCKET_NAME = process.env.TIGRIS_BUCKET_NAME || 'watchparty-videos';
