import { useEffect, useRef } from 'react';

interface AdMobileProps {
  slot?: string;
  className?: string;
}

export default function AdMobile({ slot = "4567890123", className = "" }: AdMobileProps) {
  const adRef = useRef<HTMLElement>(null);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && adRef.current && (window as any).adsbygoogle) {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      }
    } catch (error) {
      console.error('Error loading AdSense ad:', error);
    }
  }, []);

  return (
    <div className={`ad-container text-center py-2 md:hidden max-w-full overflow-hidden ${className}`}>
      <div className="text-xs text-gray-400 mb-1">Publicidad</div>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ 
          display: 'inline-block', 
          width: 'min(320px, 100vw - 2rem)', 
          height: '50px',
          maxWidth: '100%'
        }}
        data-ad-client="ca-pub-8854811165812956"
        data-ad-slot={slot}
      />
    </div>
  );
}