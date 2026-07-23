'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function EditMovie({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const movieId = resolvedParams.id;
  
  const [formData, setFormData] = useState({
    name: '',
    link: '',
    imdb: '',
    description: '',
    thumbnail: '',
    trailer: ''
  });
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMovie = async () => {
      try {
        const response = await fetch(`/api/movies/${movieId}`);
        if (!response.ok) throw new Error('Failed to load movie');
        const data = await response.json();
        setFormData({
          name: data.name || '',
          link: data.link || '',
          imdb: data.imdb || '',
          description: data.description || '',
          thumbnail: data.thumbnail || '',
          trailer: data.trailer || ''
        });
      } catch (err) {
        setError('Could not load movie details.');
      } finally {
        setIsFetching(false);
      }
    };
    
    if (movieId) {
      fetchMovie();
    }
  }, [movieId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setUploadProgress(null);
    setError('');

    try {
      if (!formData.link && !videoFile) {
        throw new Error('Please provide either a Movie Link or upload a Video File.');
      }

      let finalMovieLink = formData.link;

      if (videoFile) {
        if (videoFile.size > 5 * 1024 * 1024 * 1024) {
          throw new Error('File exceeds 5GB limit.');
        }

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: videoFile.name,
            fileType: videoFile.type,
            fileSize: videoFile.size
          })
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          if (uploadRes.status === 403) {
            alert(`5GB Limit Hit! You have used ${(uploadData.currentSize / 1024 / 1024 / 1024).toFixed(2)}GB out of 5GB. Please delete a movie first.`);
          }
          throw new Error(uploadData.error || 'Failed to initialize upload');
        }

        // Upload the file directly to Tigris using XMLHttpRequest to track progress
        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open('PUT', uploadData.uploadUrl, true);
          xhr.setRequestHeader('Content-Type', videoFile.type);
          
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const percentComplete = Math.round((event.loaded / event.total) * 100);
              setUploadProgress(percentComplete);
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(xhr.responseText);
            } else {
              reject(new Error('Failed to upload video to cloud storage'));
            }
          };

          xhr.onerror = () => reject(new Error('Network error during upload'));
          xhr.send(videoFile);
        });

        // Save the stream proxy link to the database
        finalMovieLink = `/api/stream?key=${uploadData.key}`;
      }

      // Extract src URL if the user pasted an iframe
      let finalTrailer = formData.trailer;
      if (finalTrailer.includes('<iframe') && finalTrailer.includes('src="')) {
        const srcMatch = finalTrailer.match(/src="([^"]+)"/);
        if (srcMatch && srcMatch[1]) {
          finalTrailer = srcMatch[1];
        }
      }

      const submissionData = { ...formData, link: finalMovieLink, trailer: finalTrailer };

      const response = await fetch(`/api/movies/${movieId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submissionData)
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update movie');
      }

      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10">
      <div className="max-w-2xl mx-auto px-4">
        {/* Simple Navbar - No Image */}
        <header className="bg-gray-900 text-white rounded-t-xl border-b-4 border-orange-500 mb-6">
          <div className="max-w-2xl mx-auto px-4 py-4">
            <nav className="flex items-center justify-between">
              <Link href="/" className="text-xl font-bold tracking-tight hover:text-orange-500 transition-colors">
                Zivic Theatre
              </Link>
              
              <Link
                href="/"
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
              >
                Back
              </Link>
            </nav>
          </div>
        </header>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-5 border-b-4 border-orange-500">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center text-xl">
                ✏️
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  Edit Movie
                </h1>
                <p className="text-gray-400 text-sm">
                  Update movie details
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          {isFetching ? (
            <div className="p-10 flex justify-center items-center text-gray-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mr-3"></div>
              Loading movie data...
            </div>
          ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Movie Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Movie Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter movie name"
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 focus:border-orange-500 focus:outline-none dark:bg-gray-700 dark:text-white transition-colors"
              />
            </div>

            {/* Video File Upload */}
            <div>
              <label htmlFor="videoFile" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Upload Movie (.mp4)
              </label>
              <input
                type="file"
                id="videoFile"
                accept="video/mp4,video/webm"
                onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 focus:border-orange-500 focus:outline-none dark:bg-gray-700 dark:text-gray-300 transition-colors file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
              />
            </div>

            <div className="flex items-center">
              <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
              <span className="px-4 text-sm text-gray-500 dark:text-gray-400 font-semibold uppercase">OR</span>
              <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
            </div>

            {/* Movie Link */}
            <div>
              <label htmlFor="link" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Provide Movie Link
              </label>
              <input
                type="url"
                id="link"
                name="link"
                value={formData.link}
                onChange={handleChange}
                placeholder="YouTube, VK, or direct video URL"
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 focus:border-orange-500 focus:outline-none dark:bg-gray-700 dark:text-white transition-colors"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 space-y-1">
                <p><strong>YouTube:</strong> Use embed URL (e.g., https://www.youtube.com/embed/...)</p>
                <p><strong>VK Video:</strong> Use iframe src URL</p>
                <p><strong>Direct URL:</strong> Any direct video file URL</p>
              </div>
            </div>

            {/* IMDb Link */}
            <div>
              <label htmlFor="imdb" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                IMDb Link
              </label>
              <input
                type="url"
                id="imdb"
                name="imdb"
                value={formData.imdb}
                onChange={handleChange}
                placeholder="https://www.imdb.com/title/..."
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 focus:border-orange-500 focus:outline-none dark:bg-gray-700 dark:text-white transition-colors"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                placeholder="Short description of the movie"
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 focus:border-orange-500 focus:outline-none dark:bg-gray-700 dark:text-white transition-colors resize-none"
              />
            </div>

            {/* Thumbnail URL */}
            <div>
              <label htmlFor="thumbnail" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Thumbnail URL
              </label>
              <input
                type="url"
                id="thumbnail"
                name="thumbnail"
                value={formData.thumbnail}
                onChange={handleChange}
                placeholder="https://example.com/thumbnail.jpg"
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 focus:border-orange-500 focus:outline-none dark:bg-gray-700 dark:text-white transition-colors"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <p>Optional: URL to a thumbnail image for the movie</p>
              </div>
            </div>

            {/* Trailer Iframe */}
            <div>
              <label htmlFor="trailer" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Trailer (Iframe or URL)
              </label>
              <textarea
                id="trailer"
                name="trailer"
                rows={3}
                value={formData.trailer}
                onChange={handleChange}
                placeholder='Paste the IMDb or YouTube <iframe src="..."> embed code here'
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 dark:border-gray-600 focus:border-orange-500 focus:outline-none dark:bg-gray-700 dark:text-white transition-colors resize-none"
              />
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <p>Optional: Paste an iframe to show a trailer in the movie card</p>
              </div>
            </div>

            {/* Progress Bar */}
            {uploadProgress !== null && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                  <span>Uploading Video...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 overflow-hidden">
                  <div className="bg-orange-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg font-semibold hover:from-orange-600 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving Changes...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </form>
          )}
        </div>
      </div>
    </main>
  );
}