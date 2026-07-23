'use client';

export default function Hero() {
  return (
    <section className="relative w-full min-h-[75vh] flex items-center justify-center overflow-hidden">
      {/* Background Image (Cinematic Theater Vibe) */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat transform scale-105"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?q=80&w=2670&auto=format&fit=crop')" }}
      />
      
      {/* Dark Overlay Gradient - Fades to match the page background at the bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-gray-50 dark:to-gray-900"></div>

      {/* Content */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 flex flex-col items-center justify-center text-center">
        
        {/* Glow effect around logo */}
        <div className="relative w-full max-w-3xl mx-auto group">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[70%] h-[70%] bg-orange-500/20 blur-[100px] rounded-full group-hover:bg-orange-500/30 transition-all duration-700"></div>
          
          <img 
            src="/bandname.png" 
            alt="Zivic Theatre" 
            className="relative w-full h-auto object-contain z-10 drop-shadow-[0_10px_30px_rgba(0,0,0,0.5)] transform transition-transform duration-700 hover:scale-105"
          />
        </div>
        
        <p className="mt-6 text-lg md:text-xl text-gray-200 font-medium tracking-wide max-w-2xl drop-shadow-lg">
          Experience movies together. Sync playback, chat in real-time, and host the ultimate watch party.
        </p>
        
        <div className="mt-10 flex gap-4">
          <button 
            onClick={() => window.scrollTo({ top: window.innerHeight * 0.75, behavior: 'smooth' })}
            className="px-8 py-3.5 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-full font-bold text-lg shadow-[0_0_20px_rgba(249,115,22,0.4)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] transition-all transform hover:-translate-y-1 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Browse Library
          </button>
        </div>
      </div>
      
    </section>
  );
}