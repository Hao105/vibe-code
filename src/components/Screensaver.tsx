import { useState, useEffect } from 'react';

const IMAGES = Array.from({ length: 15 }, (_, i) => `${import.meta.env.BASE_URL}cheerleaders/web_${i + 1}.jpg`);

export default function Screensaver() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % IMAGES.length);
    }, 5000); // 5秒換一張
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center transition-opacity duration-1000 pointer-events-none">
      <div className="absolute inset-0 z-0 bg-gradient-to-br from-primary/20 to-secondary/20 animate-pulse"></div>
      
      <div className="relative z-10 w-full h-full flex items-center justify-center">
        {IMAGES.map((img, i) => (
          <img 
            key={i}
            src={img} 
            alt="Cheerleader"
            className={`absolute max-h-[85vh] max-w-[90vw] object-contain drop-shadow-2xl rounded-[3rem] transition-all duration-[2000ms] ease-in-out ${
              i === currentIndex 
                ? 'opacity-100 scale-100 translate-y-0 rotate-0' 
                : 'opacity-0 scale-90 translate-y-10 rotate-3'
            }`}
          />
        ))}
      </div>

      <div className="absolute bottom-12 animate-bounce flex flex-col items-center">
        <span className="text-4xl mb-2">🎉</span>
        <div className="bg-black/50 px-6 py-2 rounded-full text-white/50 font-mono tracking-widest text-sm border border-white/10">
          PRESS ANY KEY OR MOVE MOUSE TO WAKE UP
        </div>
      </div>
    </div>
  );
}
