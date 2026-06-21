import React, { useState } from 'react';
import { useBoardStore, useAuthStore } from '../../store/useBoardStore';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check } from 'lucide-react';

interface WallpaperPickerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS = {
  gradients: [
    { name: '다크 인디고', value: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)' },
    { name: '딥 퍼플', value: 'linear-gradient(135deg, #180828 0%, #0c0214 100%)' },
    { name: '포레스트 에메랄드', value: 'linear-gradient(135deg, #022c22 0%, #064e3b 100%)' },
    { name: '심해 티어', value: 'linear-gradient(135deg, #1e3a8a 0%, #0d9488 100%)' },
    { name: '버건디 나이트', value: 'linear-gradient(135deg, #310818 0%, #110006 100%)' },
    { name: '미스틱 오로라', value: 'linear-gradient(135deg, #581c87 0%, #b5179e 100%)' },
    { name: '소프트 코랄 (밝음)', value: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 99%, #fecfef 100%)' },
    { name: '오렌지 드림 (밝음)', value: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
    { name: '블루 스카이 (밝음)', value: 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)' },
    { name: '민트 프레시 (밝음)', value: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)' },
    { name: '레몬 셔벗 (밝음)', value: 'linear-gradient(135deg, #fffde4 0%, #ffe066 100%)' },
    { name: '핑크 라벤더 (밝음)', value: 'linear-gradient(135deg, #ffc0cb 0%, #e6e6fa 100%)' },
    { name: '밝은 파스텔 그린 (밝음)', value: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)' },
    { name: '코튼 캔디 (밝음)', value: 'linear-gradient(135deg, #ff9a9e 0%, #a1c4fd 100%)' }
  ],
  solids: [
    { name: 'Ink Black', value: '#030712' },
    { name: 'Charcoal', value: '#111827' },
    { name: 'Slate Gray', value: '#1f2937' },
    { name: 'Deep Navy', value: '#0f172a' },
    { name: 'Cream White (밝음)', value: '#f4f4f0' },
    { name: 'Soft Gray (밝음)', value: '#f3f4f6' },
    { name: 'Mint White (밝음)', value: '#edfcf9' },
    { name: 'Lavender Ice (밝음)', value: '#f5f3ff' },
    { name: 'Pure White (밝음)', value: '#ffffff' },
    { name: 'Warm Sand (밝음)', value: '#fdfbf7' },
    { name: 'Pale Pink (밝음)', value: '#fff0f5' },
    { name: 'Pastel Yellow (밝음)', value: '#fefce8' }
  ],
  patterns: [
    { name: 'Abstract Cyber', value: 'url("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=350&q=80")' },
    { name: 'Liquid Purple', value: 'url("https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=350&q=80")' },
    { name: 'Emerald Wave', value: 'url("https://images.unsplash.com/photo-1618005198143-d3663a8a3069?auto=format&fit=crop&w=350&q=80")' },
    { name: 'Aurora Glow', value: 'url("https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=350&q=80")' }
  ]
};

export const WallpaperPicker: React.FC<WallpaperPickerProps> = ({ isOpen, onClose }) => {
  const { boards, updateBoardMeta } = useBoardStore();
  const { activeBoardId } = useAuthStore();

  // Find active board
  const activeBoard = boards.find(b => b.id === activeBoardId);

  // States for custom coloring
  const [customSolid, setCustomSolid] = useState('#ffffff');
  const [gradientStart, setGradientStart] = useState('#ff9a9e');
  const [gradientEnd, setGradientEnd] = useState('#fecfef');
  const [gradientAngle, setGradientAngle] = useState(135);

  const handleSelectWallpaper = (val: string) => {
    if (activeBoard) {
      updateBoardMeta(activeBoard.id, { wallpaper: val });
    }
  };

  if (!activeBoard) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Click Dismiss */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={styles.backdrop}
          />

          {/* Sliding Panel */}
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="glass-panel"
            style={styles.panel}
          >
            {/* Header */}
            <div style={styles.panelHeader}>
              <h2>배경화면 설정</h2>
              <button onClick={onClose} style={styles.closeBtn}>
                <X size={18} />
              </button>
            </div>

            <p style={styles.panelSubtitle}>캔버스 보드의 바탕화면을 자유롭게 지정하세요.</p>

            <div style={styles.contentScroll}>
              {/* Gradients */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>그라데이션</h3>
                <div style={styles.grid}>
                  {PRESETS.gradients.map(item => {
                    const isSelected = activeBoard.wallpaper === item.value;
                    return (
                      <button 
                        key={item.name}
                        onClick={() => handleSelectWallpaper(item.value)}
                        style={{ ...styles.colorCard, background: item.value }}
                        title={item.name}
                      >
                        {isSelected && <Check size={18} style={styles.checkIcon} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Solids */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>단색</h3>
                <div style={styles.grid}>
                  {PRESETS.solids.map(item => {
                    const isSelected = activeBoard.wallpaper === item.value;
                    return (
                      <button 
                        key={item.name}
                        onClick={() => handleSelectWallpaper(item.value)}
                        style={{ ...styles.colorCard, backgroundColor: item.value }}
                        title={item.name}
                      >
                        {isSelected && <Check size={18} style={styles.checkIcon} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Color Selectors */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>사용자 정의 배경</h3>
                <div style={styles.customContainer}>
                  {/* Custom Solid */}
                  <div style={styles.customRow}>
                    <span style={styles.customLabel}>단색 선택</span>
                    <input 
                      type="color" 
                      value={customSolid} 
                      onChange={(e) => {
                        setCustomSolid(e.target.value);
                        handleSelectWallpaper(e.target.value);
                      }}
                      style={styles.customColorInput}
                    />
                  </div>

                  {/* Custom Gradient */}
                  <div style={styles.gradientEditor}>
                    <span style={styles.customLabel}>그라데이션 만들기</span>
                    <div style={styles.gradientInputsRow}>
                      <div style={styles.gradientInputCol}>
                        <span style={styles.gradientMiniLabel}>시작</span>
                        <input 
                          type="color" 
                          value={gradientStart} 
                          onChange={(e) => {
                            setGradientStart(e.target.value);
                            const val = `linear-gradient(${gradientAngle}deg, ${e.target.value} 0%, ${gradientEnd} 100%)`;
                            handleSelectWallpaper(val);
                          }}
                          style={styles.gradientColorInput}
                        />
                      </div>
                      <div style={styles.gradientInputCol}>
                        <span style={styles.gradientMiniLabel}>종료</span>
                        <input 
                          type="color" 
                          value={gradientEnd} 
                          onChange={(e) => {
                            setGradientEnd(e.target.value);
                            const val = `linear-gradient(${gradientAngle}deg, ${gradientStart} 0%, ${e.target.value} 100%)`;
                            handleSelectWallpaper(val);
                          }}
                          style={styles.gradientColorInput}
                        />
                      </div>
                      <div style={styles.gradientAngleCol}>
                        <span style={styles.gradientMiniLabel}>각도 ({gradientAngle}°)</span>
                        <input 
                          type="range" 
                          min="0" 
                          max="360" 
                          value={gradientAngle}
                          onChange={(e) => {
                            const angle = parseInt(e.target.value);
                            setGradientAngle(angle);
                            const val = `linear-gradient(${angle}deg, ${gradientStart} 0%, ${gradientEnd} 100%)`;
                            handleSelectWallpaper(val);
                          }}
                          style={styles.angleSlider}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Patterns */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>추천 일러스트 배경</h3>
                <div style={styles.gridLarge}>
                  {PRESETS.patterns.map(item => {
                    const isSelected = activeBoard.wallpaper === item.value;
                    const cleanBgVal = item.value.replace('url("', '').replace('")', '');
                    return (
                      <button 
                        key={item.name}
                        onClick={() => handleSelectWallpaper(item.value)}
                        style={{ 
                          ...styles.patternCard, 
                          backgroundImage: `url(${cleanBgVal})`,
                          border: isSelected ? '2px solid var(--color-primary)' : '1px solid rgba(255,255,255,0.1)'
                        }}
                        title={item.name}
                      >
                        <span style={styles.patternLabel}>{item.name}</span>
                        {isSelected && (
                          <div style={styles.patternCheck}>
                            <Check size={14} color="#030712" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 200,
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(4px)',
  },
  panel: {
    position: 'fixed',
    right: 0,
    top: 0,
    bottom: 0,
    width: '320px',
    zIndex: 201,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '-10px 0 30px rgba(0, 0, 0, 0.5)',
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelSubtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    marginBottom: '20px',
  },
  contentScroll: {
    flex: 1,
    overflowY: 'auto',
    paddingRight: '4px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sectionTitle: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '8px',
  },
  gridLarge: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
  },
  colorCard: {
    width: '100%',
    height: '48px',
    borderRadius: '8px',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s ease',
  },
  checkIcon: {
    color: '#ffffff',
    filter: 'drop-shadow(0px 1px 3px rgba(0,0,0,0.5))',
  },
  patternCard: {
    width: '100%',
    height: '76px',
    borderRadius: '10px',
    cursor: 'pointer',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    position: 'relative',
    display: 'flex',
    alignItems: 'flex-end',
    padding: '6px',
    textAlign: 'left',
  },
  patternLabel: {
    fontSize: '0.75rem',
    fontWeight: '500',
    color: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(2px)',
    padding: '2px 6px',
    borderRadius: '4px',
    width: '100%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  patternCheck: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    backgroundColor: 'var(--color-accent)',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },
  customContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  customRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  customLabel: {
    fontSize: '0.8rem',
    fontWeight: '500',
    color: 'var(--text-main)',
  },
  customColorInput: {
    width: '45px',
    height: '28px',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },
  gradientEditor: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
    paddingTop: '12px',
  },
  gradientInputsRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  gradientInputCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    flex: 1,
  },
  gradientMiniLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
  },
  gradientColorInput: {
    width: '100%',
    height: '28px',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
  },
  gradientAngleCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 2,
  },
  angleSlider: {
    width: '100%',
    height: '6px',
    borderRadius: '3px',
    outline: 'none',
    cursor: 'pointer',
    accentColor: 'var(--color-primary)',
  }
};
