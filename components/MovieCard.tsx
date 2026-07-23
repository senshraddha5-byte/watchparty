'use client';

import { useRouter } from 'next/navigation';

interface Movie {
  id: string;
  name: string;
  link: string;
  imdb: string;
  description: string;
  thumbnail?: string;
  trailer?: string;
}

interface MovieCardProps {
  movie: Movie;
  onDelete?: (id: string) => void;
}

export default function MovieCard({ movie, onDelete }: MovieCardProps) {
  const router = useRouter();

  const handleClick = () => {
    router.push(`/watch/${encodeURIComponent(movie.id)}`);
  };

  return (
    <div 
      onClick={handleClick}
      className="block group cursor-pointer"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md hover:shadow-2xl transition-all duration-300 transform group-hover:-translate-y-1 border border-gray-200 dark:border-gray-700">
        {/* Movie Poster/Thumbnail */}
        <div className="relative aspect-video bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800 flex items-center justify-center overflow-hidden">
          {movie.trailer ? (
            <iframe
              src={movie.trailer}
              className="absolute inset-0 w-full h-full border-0 pointer-events-auto"
              allowFullScreen
            />
          ) : movie.thumbnail ? (
            <img
              src={movie.thumbnail}
              alt={movie.name}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <>
              <div className="absolute inset-0 bg-gradient-to-t from-orange-500/20 to-transparent"></div>
              <div className="text-5xl opacity-40 group-hover:opacity-60 transition-opacity transform group-hover:scale-110">
                🎬
              </div>
            </>
          )}
          {!movie.trailer && (
            <div className="absolute top-3 right-3 bg-orange-500 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              Watch
            </div>
          )}
        </div>

        {/* Movie Info */}
        <div className="p-4">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-1 group-hover:text-orange-500 transition-colors line-clamp-1">
            {movie.name}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2 mb-3">
            {movie.description}
          </p>

          <div className="flex items-center justify-between mt-2">
            <div>
              {movie.imdb && (
                <a
                  href={movie.imdb}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center text-sm text-orange-500 hover:text-orange-600 font-medium transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14.5 3h-5v5h5v-5zM19.5 8h-5v5h5v-5zM3 3h5v5H3V3zm0 5h5v11H3V8zm16.5 0h5v11h-5V8z"/>
                  </svg>
                  IMDb
                  <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/edit/${encodeURIComponent(movie.id)}`);
                }}
                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                title="Edit Movie"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
              
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(movie.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                  title="Delete Movie"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}