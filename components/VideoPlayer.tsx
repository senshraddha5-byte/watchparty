'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface VideoPlayerProps {
  movieId: string;
  movieLink: string | null;
  user: string;
  onStatusChange?: (status: string) => void;
}

interface PlaybackState {
  currentTime: number;
  isPlaying: boolean;
  isBuffering?: boolean;
  lastUpdatedBy: string;
  lastUpdatedAt: number;
  action?: string;
}

// Helper function to convert YouTube URL to embed URL
function getYouTubeEmbedUrl(url: string): string {
  if (!url) return '';
  
  if (url.includes('youtube.com/embed') || url.includes('youtu.be/embed')) {
    return url;
  }
  
  let videoId = '';
  
  if (url.includes('youtu.be/')) {
    videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
  } else if (url.includes('youtube.com/watch')) {
    const urlObj = new URL(url);
    videoId = urlObj.searchParams.get('v') || '';
  } else if (url.includes('youtube.com/')) {
    videoId = url.split('v=')[1]?.split('&')[0] || '';
  }
  
  if (videoId) {
    return `https://www.youtube.com/embed/${videoId}?enablejsapi=1`;
  }
  
  return '';
}

// Helper function to convert Google Drive URL to embed URL
function getGoogleDriveEmbedUrl(url: string): string {
  if (!url) return '';
  
  // Already in embed format
  if (url.includes('drive.google.com/file/d/') && url.includes('/preview')) {
    return url;
  }
  
  // Extract file ID from various Google Drive URL formats
  let fileId = '';
  
  // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  if (url.includes('drive.google.com/file/d/')) {
    fileId = url.split('drive.google.com/file/d/')[1]?.split('/')[0] || '';
  }
  // Format: https://drive.google.com/open?id=FILE_ID
  else if (url.includes('drive.google.com/open')) {
    const urlObj = new URL(url);
    fileId = urlObj.searchParams.get('id') || '';
  }
  
  if (fileId) {
    return `https://drive.google.com/file/d/${fileId}/preview`;
  }
  
  return '';
}

// Helper function to convert VK Video URL to embed URL
function getVKVideoEmbedUrl(url: string): string {
  if (!url) return '';
  
  // Already in embed format
  if (url.includes('vk.com/video_ext.php')) {
    return url;
  }
  
  // Extract video ID from various VK Video URL formats
  let ownerId = '';
  let videoId = '';
  
  // Format: https://vkvideo.ru/video-OWNER_ID_VIDEO_ID
  // or: https://vk.com/video-OWNER_ID_VIDEO_ID
  const vkVideoMatch = url.match(/video(-?\d+)_(\d+)/);
  if (vkVideoMatch) {
    ownerId = vkVideoMatch[1];
    videoId = vkVideoMatch[2];
  }
  
  if (ownerId && videoId) {
    return `https://vk.com/video_ext.php?oid=${ownerId}&id=${videoId}&hd=2`;
  }
  
  return '';
}

// Helper function to get the appropriate embed URL based on the source
function getEmbedUrl(url: string): string {
  if (!url) return '';
  
  // Check for Google Drive
  if (url.includes('drive.google.com')) {
    return getGoogleDriveEmbedUrl(url);
  }
  
  // Check for YouTube
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    return getYouTubeEmbedUrl(url);
  }
  
  // Check for VK Video
  if (url.includes('vkvideo.ru') || url.includes('vk.com/video')) {
    return getVKVideoEmbedUrl(url);
  }
  
  // Return as-is for other URLs (direct video links)
  return url;
}

// YouTube Player state constants
const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_BUFFERING = 3;
const YT_CUED = 5;

// YouTube API types
interface YouTubePlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  addEventListener: (event: string, callback: (event: unknown) => void) => void;
}

// VK Video Player state constants
const VK_PLAYING = 1;
const VK_PAUSED = 2;
const VK_BUFFERING = 3;
const VK_ENDED = 0;

// VK Video API types
interface VKVideoPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number) => void;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  getDuration: () => number;
  addEventListener: (event: string, callback: (event: unknown) => void) => void;
}

// Format time as MM:SS
const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function VideoPlayer({ movieId, movieLink, user, onStatusChange }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);
  const vkPlayerRef = useRef<VKVideoPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [embedUrl, setEmbedUrl] = useState('');
  const [isIframe, setIsIframe] = useState(false);
  const [isYouTube, setIsYouTube] = useState(false);
  const [isVKVideo, setIsVKVideo] = useState(false);
  const [localState, setLocalState] = useState<PlaybackState>({
    currentTime: 0,
    isPlaying: false,
    lastUpdatedBy: '',
    lastUpdatedAt: 0,
    action: ''
  });
  // Use ref for quick access to latest state - avoids stale closure issues
  const localStateRef = useRef<PlaybackState>(localState);
  useEffect(() => {
    localStateRef.current = localState;
    if (onStatusChange) {
      let desc = '';
      if (localState.lastUpdatedBy) {
        if (localState.isBuffering && localState.lastUpdatedBy !== user) {
          desc = `${localState.lastUpdatedBy.charAt(0).toUpperCase() + localState.lastUpdatedBy.slice(1)} buffering...`;
        } else {
          const isMe = localState.lastUpdatedBy === user;
          const userName = isMe ? 'You' : (localState.lastUpdatedBy.charAt(0).toUpperCase() + localState.lastUpdatedBy.slice(1));
          if (localState.action) {
            desc = `${userName} ${localState.action}`;
          } else {
            desc = localState.isPlaying ? `${userName} is playing` : `${userName} paused`;
          }
        }
      }
      onStatusChange(desc);
    }
  }, [localState, onStatusChange, user]);
  const [isSyncing, setIsSyncing] = useState(false);
  const isWaitingForSyncRef = useRef(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const isLocalChangeRef = useRef(false);
  const playerReadyRef = useRef(false);
  const prevStateRef = useRef<PlaybackState>({ currentTime: 0, isPlaying: false, lastUpdatedBy: '', lastUpdatedAt: 0, action: '' });
  
  const [isSkipModalOpen, setIsSkipModalOpen] = useState(false);
  const [skipTimeInput, setSkipTimeInput] = useState('');
  
  const [showControls, setShowControls] = useState(false);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Convert URL to embed format
  useEffect(() => {
    if (!movieLink) {
      setEmbedUrl('');
      setIsIframe(false);
      setIsYouTube(false);
      setIsVKVideo(false);
      return;
    }
    const converted = getEmbedUrl(movieLink);
    setEmbedUrl(converted);
    // Check if it's an iframe embed (YouTube, Google Drive, or VK Video)
    const isYouTubeEmbed = converted.includes('youtube.com/embed');
    const isGoogleDriveEmbed = converted.includes('drive.google.com');
    const isVKVideoEmbed = converted.includes('vk.com/video_ext.php');
    setIsIframe(isYouTubeEmbed || isGoogleDriveEmbed || isVKVideoEmbed);
    setIsYouTube(isYouTubeEmbed);
    setIsVKVideo(isVKVideoEmbed);
  }, [movieLink]);

  // Initialize YouTube IFrame API (only for YouTube embeds)
  useEffect(() => {
    if (!isYouTube || !embedUrl) return;

    if (typeof window !== 'undefined' && (window as unknown as { YT?: YouTubePlayer }).YT) {
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as unknown as { onYouTubeIframeAPIReady: () => void }).onYouTubeIframeAPIReady = () => {
      
    };
  }, [isYouTube, embedUrl]);

  // Create player when embed URL is ready (only for YouTube embeds)
  useEffect(() => {
    if (!isYouTube || !embedUrl || !containerRef.current) return;

    const videoId = embedUrl.split('/embed/')[1]?.split('?')[0];
    if (!videoId) return;

    const checkApi = setInterval(() => {
      const YT = window as unknown as { YT?: { Player: new (el: string, config: object) => YouTubePlayer } };
      if (typeof YT !== 'undefined' && YT.YT && typeof YT.YT.Player === 'function') {
        clearInterval(checkApi);

        try {
          playerRef.current = new YT.YT!.Player(containerRef.current!.id || 'youtube-player', {
            videoId,
            playerVars: {
              enablejsapi: 1,
              controls: 1,
              modestbranding: 1,
              rel: 0,
              fs: 1,
              iv_load_policy: 3,
            },
            events: {
              onReady: (_event: unknown) => {
                
                playerReadyRef.current = true;
                setIsPlayerReady(true);
              },
              onStateChange: (_event: unknown) => {
                
                
                // Clear the flag immediately when any state change happens
                // This allows user actions to be synced even if a remote sync just happened
                const wasRemoteChange = isLocalChangeRef.current;
                isLocalChangeRef.current = false;
                
                // If this was a remote change (triggered by SSE), skip the sync
                if (wasRemoteChange) {
                  
                  return;
                }

                const typedEvent = _event as { data?: number };
                const state = typedEvent?.data;
                
                
                const isPlaying = state === YT_PLAYING;
                const isPaused = state === YT_PAUSED;
                const isBuffering = state === YT_BUFFERING;
                

                // Ignore buffering state - wait for actual play/pause
                if (isBuffering) {
                  
                  return;
                }

                if (isPlaying || isPaused) {
                  const currentTime = playerRef.current?.getCurrentTime() || 0;
                  
                  
                  // Determine action description
                  let action = '';
                  if (isPlaying) {
                    if (!prevStateRef.current.isPlaying) {
                      action = 'started playing';
                    } else if (Math.abs(currentTime - prevStateRef.current.currentTime) > 5) {
                      action = `skipped to ${formatTime(currentTime)}`;
                    }
                  } else if (isPaused) {
                    action = 'paused';
                  }
                  
                  prevStateRef.current = { 
                    ...prevStateRef.current, 
                    isPlaying, 
                    currentTime,
                    action
                  };
                  
                  
                  syncState({ 
                    isPlaying, 
                    currentTime: Math.floor(currentTime),
                    action
                  });
                } else {
                  
                }
              }
            }
          });
        } catch (error) {
          
        }
      }
    }, 200);

    return () => clearInterval(checkApi);
  }, [isYouTube, embedUrl]);

  // Initialize VK Video Player (only for VK Video embeds)
  // VK Video uses postMessage API to communicate player events
  useEffect(() => {
    if (!isVKVideo || !embedUrl || !containerRef.current) return;

    // Set up VK Video player reference immediately when iframe is ready
    const setupVKPlayer = () => {
      const iframe = containerRef.current?.querySelector('iframe');
      if (iframe && !vkPlayerRef.current) {
        // Create a wrapper object for VK Video player
        vkPlayerRef.current = {
          playVideo: () => {
            const iframe = containerRef.current?.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage(JSON.stringify({ event: 'play' }), '*');
            }
          },
          pauseVideo: () => {
            const iframe = containerRef.current?.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage(JSON.stringify({ event: 'pause' }), '*');
            }
          },
          seekTo: (seconds: number) => {
            const iframe = containerRef.current?.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
              iframe.contentWindow.postMessage(JSON.stringify({ event: 'seek', time: seconds }), '*');
            }
          },
          getCurrentTime: () => {
            return localStateRef.current.currentTime;
          },
          getPlayerState: () => {
            return localStateRef.current.isPlaying ? VK_PLAYING : VK_PAUSED;
          },
          getDuration: () => {
            return 0;
          },
          addEventListener: (event: string, callback: (event: unknown) => void) => {
            // VK Video events are handled via postMessage
          }
        };
        setIsPlayerReady(true);
        playerReadyRef.current = true;
      }
    };

    // Try to set up player immediately
    setupVKPlayer();

    // Also set up after a short delay to ensure iframe is loaded
    const setupTimeout = setTimeout(setupVKPlayer, 1000);

    // VK Video uses postMessage API to communicate player events
    const handleMessage = (event: MessageEvent) => {
      // Only handle messages from VK Video iframe
      if (!event.origin.includes('vk.com')) return;
      
      console.log('[VK Video] Received message from VK:', event.data);
      
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        
        console.log('[VK Video] Parsed data:', data);
        
        // Handle VK Video player events
        // VK Video sends events with an "event" field: "play", "pause", "seek", "ended", "ready"
        if (data.event) {
          const eventType = data.event;
          console.log('[VK Video] Event type:', eventType);
          
          let isPlaying = false;
          let action = '';
          
          if (eventType === 'play') {
            isPlaying = true;
            if (!prevStateRef.current.isPlaying) {
              action = 'started playing';
            }
            console.log('[VK Video] Play event detected, isPlaying:', isPlaying);
          } else if (eventType === 'pause') {
            isPlaying = false;
            action = 'paused';
            console.log('[VK Video] Pause event detected, isPlaying:', isPlaying);
          } else if (eventType === 'seek') {
            // Seek event - keep current play state
            isPlaying = prevStateRef.current.isPlaying;
            action = `skipped to ${formatTime(data.time || 0)}`;
            console.log('[VK Video] Seek event detected, time:', data.time);
          } else if (eventType === 'ended') {
            isPlaying = false;
            action = 'ended';
            console.log('[VK Video] Ended event detected');
          } else if (eventType === 'ready') {
            // Player is ready
            console.log('[VK Video] Player ready event detected');
            setIsPlayerReady(true);
            playerReadyRef.current = true;
            return;
          }
          
          // Update state and sync
          prevStateRef.current = { 
            ...prevStateRef.current, 
            isPlaying, 
            currentTime: data.time || prevStateRef.current.currentTime,
            action
          };
          
          console.log('[VK Video] Syncing state:', { isPlaying, currentTime: Math.floor(data.time || prevStateRef.current.currentTime), action });
          
          syncState({ 
            isPlaying, 
            currentTime: Math.floor(data.time || prevStateRef.current.currentTime),
            action
          });
        } else {
          console.log('[VK Video] No event field in data:', data);
        }
      } catch (e) {
        console.error('[VK Video] Error parsing message:', e);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(setupTimeout);
    };
  }, [isVKVideo, embedUrl]);

  // Listen for real-time state updates from Firebase
  useEffect(() => {
    const docRef = doc(db, 'videoState', 'current');
    
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (!docSnap.exists()) return;
      
      try {
        const state = docSnap.data() as PlaybackState;
        
        if (state.lastUpdatedAt > localStateRef.current.lastUpdatedAt && state.lastUpdatedBy !== user) {
          setLocalState(state);
          prevStateRef.current = state;
          
          // Handle YouTube player sync
          if (playerRef.current && playerReadyRef.current) {
            const timeDiff = Math.abs(state.currentTime - (playerRef.current.getCurrentTime() || 0));
            const currentPlayerState = playerRef.current.getPlayerState();
            const currentlyPlaying = currentPlayerState === YT_PLAYING;
            
            const playerTime = playerRef.current.getCurrentTime() || 0;
            const timeMatch = Math.abs(state.currentTime - playerTime) < 2;
            const playStateMatch = state.isPlaying === currentlyPlaying;
            
            if (timeMatch && playStateMatch) {
              prevStateRef.current = state;
              setLocalState(state);
              return;
            }
            
            isLocalChangeRef.current = true;
            if (timeDiff < 10) {
              if (state.isPlaying && !currentlyPlaying) {
                playerRef.current?.playVideo();
              } else if (!state.isPlaying && currentlyPlaying) {
                playerRef.current?.pauseVideo();
              }
            } else {
              isWaitingForSyncRef.current = true;
              playerRef.current.seekTo(state.currentTime, true);
              setTimeout(() => {
                if (state.isPlaying) {
                  playerRef.current?.playVideo();
                } else {
                  playerRef.current?.pauseVideo();
                }
                isWaitingForSyncRef.current = false;
              }, 500);
            }
            setTimeout(() => { isLocalChangeRef.current = false; }, 1000);
          }
          // Handle VK Video player sync
          else if (isVKVideo && vkPlayerRef.current && playerReadyRef.current) {
            const currentTime = localStateRef.current.currentTime;
            const timeMatch = Math.abs(state.currentTime - currentTime) < 2;
            const playStateMatch = state.isPlaying === localStateRef.current.isPlaying;
            
            if (timeMatch && playStateMatch) {
              prevStateRef.current = state;
              setLocalState(state);
              return;
            }
            
            isLocalChangeRef.current = true;
            const iframe = containerRef.current?.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
              if (!timeMatch) {
                iframe.contentWindow.postMessage(JSON.stringify({ event: 'seek', time: state.currentTime }), '*');
              }
              if (!playStateMatch) {
                if (state.isPlaying) {
                  iframe.contentWindow.postMessage(JSON.stringify({ event: 'play' }), '*');
                } else {
                  iframe.contentWindow.postMessage(JSON.stringify({ event: 'pause' }), '*');
                }
              }
            }
            
            prevStateRef.current = state;
            setLocalState(state);
            setTimeout(() => { isLocalChangeRef.current = false; }, 1000);
          }
          // Handle direct video URL sync (Cloudinary, etc.)
          else if (videoRef.current && !isIframe) {
            const timeDiff = Math.abs(state.currentTime - (videoRef.current.currentTime || 0));
            const currentlyPlaying = !videoRef.current.paused;
            
            const playerTime = videoRef.current.currentTime || 0;
            const timeMatch = Math.abs(state.currentTime - playerTime) < 2;
            const shouldPlay = state.isPlaying && !state.isBuffering;
            const playStateMatch = shouldPlay === currentlyPlaying;
            
            if (timeMatch && playStateMatch) {
              prevStateRef.current = state;
              setLocalState(state);
              return;
            }
            
            isLocalChangeRef.current = true;
            if (timeDiff < 10) {
              if (shouldPlay && !currentlyPlaying) {
                const playPromise = videoRef.current.play();
                if (playPromise !== undefined) {
                  playPromise.catch(e => console.log('Playback prevented:', e));
                }
              } else if (!shouldPlay && currentlyPlaying) {
                videoRef.current.pause();
              }
            } else {
              isWaitingForSyncRef.current = true;
              videoRef.current.currentTime = state.currentTime;
              setTimeout(() => {
                if (shouldPlay) {
                  const playPromise = videoRef.current?.play();
                  if (playPromise !== undefined) {
                    playPromise.catch(e => console.log('Playback prevented:', e));
                  }
                } else {
                  videoRef.current?.pause();
                }
                isWaitingForSyncRef.current = false;
              }, 500);
            }
            setTimeout(() => { isLocalChangeRef.current = false; }, 1000);
          }
        }
      } catch (error) {
        console.error('[VideoPlayer] Error handling state update:', error);
      }
    }, (error) => {
      console.error('[VideoPlayer] Error listening to state:', error);
    });

    return () => {
      unsubscribe();
    };
  }, [user, isYouTube, isVKVideo, isIframe]);

  // Handle state sync to server
  const syncState = useCallback(async (newState: Partial<PlaybackState>) => {
    console.log('[VK Video] Syncing state to server:', newState);
    
    setIsSyncing(true);
    try {
      
      const response = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newState,
          user
        })
      });
      
      const updatedState = await response.json();
      console.log('[VK Video] State synced successfully:', updatedState);
      

      isLocalChangeRef.current = true;
      setLocalState(updatedState);

      
    } catch (error) {
      console.error('[VK Video] Error syncing state:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [user]);

  // Get action description
  const getActionDescription = () => {
    if (!localStateRef.current.lastUpdatedBy) return '';
    
    const isMe = localStateRef.current.lastUpdatedBy === user;
    const userName = isMe ? 'You' : (localStateRef.current.lastUpdatedBy.charAt(0).toUpperCase() + localStateRef.current.lastUpdatedBy.slice(1));
    
    if (localStateRef.current.action) {
      return `${userName} ${localStateRef.current.action}`;
    }
    
    return localStateRef.current.isPlaying 
      ? `${userName} is playing` 
      : `${userName} paused`;
  };
  // Custom Controls Handlers
  const handleUserInteraction = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  const handleFullscreen = () => {
    if (!videoContainerRef.current) return;
    const elem = videoContainerRef.current as any;
    
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(e => console.log('Exit fullscreen error:', e));
    } else {
      if (elem.requestFullscreen) {
        elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }
    }
  };
  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(e => console.log('Playback prevented:', e));
      syncState({ isPlaying: true, isBuffering: false, action: 'started playing' });
    } else {
      videoRef.current.pause();
      syncState({ isPlaying: false, action: 'paused' });
    }
  };

  const handleSkip = (seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.max(0, videoRef.current.currentTime + seconds);
    videoRef.current.currentTime = newTime;
    syncState({ 
      currentTime: newTime, 
      isPlaying: !videoRef.current.paused, 
      isBuffering: false,
      action: `skipped to ${formatTime(newTime)}` 
    });
  };

  const handleSkipToTime = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoRef.current) return;
    
    // Parse HH:MM:SS
    const parts = skipTimeInput.split(':').reverse();
    let seconds = 0;
    
    for (let i = 0; i < parts.length; i++) {
      seconds += parseInt(parts[i] || '0', 10) * Math.pow(60, i);
    }
    
    if (isNaN(seconds)) return;
    
    videoRef.current.currentTime = seconds;
    setIsSkipModalOpen(false);
    setSkipTimeInput('');
    
    syncState({ 
      currentTime: seconds, 
      isPlaying: !videoRef.current.paused, 
      isBuffering: false,
      action: `skipped to ${formatTime(seconds)}` 
    });
  };

  // For non-iframe videos (direct video URLs)
  if (!movieLink || movieLink === '') {
    return (
      <div className="w-full aspect-video bg-gray-800 flex items-center justify-center">
        <p className="text-gray-400">Loading video...</p>
      </div>
    );
  }

  if (!isIframe) {
    return (
      <div className="space-y-0 w-full h-full flex flex-col justify-center bg-black">
        <div 
          ref={videoContainerRef}
          className="relative bg-black w-full mx-auto group flex items-center justify-center h-full max-h-full"
          onMouseMove={handleUserInteraction}
          onClick={handleUserInteraction}
          onTouchStart={handleUserInteraction}
        >
          <video
            ref={videoRef}
            className="w-full h-full max-h-[100dvh] object-contain cursor-pointer"
            onClick={handlePlayPause}
              onPlay={() => {
                // Only sync if this was a user action, not a programmatic play
                if (!localStateRef.current.isPlaying && !isWaitingForSyncRef.current) {
                  syncState({ isPlaying: true, isBuffering: false, action: 'started playing' });
                }
              }}
              onPause={() => {
                // Only sync if this was a user action
                if (localStateRef.current.isPlaying && !isWaitingForSyncRef.current && !localStateRef.current.isBuffering) {
                  syncState({ isPlaying: false, action: 'paused' });
                }
              }}
              onSeeked={(e) => {
                const target = e.target as HTMLVideoElement;
                if (!isWaitingForSyncRef.current && Math.abs(localStateRef.current.currentTime - target.currentTime) > 2) {
                  syncState({ 
                    currentTime: target.currentTime, 
                    isPlaying: !target.paused, 
                    isBuffering: false,
                    action: `skipped to ${formatTime(target.currentTime)}` 
                  });
                }
              }}
              onWaiting={() => {
                if (!isWaitingForSyncRef.current && !localStateRef.current.isBuffering) {
                  syncState({ isBuffering: true, action: 'is buffering...' });
                }
              }}
              onCanPlay={() => {
                if (localStateRef.current.isBuffering && localStateRef.current.lastUpdatedBy === user) {
                  syncState({ isBuffering: false, action: 'ready' });
                }
              }}
            >
              <source src={movieLink} />
              Your browser does not support the video tag.
            </video>
            
            {/* Custom Control Bar */}
            <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 transition-opacity duration-300 flex items-center justify-center gap-2 sm:gap-4 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
              <div className="mr-auto">
                <button
                  onClick={(e) => { e.stopPropagation(); window.location.href = '/'; }}
                  className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg backdrop-blur-sm transition-colors flex items-center justify-center"
                  title="Back to Library"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleSkip(-10); }} 
                className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center backdrop-blur-sm transition-colors"
                title="Rewind 10s"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5"/></svg>
              </button>
              
              <button 
                onClick={(e) => { e.stopPropagation(); handlePlayPause(); }} 
                className="bg-white hover:bg-gray-200 text-black rounded-full p-3 w-14 h-14 flex items-center justify-center transition-transform hover:scale-105 shadow-lg"
              >
                {localStateRef.current.isPlaying ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: '4px' }}><polygon points="5 3 19 12 5 21 5 3"/></svg>
                )}
              </button>

              <button 
                onClick={(e) => { e.stopPropagation(); handleSkip(10); }} 
                className="bg-white/20 hover:bg-white/30 text-white rounded-full p-2 w-10 h-10 flex items-center justify-center backdrop-blur-sm transition-colors"
                title="Forward 10s"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 17l5-5-5-5M6 17l5-5-5-5"/></svg>
              </button>

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setIsSkipModalOpen(true); }}
                  className="bg-white/20 hover:bg-white/30 text-white px-2 py-1.5 sm:px-3 rounded-lg text-xs sm:text-sm backdrop-blur-sm transition-colors flex items-center gap-1 sm:gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  <span className="hidden sm:inline">Skip to Time</span>
                </button>

                <button
                  onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
                  className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg backdrop-blur-sm transition-colors"
                  title="Fullscreen"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                </button>
              </div>
            </div>

            {/* Skip to Time Modal */}
            {isSkipModalOpen && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-gray-900 border border-gray-700 p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4">
                  <h3 className="text-white text-lg font-semibold mb-4 text-center">Skip to Time</h3>
                  <form onSubmit={handleSkipToTime} className="flex flex-col gap-4">
                    <div>
                      <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Format: HH:MM:SS</label>
                      <input
                        type="text"
                        autoFocus
                        placeholder="e.g. 01:15:00"
                        value={skipTimeInput}
                        onChange={(e) => setSkipTimeInput(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex gap-3 mt-2">
                      <button
                        type="button"
                        onClick={() => setIsSkipModalOpen(false)}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                      >
                        Go
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
        </div>
        

      </div>
    );
  }

  const playerId = `youtube-player-${Math.random().toString(36).substr(2, 9)}`;

  // Render VK Video embed as a styled iframe (similar to YouTube and Google Drive)
  if (isVKVideo) {
    return (
      <div className="space-y-2">
        <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl max-w-4xl mx-auto">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={embedUrl}
              className="absolute top-0 left-0 w-full h-full"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              frameBorder="0"
            />
          </div>
        </div>
        

      </div>
    );
  }

  // Render Google Drive embed as a regular iframe (styled like YouTube)
  if (isIframe && !isYouTube) {
    return (
      <div className="space-y-2">
        <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl max-w-4xl mx-auto">
          <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={embedUrl}
              className="absolute top-0 left-0 w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              frameBorder="0"
            />
          </div>

        </div>
        
        {/* Manual sync controls for Google Drive */}
        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-4 max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p className="font-medium">Google Drive Video</p>
              <p className="text-xs">Manual sync required (no auto-detection)</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => syncState({ isPlaying: true, action: 'started playing' })}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                ▶ Play
              </button>
              <button
                onClick={() => syncState({ isPlaying: false, action: 'paused' })}
                className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                ⏸ Pause
              </button>
            </div>
          </div>
          

        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative bg-black rounded-xl overflow-hidden shadow-2xl">
        <div 
          id={playerId} 
          ref={containerRef}
          className="w-full aspect-video"
        />

      </div>
      

    </div>
  );
}