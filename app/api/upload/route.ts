import { NextResponse } from 'next/server';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { PutObjectCommand, ListObjectsV2Command, CreateBucketCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

const MAX_STORAGE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

export async function POST(request: Request) {
  try {
    const { fileName, fileType, fileSize } = await request.json();

    if (!fileName || !fileType || !fileSize) {
      return NextResponse.json({ error: 'Missing file details' }, { status: 400 });
    }

    // Check bucket existence and calculate current size
    let currentTotalSize = 0;
    try {
      const listCommand = new ListObjectsV2Command({ Bucket: BUCKET_NAME });
      const listResponse = await s3Client.send(listCommand);
      
      if (listResponse.Contents) {
        currentTotalSize = listResponse.Contents.reduce((total, item) => total + (item.Size || 0), 0);
      }
    } catch (error: any) {
      if (error.name === 'NoSuchBucket') {
        // Create bucket if it doesn't exist
        try {
          await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
        } catch (createError) {
          console.error('Failed to create bucket:', createError);
          return NextResponse.json({ error: 'Failed to initialize storage bucket' }, { status: 500 });
        }
      } else {
        console.error('Error listing objects:', error);
        return NextResponse.json({ error: 'Storage check failed' }, { status: 500 });
      }
    }

    // Enforce 5GB limit
    if (currentTotalSize + fileSize > MAX_STORAGE_BYTES) {
      return NextResponse.json({ 
        error: 'Storage limit exceeded. Please delete a movie first.',
        currentSize: currentTotalSize,
        limit: MAX_STORAGE_BYTES
      }, { status: 403 });
    }

    // Generate unique key and presigned URL for upload
    const extension = fileName.split('.').pop() || 'mp4';
    const key = `videos/${uuidv4()}.${extension}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
    });

    // URL valid for 15 minutes
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });

    return NextResponse.json({
      uploadUrl: signedUrl,
      key: key
    });
  } catch (error) {
    console.error('Error generating upload URL:', error);
    return NextResponse.json({ error: 'Failed to prepare upload' }, { status: 500 });
  }
}
