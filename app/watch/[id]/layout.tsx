'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import VideoPlayer from '@/components/VideoPlayer';

// Dynamic import for ChatBox to avoid SSR issues
const ChatBox = dynamic(() => import('@/components/ChatBox'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-xl">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-3"></div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading chat...</p>
      </div>
    </div>
  )
});

interface Movie {
  id: string;
  name: string;
  link: string;
  imdb: string;
  description: string;
}

interface WatchLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    id: string;
  }>;
}

export default function WatchLayout({ children, params }: WatchLayoutProps) {
  const resolvedParams = use(params);
  const [movie, setMovie] = useState<Movie | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [showUserModal, setShowUserModal] = useState(true);
  const [movieId, setMovieId] = useState<string>('');
  const [movieLink, setMovieLink] = useState<string>('');
  const [syncStatus, setSyncStatus] = useState<string>('');

  // Get movie ID from params
  useEffect(() => {
    if (resolvedParams?.id) {
      setMovieId(resolvedParams.id);
    }
  }, [resolvedParams]);

  const isOlivia = selectedUser === 'olivia';
  const themeColor = isOlivia ? 'pink' : 'blue';

  // Handle user selection
  const handleUserSelect = (user: string) => {
    setSelectedUser(user);
    setShowUserModal(false);
  };

  // Fetch movie data
  useEffect(() => {
    if (!movieId) return;
    
    const fetchMovie = async () => {
      try {
        const response = await fetch('/api/movies');
        const movies: Movie[] = await response.json();
        const foundMovie = movies.find(m => m.id === movieId);
        
        if (foundMovie) {
          setMovie(foundMovie);
          setMovieLink(foundMovie.link);
        }
      } catch (err) {
        console.error('Failed to load movie', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMovie();
  }, [movieId]);

  // Handle Visual Viewport API to fix mobile keyboard pushing the layout up
  useEffect(() => {
    const updateViewport = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      document.documentElement.style.setProperty('--vv-height', `${vv.height}px`);
      document.documentElement.style.setProperty('--vv-offset-top', `${vv.offsetTop}px`);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewport);
      window.visualViewport.addEventListener('scroll', updateViewport);
      updateViewport();
    }
    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewport);
        window.visualViewport.removeEventListener('scroll', updateViewport);
      }
    };
  }, []);

  // Show user modal first
  if (showUserModal) {
    return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-5xl mb-4">🎬</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">
              Who&apos;s watching?
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Select your profile to join the watch party
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleUserSelect('olivia')}
                className="flex flex-col items-center p-6 rounded-xl border-2 border-pink-200 dark:border-pink-700 hover:border-pink-500 hover:bg-pink-50 dark:hover:bg-pink-900/20 transition-all group"
              >
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">👩</div>
                <span className="font-semibold text-pink-600 dark:text-pink-400">Olivia</span>
                <span className="text-xs text-pink-400 dark:text-pink-500 mt-1">Pink Theme</span>
              </button>
              
              <button
                onClick={() => handleUserSelect('kumar')}
                className="flex flex-col items-center p-6 rounded-xl border-2 border-blue-200 dark:border-blue-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
              >
                <div className="text-4xl mb-2 group-hover:scale-110 transition-transform">👨</div>
                <span className="font-semibold text-blue-600 dark:text-blue-400">Kumar</span>
                <span className="text-xs text-blue-400 dark:text-blue-500 mt-1">Blue Theme</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col bg-gray-900 overflow-hidden absolute w-full left-0 right-0"
      style={{
        height: 'var(--vv-height, 100dvh)',
        top: 'var(--vv-offset-top, 0px)'
      }}
    >
      {/* Video Player - Pinned to the top so it doesn't scroll away when keyboard opens */}
      <div className={`w-full bg-black shrink-0 z-10 relative border-b-4 ${isOlivia ? 'border-pink-500' : 'border-blue-500'}`}>
        <VideoPlayer
          movieId={movieId}
          movieLink={movieLink}
          user={selectedUser || 'kumar'}
          onStatusChange={setSyncStatus}
        />
      </div>

      {/* Scrollable Content Area (Chat & Description) */}
      <div className="flex-1 overflow-y-auto flex flex-col relative">

        {/* Chat Area */}
        <div className="flex-1 w-full max-w-2xl mx-auto px-2 sm:px-4 py-2 sm:py-4 flex flex-col min-h-0">
          <ChatBox user={selectedUser || 'kumar'} theme={themeColor} syncStatus={syncStatus} />
        </div>
      </div>
    </div>
  );
}
