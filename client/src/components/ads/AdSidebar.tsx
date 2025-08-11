import { useEffect } from 'react';

interface AdSidebarProps {
  adSlot: string;
  className?: string;
}

export default function AdSidebar({ adSlot, className = '' }: AdSidebarProps) {
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.adsbygoogle) {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (err) {
      console.log('AdSense error:', err);
    }
  }, []);

  return (
    <div className={`ad-sidebar ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '300px', height: '600px' }}
        data-ad-client="ca-pub-8854811165812956"
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}