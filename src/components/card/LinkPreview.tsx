import React from 'react';
import { ExternalLink } from 'lucide-react';

interface LinkPreviewProps {
  url: string;
}

const getYoutubeVideoId = (url: string) => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export const LinkPreview: React.FC<LinkPreviewProps> = ({ url }) => {
  const videoId = getYoutubeVideoId(url);

  if (videoId) {
    return (
      <div style={styles.youtubeWrapper} onClick={(e) => e.stopPropagation()}>
        <iframe
          width="100%"
          height="160"
          src={`https://www.youtube.com/embed/${videoId}`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={styles.youtubeIframe}
        />
      </div>
    );
  }

  // Mock OG scraper database depending on domain
  const getMockOGData = (linkUrl: string) => {
    let cleanUrl = linkUrl.trim().toLowerCase();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    let domain = 'external-link';
    try {
      domain = new URL(cleanUrl).hostname;
    } catch (_) {
      // invalid URL fallback
    }

    if (cleanUrl.includes('google.com')) {
      return {
        title: 'Google',
        description: 'Search the world\'s information, including webpages, images, videos and more.',
        image: 'https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?auto=format&fit=crop&w=350&q=80',
        domain: 'google.com'
      };
    } else if (cleanUrl.includes('github.com')) {
      return {
        title: 'GitHub: Let\'s build from here',
        description: 'GitHub is where over 100 million developers shape the future of software, hosting code, collaborating on projects.',
        image: 'https://images.unsplash.com/photo-1618401471353-b98aedd07871?auto=format&fit=crop&w=350&q=80',
        domain: 'github.com'
      };
    } else if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
      return {
        title: 'YouTube - Broadcast Yourself',
        description: 'Enjoy the videos and music you love, upload original content, and share it all with friends, family, and the world.',
        image: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&w=350&q=80',
        domain: 'youtube.com'
      };
    } else if (cleanUrl.includes('deepmind.google') || cleanUrl.includes('deepmind')) {
      return {
        title: 'Google DeepMind - Advanced AI Research',
        description: 'Exploring the capabilities of AI agents and building models like Gemini to solve complex coding, science, and math.',
        image: 'https://images.unsplash.com/photo-1677442136019-21780efad99a?auto=format&fit=crop&w=350&q=80',
        domain: 'deepmind.google'
      };
    }

    // Default beautiful fallback card
    return {
      title: `Explore Resources on ${domain}`,
      description: 'Click to view the attached page. Discover documentation, ideas, and shared links on this board.',
      image: 'https://images.unsplash.com/photo-1488590528505-98d2b5aba04b?auto=format&fit=crop&w=350&q=80',
      domain: domain
    };
  };

  const og = getMockOGData(url);
  const formattedUrl = url.startsWith('http') ? url : `https://${url}`;

  return (
    <a 
      href={formattedUrl}
      target="_blank"
      rel="noopener noreferrer"
      style={styles.linkCard}
      onClick={(e) => e.stopPropagation()} // Prevent card double-clicks
    >
      <div 
        style={{ 
          ...styles.previewImage, 
          backgroundImage: `url(${og.image})` 
        }} 
      />
      <div style={styles.previewContent}>
        <div style={styles.domainWrapper}>
          <span style={styles.domainText}>{og.domain}</span>
          <ExternalLink size={10} style={{ color: 'var(--text-muted)' }} />
        </div>
        <h4 style={styles.previewTitle}>{og.title}</h4>
        <p style={styles.previewDesc}>{og.description}</p>
      </div>
    </a>
  );
};

const styles: Record<string, React.CSSProperties> = {
  youtubeWrapper: {
    width: '100%',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: '#000000',
    overflow: 'hidden',
    marginTop: '12px',
    position: 'relative',
  },
  youtubeIframe: {
    display: 'block',
    border: 'none',
  },
  linkCard: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '10px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    background: 'rgba(0, 0, 0, 0.25)',
    overflow: 'hidden',
    textDecoration: 'none',
    color: 'inherit',
    marginTop: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  previewImage: {
    width: '100%',
    height: '100px',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
  },
  previewContent: {
    padding: '8px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  domainWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  domainText: {
    fontSize: '0.65rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: '0.05em',
  },
  previewTitle: {
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#ffffff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  previewDesc: {
    fontSize: '0.725rem',
    color: 'var(--text-muted)',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: '1.3',
  }
};
