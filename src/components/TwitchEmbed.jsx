import { useEffect, useRef } from 'react';

export default function TwitchEmbed({ channel }) {
  const containerRef = useRef(null);
  const embedRef = useRef(null);

  useEffect(() => {
    if (!channel || embedRef.current) return;

    // Load Twitch embed script
    const script = document.createElement('script');
    script.src = 'https://embed.twitch.tv/embed/v1.js';
    script.async = true;
    script.onload = () => {
      if (window.Twitch && containerRef.current) {
        embedRef.current = new window.Twitch.Embed(containerRef.current, {
          width: '100%',
          height: '100%',
          channel: channel,
          layout: 'video-with-chat',
          autoplay: false,
          theme: 'dark',
          parent: [window.location.hostname],
        });
      }
    };
    document.head.appendChild(script);

    return () => {
      // Cleanup
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      embedRef.current = null;
    };
  }, [channel]);

  return (
    <div className="twitch-embed-wrapper">
      <div ref={containerRef} className="twitch-embed-container" />
    </div>
  );
}
