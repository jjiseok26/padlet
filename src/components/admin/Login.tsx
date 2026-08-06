import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/useBoardStore';
import { motion } from 'framer-motion';
import { ShieldAlert, HelpCircle, HardDrive, Settings, CheckCircle2, RefreshCw } from 'lucide-react';
import { GuideModal } from '../board/GuideModal';
import {
  requestGoogleOAuthToken,
  getSavedClientId,
  setSavedClientId
} from '../../services/googleDriveService';

export const Login: React.FC = () => {
  const googleLogin = useAuthStore(state => state.googleLogin);

  const [clientIdInput, setClientIdInput] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shakeTrigger, setShakeTrigger] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  useEffect(() => {
    const saved = getSavedClientId();
    if (saved) {
      setClientIdInput(saved);
    }
  }, []);

  const handleSaveClientId = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedClientId(clientIdInput.trim());
    setShowConfig(false);
    setError('');
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);

    const targetClientId = clientIdInput.trim() || getSavedClientId();

    if (!targetClientId) {
      // Prompt user to enter Client ID or use demo mode
      setError('Google OAuth Client ID가 설정되지 않았습니다. [Client ID 설정] 또는 [체험용 계정 시작]을 선택해주세요.');
      setShowConfig(true);
      setIsLoading(false);
      triggerShake();
      return;
    }

    try {
      const authResult = await requestGoogleOAuthToken(targetClientId);
      if (authResult.accessToken) {
        const userName = authResult.user?.name || '구글 사용자';
        const userEmail = authResult.user?.email || 'user@gmail.com';
        const userPicture = authResult.user?.picture || '';

        const success = await googleLogin({
          name: userName,
          email: userEmail,
          picture: userPicture,
          accessToken: authResult.accessToken
        });

        if (!success) {
          setError('Google Drive 연동 초기화 실패. 권한을 확인해주세요.');
          triggerShake();
        }
      }
    } catch (err: any) {
      console.error('Google Sign In Error:', err);
      setError(err.message || 'Google 로그인 중 오류가 발생했습니다.');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoSignIn = async () => {
    setError('');
    setIsLoading(true);

    try {
      const demoToken = `demo-token-${Math.random().toString(36).substring(2, 9)}`;
      await googleLogin({
        name: '구글 교사 (체험)',
        email: 'teacher@gmail.com',
        picture: 'https://lh3.googleusercontent.com/a/default-user',
        accessToken: demoToken
      });
    } catch (err: any) {
      setError(err.message || '체험 로그인 오류');
    } finally {
      setIsLoading(false);
    }
  };

  const triggerShake = () => {
    setShakeTrigger(true);
    setTimeout(() => setShakeTrigger(false), 500);
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
            <HardDrive size={28} color="var(--color-primary)" />
          </div>
          <h2 style={styles.title}>Google 로그인</h2>
          <p style={styles.subtitle}>패들렛 데이터가 구글드라이브 <strong style={{ color: '#818cf8' }}>padlet</strong> 폴더에 자동 동기화됩니다.</p>
        </div>

        {/* Error Toast Message */}
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={styles.errorBanner}
          >
            <ShieldAlert size={14} style={{ marginRight: '6px', flexShrink: 0 }} />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Google Sign In Button */}
        <div style={styles.actionContainer}>
          <button 
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            style={styles.googleBtn}
            className="google-login-btn"
          >
            {isLoading ? (
              <RefreshCw size={20} className="spin" style={{ marginRight: '10px' }} />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" style={{ marginRight: '12px', flexShrink: 0 }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            )}
            <span style={{ fontSize: '0.95rem', fontWeight: '600' }}>Google 계정으로 로그인</span>
          </button>

          {/* Quick Demo Login Option */}
          <button
            onClick={handleDemoSignIn}
            disabled={isLoading}
            style={styles.demoBtn}
            className="button-premium"
            title="Google OAuth Client ID 설정 없이 구글 드라이브 동기화를 체험합니다."
          >
            <CheckCircle2 size={16} color="#818cf8" style={{ marginRight: '8px' }} />
            <span>원클릭 체험 로그인 (Google Drive 시뮬레이션)</span>
          </button>
        </div>

        {/* Client ID Configuration Section Toggle */}
        <div style={styles.configToggleRow}>
          <button 
            type="button" 
            onClick={() => setShowConfig(!showConfig)}
            style={styles.configToggleBtn}
          >
            <Settings size={14} style={{ marginRight: '6px' }} />
            <span>{showConfig ? 'Client ID 설정 닫기' : 'Google Cloud Client ID 직접 설정'}</span>
          </button>
        </div>

        {showConfig && (
          <form onSubmit={handleSaveClientId} style={styles.configForm}>
            <label style={styles.label}>Google OAuth Client ID</label>
            <div style={styles.inputWrapper}>
              <input 
                type="text"
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="xxxx.apps.googleusercontent.com"
                style={styles.inputField}
              />
            </div>
            <button type="submit" className="button-premium active" style={{ marginTop: '8px', padding: '8px 16px' }}>
              Client ID 저장
            </button>
          </form>
        )}
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
    backgroundColor: '#020617',
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
    width: '400px',
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
    fontSize: '0.825rem',
    color: 'var(--text-muted)',
    lineHeight: '1.4',
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
  actionContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  googleBtn: {
    width: '100%',
    padding: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    color: '#1f2937',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.25)',
    transition: 'all 0.2s ease',
  },
  demoBtn: {
    width: '100%',
    padding: '12px',
    justifyContent: 'center',
    borderRadius: '12px',
    fontSize: '0.825rem',
  },
  configToggleRow: {
    display: 'flex',
    justifyContent: 'center',
  },
  configToggleBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: '0.75rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
  configForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    background: 'rgba(0, 0, 0, 0.3)',
    padding: '16px',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.05)',
  },
  label: {
    fontSize: '0.725rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
  },
  inputWrapper: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(0, 0, 0, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '2px 10px',
  },
  inputField: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ffffff',
    fontSize: '0.8rem',
    padding: '8px 0',
    fontFamily: 'inherit',
  },
  floatingGuideBtn: {
    position: 'absolute',
    top: '30px',
    right: '30px',
    zIndex: 100,
    cursor: 'pointer',
  }
};
