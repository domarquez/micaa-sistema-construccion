import { useEffect } from 'react';

interface AdInArticleProps {
  adSlot: string;
  className?: string;
}

export default function AdInArticle({ adSlot, className = '' }: AdInArticleProps) {
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
    <div className={`ad-in-article ${className}`}>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', textAlign: 'center' }}
        data-ad-client="ca-pub-8854811165812956"
        data-ad-slot={adSlot}
        data-ad-format="fluid"
        data-ad-layout="in-article"
      />
    </div>
  );
}