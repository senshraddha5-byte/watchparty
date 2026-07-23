import { NextResponse } from 'next/server';
import { s3Client, BUCKET_NAME } from '@/lib/s3';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return new NextResponse('Missing video key', { status: 400 });
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    // Generate a presigned URL valid for 6 hours
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 21600 });

    // Redirect the video player to the actual presigned URL
    return NextResponse.redirect(signedUrl, 302);
  } catch (error) {
    console.error('Error generating stream URL:', error);
    return new NextResponse('Failed to generate stream URL', { status: 500 });
  }
}
