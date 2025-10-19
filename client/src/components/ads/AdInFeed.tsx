import { useEffect, useRef } from 'react';

interface AdInFeedProps {
  slot?: string;
  className?: string;
}

export default function AdInFeed({ slot = "1234567890", className = "" }: AdInFeedProps) {
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
    <div className={`ad-shell ad-container text-center my-4 mobile-padding ${className}`}>
      <div className="text-xs text-gray-500 mb-1">Publicidad</div>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ 
          display: 'block',
          maxWidth: '100%',
          width: '100%'
        }}
        data-ad-client="ca-pub-8854811165812956"
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}