import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useSandboxStore,
  joinSandboxRoom,
  publishSandboxSnapshot,
  computeFitViewport,
} from '../../store/useSandboxStore';
import { startPresence, stopPresence, updatePresenceIdentity } from '../../store/usePresenceStore';
import { SandboxCanvas } from './SandboxCanvas';
import { SandboxHeader } from './SandboxHeader';
import { SandboxToolbar } from './SandboxToolbar';
import { JoinSandboxModal } from './JoinSandboxModal';

interface Props {
  sandboxId: string;
  isGuestMode: boolean;
  onExit: () => void;
}

export const SandboxWorkspace: React.FC<Props> = ({ sandboxId, isGuestMode, onExit }) => {
  const { sandboxes, myName, myGroupId, myColor, setIdentity, setActiveSandboxId, setViewport } =
    useSandboxStore();
  const sandbox = sandboxes.find((s) => s.id === sandboxId);

  const [toast, setToast] = useState('');
  const [hasJoined, setHasJoined] = useState(() => Boolean(myName));
  const framedSandboxId = useRef<string | null>(null);

  const fitToContent = useCallback(() => {
    const groups = useSandboxStore.getState().sandboxes.find((s) => s.id === sandboxId)?.groups ?? [];
    const { panX, panY, scale } = computeFitViewport(
      groups,
      window.innerWidth,
      window.innerHeight - 68
    );
    setViewport(panX, panY, scale);
  }, [sandboxId, setViewport]);

  // Frame the whole space once the canvas is available (it may arrive over the network)
  useEffect(() => {
    if (!sandbox || framedSandboxId.current === sandboxId) return;
    framedSandboxId.current = sandboxId;
    fitToContent();
  }, [sandbox, sandboxId, fitToContent]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 2600);
  };

  // Join the realtime room for this sandbox
  useEffect(() => {
    setActiveSandboxId(sandboxId);
    joinSandboxRoom(sandboxId);
    return () => {
      joinSandboxRoom(null);
      stopPresence();
    };
  }, [sandboxId, setActiveSandboxId]);

  // Broadcast presence once the participant has identified themselves.
  // Identity changes are pushed separately so peers never see a leave/rejoin flicker.
  useEffect(() => {
    if (!hasJoined || !myName) return;
    startPresence(sandboxId, {
      name: useSandboxStore.getState().myName,
      color: useSandboxStore.getState().myColor,
      groupId: useSandboxStore.getState().myGroupId,
    });
    return () => stopPresence();
  }, [sandboxId, hasJoined, myName]);

  useEffect(() => {
    if (hasJoined && myName) updatePresenceIdentity({ name: myName, color: myColor, groupId: myGroupId });
  }, [hasJoined, myName, myColor, myGroupId]);

  // Teachers seed the room so guests who arrive first still get the canvas
  useEffect(() => {
    if (isGuestMode || !sandbox) return;
    const timer = setTimeout(() => publishSandboxSnapshot(sandboxId), 700);
    return () => clearTimeout(timer);
  }, [isGuestMode, sandbox, sandboxId]);

  if (!sandbox) {
    return (
      <div style={styles.emptyState}>
        <h2 style={{ marginBottom: 8 }}>캔버스를 찾을 수 없습니다</h2>
        <p style={{ marginBottom: 20 }}>
          링크가 만료되었거나, 아직 선생님이 캔버스를 열지 않았을 수 있습니다.
        </p>
        <button className="button-premium active" onClick={onExit} style={{ padding: '10px 20px' }}>
          돌아가기
        </button>
      </div>
    );
  }

  const canEdit = !isGuestMode || sandbox.allowGuestEdit;
  const needsJoin = !hasJoined || !myName;

  return (
    <div style={styles.root}>
      <SandboxHeader
        sandbox={sandbox}
        isGuestMode={isGuestMode}
        onExit={onExit}
        onToast={showToast}
      />

      <div style={styles.canvasArea}>
        <SandboxCanvas sandbox={sandbox} canEdit={canEdit && !needsJoin} />
      </div>

      <SandboxToolbar canEdit={canEdit && !needsJoin} onFitToContent={fitToContent} />

      {needsJoin && (
        <JoinSandboxModal
          sandbox={sandbox}
          initialName={myName}
          onJoin={(name, groupId) => {
            const group = sandbox.groups.find((g) => g.id === groupId);
            setIdentity(name, groupId, group?.color || myColor);
            setHasJoined(true);
          }}
        />
      )}

      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
  },
  canvasArea: {
    position: 'absolute',
    top: 68,
    left: 0,
    right: 0,
    bottom: 0,
  },
  emptyState: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: 24,
    color: 'var(--text-main)',
  },
  toast: {
    position: 'fixed',
    bottom: 92,
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--text-main)',
    color: '#ffffff',
    padding: '10px 18px',
    borderRadius: 999,
    fontSize: '0.82rem',
    fontWeight: 600,
    zIndex: 5000,
    boxShadow: '0 10px 26px rgba(22, 50, 74, 0.25)',
  },
};
