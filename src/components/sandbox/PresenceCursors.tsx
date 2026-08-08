import React from 'react';
import { MousePointer2 } from 'lucide-react';
import { usePresenceStore } from '../../store/usePresenceStore';

/** Renders other participants' live cursors inside the canvas world layer. */
export const PresenceCursors: React.FC = () => {
  const peers = usePresenceStore((state) => state.peers);

  return (
    <>
      {Object.values(peers).map((peer) => (
        <div
          key={peer.clientId}
          style={{
            position: 'absolute',
            left: peer.x,
            top: peer.y,
            pointerEvents: 'none',
            zIndex: 9998,
            transition: 'transform 0.08s linear',
          }}
        >
          <MousePointer2 size={20} color={peer.color} fill={peer.color} />
          <div
            style={{
              marginTop: 2,
              marginLeft: 12,
              background: peer.color,
              color: '#ffffff',
              padding: '2px 8px',
              borderRadius: 999,
              fontSize: '0.68rem',
              fontWeight: 700,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 10px rgba(22, 50, 74, 0.2)',
            }}
          >
            {peer.name}
          </div>
        </div>
      ))}
    </>
  );
};
