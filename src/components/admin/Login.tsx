import React, { useState } from 'react';
import { useAuthStore } from '../../store/useBoardStore';
import { motion } from 'framer-motion';
import { Lock, User, LogIn, ShieldAlert, HelpCircle } from 'lucide-react';
import { GuideModal } from '../board/GuideModal';

export const Login: React.FC = () => {
  const login = useAuthStore(state => state.login);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shakeTrigger, setShakeTrigger] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const success = login(username.trim(), password);

    if (!success) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.');
      // Trigger Framer Motion shake animation
      setShakeTrigger(true);
      setTimeout(() => setShakeTrigger(false), 500);
    }
  };

  return (
    <div style={styles.loginViewport}>
      {/* Background Animated Glowing Orbs */}
      <motion.div 
        animate={{
          x: [0, 40, -30, 0],
          y: [0, -50, 40, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ ...styles.glowOrb, ...styles.glowOrb1 }}
      />
      <motion.div 
        animate={{
          x: [0, -50, 40, 0],
          y: [0, 40, -50, 0],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        style={{ ...styles.glowOrb, ...styles.glowOrb2 }}
      />

      {/* Floating Guide Button for First Time Users */}
      <button 
        className="button-premium active"
        onClick={() => setIsGuideOpen(true)}
        style={styles.floatingGuideBtn}
        title="서비스 사용 설명서 열기"
      >
        <HelpCircle size={18} />
        <span>처음 오셨나요? 사용 설명서 보기</span>
      </button>

      {/* Glassmorphic Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={shakeTrigger ? { 
          x: [0, -10, 10, -10, 10, -5, 5, 0],
          opacity: 1,
          y: 0,
          transition: { x: { duration: 0.4 } }
        } : { 
          x: 0,
          opacity: 1,
          y: 0
        }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }}
        className="glass-panel"
        style={styles.loginCard}
      >
        {/* Title logo */}
        <div style={styles.logoContainer}>
          <div style={styles.logoIconWrapper}>
            <Lock size={26} color="var(--color-primary)" />
          </div>
          <h2 style={styles.title}>교사 로그인</h2>
          <p style={styles.subtitle}>캔버스 보드 교사용 제어 시스템</p>
        </div>

        {/* Error Toast Message */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={styles.errorBanner}
          >
            <ShieldAlert size={14} style={{ marginRight: '6px' }} />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>교사 계정 ID</label>
            <div style={styles.inputWrapper}>
              <User size={16} style={styles.fieldIcon} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ID를 입력해 주세요"
                required
                style={styles.inputField}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>패스워드</label>
            <div style={styles.inputWrapper}>
              <Lock size={16} style={styles.fieldIcon} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력해 주세요"
                required
                style={styles.inputField}
              />
            </div>
          </div>

          <button type="submit" className="button-premium active" style={styles.submitBtn}>
            <LogIn size={16} />
            <span>대시보드 접속</span>
          </button>
        </form>
      </motion.div>

      {/* Guide Manual Modal */}
      <GuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  loginViewport: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617', // Extremely deep space dark slate
    position: 'relative',
    overflow: 'hidden',
  },
  glowOrb: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(100px)',
    opacity: 0.35,
    pointerEvents: 'none',
  },
  glowOrb1: {
    width: '350px',
    height: '350px',
    background: 'radial-gradient(circle, var(--color-primary) 0%, rgba(0,0,0,0) 70%)',
    top: '15%',
    left: '20%',
  },
  glowOrb2: {
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, var(--color-accent) 0%, rgba(0,0,0,0) 70%)',
    bottom: '10%',
    right: '15%',
  },
  loginCard: {
    width: '380px',
    padding: '36px 30px',
    borderRadius: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
    position: 'relative',
    zIndex: 10,
  },
  logoContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '8px',
  },
  logoIconWrapper: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    backgroundColor: 'rgba(129, 140, 248, 0.1)',
    border: '1px solid rgba(129, 140, 248, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '8px',
  },
  title: {
    fontSize: '1.35rem',
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
  },
  errorBanner: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    border: '1px solid rgba(239, 68, 68, 0.25)',
    borderRadius: '10px',
    padding: '10px 14px',
    color: '#f87171',
    fontSize: '0.775rem',
    fontWeight: '500',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(0, 0, 0, 0.35)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '2px 12px',
    transition: 'all 0.2s ease',
  },
  fieldIcon: {
    color: 'var(--text-muted)',
    marginRight: '10px',
  },
  inputField: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ffffff',
    fontSize: '0.85rem',
    padding: '12px 0',
    fontFamily: 'inherit',
  },
  submitBtn: {
    width: '100%',
    padding: '12px 0',
    justifyContent: 'center',
    borderRadius: '12px',
    fontSize: '0.9rem',
    fontWeight: 'bold',
    marginTop: '6px',
  },
  floatingGuideBtn: {
    position: 'absolute',
    top: '30px',
    right: '30px',
    zIndex: 100,
    cursor: 'pointer',
  }
};
