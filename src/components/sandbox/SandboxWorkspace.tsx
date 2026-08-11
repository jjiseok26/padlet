import React, { useCallback, useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Loader2 } from 'lucide-react';
import {
  useSandboxStore,
  joinSandboxRoom,
  ensureSandboxArchived,
  computeFitViewport,
  GROUP_PAGE,
} from '../../store/useSandboxStore';
import { useAuthStore } from '../../store/useBoardStore';
import { startPresence, stopPresence, updatePresenceIdentity } from '../../store/usePresenceStore';
import { SandboxCanvas } from './SandboxCanvas';
import { SandboxHeader } from './SandboxHeader';
import { SandboxToolbar } from './SandboxToolbar';
import { GroupTabs } from './GroupTabs';

interface Props {
  sandboxId: string;
  isGuestMode: boolean;
  onExit: () => void;
}

export const SandboxWorkspace: React.FC<Props> = ({ sandboxId, isGuestMode, onExit }) => {
  const {
    sandboxes,
    elements,
    myName,
    myGroupId,
    myColor,
    activeGroupId,
    setIdentity,
    setActiveSandboxId,
    setActiveGroupId,
    setViewport,
    addGroup,
    removeGroup,
    reorderGroups,
  } = useSandboxStore();

  const teacherName = useAuthStore((state) => state.currentUser?.username);

  const sandbox = sandboxes.find((s) => s.id === sandboxId);
  const activeGroup = sandbox?.groups.find((g) => g.id === activeGroupId) ?? null;

  const [toast, setToast] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isLoadingCanvas, setIsLoadingCanvas] = useState(!sandbox);
  const framedGroupId = useRef<string | null>(null);

  // Give the network a fair chance before telling someone the link is broken
  useEffect(() => {
    if (sandbox) {
      setIsLoadingCanvas(false);
      return;
    }
    setIsLoadingCanvas(true);
    const timer = setTimeout(() => setIsLoadingCanvas(false), 12000);
    return () => clearTimeout(timer);
  }, [sandbox, sandboxId]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 2600);
  };

  const fitToContent = useCallback(() => {
    // Measure the canvas itself: the 모둠 rail sits beside it on desktop and
    // above it on phones, so window size alone would frame the page wrongly.
    const area = document.querySelector('[data-canvas-bg="true"]')?.getBoundingClientRect();
    const { panX, panY, scale } = computeFitViewport(
      area?.width || window.innerWidth,
      area?.height || window.innerHeight - 68
    );
    setViewport(panX, panY, scale);
  }, [setViewport]);

  // Join the realtime room for this sandbox
  useEffect(() => {
    setActiveSandboxId(sandboxId);
    joinSandboxRoom(sandboxId);
    return () => {
      joinSandboxRoom(null);
      stopPresence();
    };
  }, [sandboxId, setActiveSandboxId]);

  // Land on my own 모둠 once the canvas is known
  useEffect(() => {
    if (!sandbox || activeGroupId) return;
    const preferred = sandbox.groups.find((g) => g.id === myGroupId) ?? sandbox.groups[0];
    if (preferred) setActiveGroupId(preferred.id);
  }, [sandbox, activeGroupId, myGroupId, setActiveGroupId]);

  // Anyone holding the link can write straight away: give them a provisional
  // name so nothing gates the canvas, and let them rename from the header.
  useEffect(() => {
    if (!sandbox || myName) return;
    const fallback = teacherName || `참여자-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const group = sandbox.groups.find((g) => g.id === myGroupId) ?? sandbox.groups[0];
    setIdentity(fallback, group?.id ?? null, group?.color || myColor);
  }, [sandbox, myName, myGroupId, myColor, teacherName, setIdentity]);

  // Frame each group's page the first time it is opened
  useEffect(() => {
    if (!activeGroupId || framedGroupId.current === activeGroupId) return;
    framedGroupId.current = activeGroupId;
    fitToContent();
  }, [activeGroupId, fitToContent]);

  // Broadcast presence once we have a name.
  // Identity changes are pushed separately so peers never see a leave/rejoin flicker.
  useEffect(() => {
    if (!myName) return;
    startPresence(sandboxId, {
      name: useSandboxStore.getState().myName,
      color: useSandboxStore.getState().myColor,
      groupId: useSandboxStore.getState().myGroupId,
    });
    return () => stopPresence();
  }, [sandboxId, myName]);

  useEffect(() => {
    if (myName) updatePresenceIdentity({ name: myName, color: myColor, groupId: myGroupId });
  }, [myName, myColor, myGroupId]);

  // Keep the shareable copy current so the link works even when nobody is here
  useEffect(() => {
    if (isGuestMode || !sandbox) return;
    return ensureSandboxArchived(sandboxId);
  }, [isGuestMode, sandbox, sandboxId]);

  const countFor = useCallback(
    (groupId: string) => elements.filter((el) => el.sandboxId === sandboxId && el.groupId === groupId).length,
    [elements, sandboxId]
  );

  /**
   * Captures each 모둠 page into a landscape PDF. The live canvas is panned and
   * zoomed, so we snapshot an offscreen copy pinned at 1:1 instead — that way the
   * export always covers the whole page regardless of where the user is looking.
   */
  const exportPdf = async (groupIds: string[], filename: string) => {
    if (groupIds.length === 0) return;
    setIsExporting(true);
    const restoreGroupId = activeGroupId;
    (document.activeElement as HTMLElement | null)?.blur?.();

    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [GROUP_PAGE.width, GROUP_PAGE.height],
      });

      for (let i = 0; i < groupIds.length; i++) {
        setActiveGroupId(groupIds[i]);
        await new Promise((resolve) => setTimeout(resolve, 300));

        const world = document.querySelector('[data-canvas-world="true"]') as HTMLElement | null;
        if (!world) continue;

        const stage = document.createElement('div');
        stage.style.cssText = `position:fixed;left:-100000px;top:0;width:${GROUP_PAGE.width}px;height:${GROUP_PAGE.height}px;overflow:hidden;background:#ffffff;`;

        const clone = world.cloneNode(true) as HTMLElement;
        clone.style.transform = 'none';
        clone.style.left = '0px';
        clone.style.top = '0px';
        clone.querySelectorAll('[data-presence-layer="true"]').forEach((el) => el.remove());
        // The group badge normally floats above the page edge, which the export crops off
        const badge = clone.querySelector('[data-group-page="true"] > div') as HTMLElement | null;
        if (badge) badge.style.top = '16px';
        stage.appendChild(clone);
        document.body.appendChild(stage);

        try {
          const canvas = await html2canvas(stage, {
            backgroundColor: '#ffffff',
            scale: 2,
            useCORS: true,
            allowTaint: true,
          });
          if (i > 0) pdf.addPage([GROUP_PAGE.width, GROUP_PAGE.height], 'landscape');
          // JPEG keeps a multi-group export small enough to email or print
          pdf.addImage(
            canvas.toDataURL('image/jpeg', 0.92),
            'JPEG',
            0,
            0,
            GROUP_PAGE.width,
            GROUP_PAGE.height
          );
        } finally {
          stage.remove();
        }
      }

      pdf.save(filename);
      showToast('PDF로 저장했습니다.');
    } catch (err) {
      console.error('Sandbox PDF export failed:', err);
      showToast('PDF 저장에 실패했습니다.');
    } finally {
      if (restoreGroupId) setActiveGroupId(restoreGroupId);
      setIsExporting(false);
    }
  };

  const safeTitle = (sandbox?.title || 'canvas').replace(/[^\w\sㄱ-힣]/g, '').trim() || 'canvas';

  if (!sandbox) {
    // The canvas arrives over the network, so waiting is normal — only call it
    // missing once we have genuinely given up on it.
    return (
      <div style={styles.emptyState}>
        {isLoadingCanvas ? (
          <>
            <Loader2 size={30} className="spin" color="var(--color-primary)" />
            <h2 style={{ margin: '14px 0 6px' }}>캔버스를 불러오는 중…</h2>
            <p>공유 링크로 캔버스를 찾고 있습니다. 잠시만 기다려주세요.</p>
          </>
        ) : (
          <>
            <h2 style={{ marginBottom: 8 }}>캔버스를 찾을 수 없습니다</h2>
            <p style={{ marginBottom: 20 }}>
              링크가 잘못되었거나 캔버스가 삭제되었을 수 있습니다. 링크를 다시 확인해주세요.
            </p>
            <button
              className="button-premium active"
              onClick={() => window.location.reload()}
              style={{ padding: '10px 20px' }}
            >
              다시 시도
            </button>
          </>
        )}
      </div>
    );
  }

  const canEdit = !isGuestMode || sandbox.allowGuestEdit;

  return (
    <div style={styles.root}>
      <SandboxHeader sandbox={sandbox} isGuestMode={isGuestMode} onExit={onExit} onToast={showToast} />

      <GroupTabs
        sandbox={sandbox}
        activeGroupId={activeGroupId}
        countFor={countFor}
        isGuestMode={isGuestMode}
        isExporting={isExporting}
        onSelect={(groupId) => {
          // Each 모둠 has its own page, so the page you are on is the group you work in
          setActiveGroupId(groupId);
          const group = sandbox.groups.find((g) => g.id === groupId);
          setIdentity(myName, groupId, group?.color || myColor);
        }}
        onAddGroup={() => {
          const name = window.prompt('새 모둠 이름', `${sandbox.groups.length + 1}모둠`);
          if (name && name.trim()) addGroup(sandbox.id, name.trim());
        }}
        onRemoveGroup={(groupId) => {
          const group = sandbox.groups.find((g) => g.id === groupId);
          if (!group) return;
          const count = countFor(groupId);
          const warning = count > 0 ? `\n\n이 모둠의 작업 ${count}개도 함께 삭제됩니다.` : '';
          if (!window.confirm(`'${group.name}' 모둠을 삭제할까요?${warning}`)) return;
          if (groupId === activeGroupId) {
            const next = sandbox.groups.find((g) => g.id !== groupId);
            setActiveGroupId(next ? next.id : null);
          }
          removeGroup(sandbox.id, groupId);
        }}
        onReorder={(from, to) => reorderGroups(sandbox.id, from, to)}
        onExportCurrent={() =>
          activeGroupId &&
          exportPdf([activeGroupId], `${safeTitle}_${activeGroup?.name || '모둠'}.pdf`)
        }
        onExportAll={() => exportPdf(sandbox.groups.map((g) => g.id), `${safeTitle}_전체모둠.pdf`)}
      />

      <div className="sandbox-canvas-area">
        <SandboxCanvas sandbox={sandbox} group={activeGroup} canEdit={canEdit} />
      </div>

      <SandboxToolbar canEdit={canEdit} onFitToContent={fitToContent} />

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
