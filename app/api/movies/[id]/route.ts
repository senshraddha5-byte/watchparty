import { NextResponse } from 'next/server';
import { getMovieById, updateMovie, deleteMovie } from '@/lib/models/movie';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const movie = await getMovieById(resolvedParams.id);
    
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }
    
    return NextResponse.json(movie);
  } catch (error) {
    console.error('Error fetching movie:', error);
    return NextResponse.json({ error: 'Failed to fetch movie' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const body = await request.json();
    
    const success = await updateMovie(resolvedParams.id, body);
    
    if (!success) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating movie:', error);
    return NextResponse.json({ error: 'Failed to update movie' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    
    // First, fetch the movie to check if it's hosted on Tigris
    const movie = await getMovieById(resolvedParams.id);
    if (!movie) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }

    // Check if the link contains our Tigris stream proxy
    if (movie.link && movie.link.includes('/api/stream?key=')) {
      const key = new URL(movie.link, 'http://localhost').searchParams.get('key');
      if (key) {
        try {
          const { s3Client, BUCKET_NAME } = await import('@/lib/s3');
          const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
          await s3Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
          }));
          console.log(`Deleted S3 object: ${key}`);
        } catch (s3Error) {
          console.error('Failed to delete from S3:', s3Error);
          // Continue to delete from DB even if S3 delete fails
        }
      }
    }

    const success = await deleteMovie(resolvedParams.id);
    
    if (!success) {
      return NextResponse.json({ error: 'Movie not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting movie:', error);
    return NextResponse.json({ error: 'Failed to delete movie' }, { status: 500 });
  }
}
