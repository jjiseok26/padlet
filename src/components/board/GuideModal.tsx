import React from 'react';
import { 
  X, 
  HelpCircle, 
  Plus, 
  Move, 
  LayoutGrid, 
  Columns, 
  Kanban,
  Download,
  Upload,
  Share2
} from 'lucide-react';

interface GuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuideModal: React.FC<GuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <HelpCircle size={22} color="var(--color-primary)" />
            <h2>아이디어 보드 사용 설명서</h2>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>📌 소개 및 기본 개념</h3>
            <p style={styles.text}>
              이 프로그램은 Miro, Figma, Padlet처럼 자유로운 디지털 캔버스를 통해 아이디어를 시각화하고 협업하는 도구입니다. 
              <strong>교사용 대시보드</strong>에서 기획 보드를 만들고 관리하며, 학생 및 협업 참가자들과 실시간으로 보드를 공유할 수 있습니다.
            </p>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>🛠️ 레이아웃 모드 가이드</h3>
            <p style={styles.text}>생성 목적에 따라 총 4개의 뷰포트 레이아웃 모드를 지원합니다.</p>
            <div style={styles.featureGrid}>
              <div style={styles.featureBox}>
                <div style={styles.featureHeader}>
                  <Move size={16} color="var(--color-primary)" />
                  <h4>Canvas (자유 캔버스)</h4>
                </div>
                <p style={styles.subText}>아이디어를 제한 없이 배치할 수 있는 무한 캔버스입니다. 마우스 휠로 확대/축소, 마우스 드래그로 화면 이동, 카드를 드래그하여 임의로 배치할 수 있습니다.</p>
              </div>
              <div style={styles.featureBox}>
                <div style={styles.featureHeader}>
                  <LayoutGrid size={16} color="var(--color-accent)" />
                  <h4>Grid (바둑판식 배열)</h4>
                </div>
                <p style={styles.subText}>부착된 카드들이 겹치지 않고 격자망 형태로 자동 배치됩니다. 단정하게 결과물을 나열하여 비교하기에 최적화되어 있습니다.</p>
              </div>
              <div style={styles.featureBox}>
                <div style={styles.featureHeader}>
                  <Columns size={16} color="#fbbf24" />
                  <h4>Wall (벽돌형 배열)</h4>
                </div>
                <p style={styles.subText}>글자 수나 이미지 높이에 따라 카드 크기가 최적화되어 채워지는 레이아웃입니다. 다양한 미디어 포스팅을 한눈에 보기에 좋습니다.</p>
              </div>
              <div style={styles.featureBox}>
                <div style={styles.featureHeader}>
                  <Kanban size={16} color="#34d399" />
                  <h4>Column (칸반 보드)</h4>
                </div>
                <p style={styles.subText}>Trello 방식의 세로 기둥(Column)형 레이아웃입니다. 기획 단계나 일정 관리 시 카드를 끌어서 다른 기둥으로 이동시키며 프로세스를 점검할 수 있습니다.</p>
              </div>
            </div>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>✍️ 카드 작성 및 활용법</h3>
            <ul style={styles.list}>
              <li>
                <strong>카드 작성 방법:</strong> 
                <ul>
                  <li>우측 상단의 <span style={styles.inlineBadge}><Plus size={10} /> 카드 추가</span> 버튼을 누릅니다.</li>
                  <li>Canvas 모드에서는 빈 공간을 <strong>더블 클릭</strong>해도 마우스 커서 위치에 바로 새로운 카드가 부착됩니다.</li>
                </ul>
              </li>
              <li>
                <strong>다양한 첨부 파일:</strong> 글을 쓸 때 유튜브 링크, 일반 웹사이트 URL 주소를 입력하면 자동으로 미리보기(썸네일, 링크 제목, 로고)를 파싱하여 이쁘게 채워줍니다. 이미지 URL을 넣으면 카드가 돋보입니다.
              </li>
              <li>
                <strong>비로그인 게스트 포스팅 규칙:</strong> 게스트로 접속한 학생들도 자유롭게 포스트를 부착하고, 본인이 쓴 글은 비밀번호를 입력해 수정 및 삭제할 수 있습니다.
              </li>
            </ul>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>💾 데이터 내보내기 & 복원 (백업 시스템)</h3>
            <p style={styles.text}>우리 서비스는 별도의 고비용 서버 DB가 없어도 파일 형식으로 완벽한 데이터 영구 보존을 제공합니다.</p>
            <div style={styles.featureGrid}>
              <div style={styles.featureBox}>
                <div style={styles.featureHeader}>
                  <Download size={16} color="var(--color-primary)" />
                  <h4>PDF 및 JSON 내보내기</h4>
                </div>
                <p style={styles.subText}>보드 내부 우측 상단의 `내보내기` 메뉴에서 사용 가능합니다. **PDF 다운로드**는 화면을 왜곡 없이 고화질 캡처하여 문서로 저장하며, **JSON 다운로드**는 복원용 원본 데이터를 파일로 저장합니다.</p>
              </div>
              <div style={styles.featureBox}>
                <div style={styles.featureHeader}>
                  <Upload size={16} color="var(--color-accent)" />
                  <h4>보드 불러오기</h4>
                </div>
                <p style={styles.subText}>대시보드 메인 화면 상단에서 사용할 수 있습니다. 기존에 저장해 둔 JSON 백업 파일을 선택하여 업로드하면, 보드 설정과 카드가 즉시 복구됩니다.</p>
              </div>
            </div>
          </section>

          <section style={styles.section}>
            <h3 style={styles.sectionTitle}>🌐 실시간 학생 공유 및 공동작업</h3>
            <ul style={styles.list}>
              <li>
                <strong>링크 공유 방법:</strong> 보드 상단의 <span style={styles.inlineBadge}><Share2 size={10} /> 링크 공유</span> 버튼을 클릭하면 클립보드에 특수 공유 URL이 자동으로 복사됩니다.
              </li>
              <li>
                이 주소를 학생들에게 보내주면, 학생들은 별도의 가입이나 교사 비밀번호 입력 없이 **실시간으로 동일한 보드에 바로 접속**하여 함께 포스트잇을 붙이고 의견(댓글, 이모지 반응)을 남길 수 있습니다.
              </li>
              <li>
                <strong>실시간 동기화:</strong> 다른 사람이 글을 작성하거나 Canvas 레이아웃에서 카드를 드래그하여 움직이면 모든 다른 접속자들의 화면에도 실시간으로 갱신되어 보입니다.
              </li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.confirmBtn} onClick={onClose}>
            설명서 닫기
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    backdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  modal: {
    width: '90%',
    maxWidth: '760px',
    maxHeight: '85vh',
    backgroundColor: '#0f172a',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '20px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#94a3b8',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 0.2s',
  },
  content: {
    padding: '24px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '28px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  sectionTitle: {
    fontSize: '1.05rem',
    fontWeight: 'bold',
    color: '#ffffff',
    borderLeft: '4px solid var(--color-primary)',
    paddingLeft: '10px',
  },
  text: {
    fontSize: '0.875rem',
    color: '#cbd5e1',
    lineHeight: '1.6',
  },
  subText: {
    fontSize: '0.8rem',
    color: '#94a3b8',
    lineHeight: '1.5',
    marginTop: '6px',
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginTop: '6px',
  },
  featureBox: {
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    padding: '16px',
  },
  featureHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  list: {
    paddingLeft: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    fontSize: '0.875rem',
    color: '#cbd5e1',
    lineHeight: '1.6',
  },
  inlineBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '6px',
    padding: '2px 6px',
    fontSize: '0.75rem',
    verticalAlign: 'middle',
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid rgba(255, 255, 255, 0.08)',
    display: 'flex',
    justifyContent: 'flex-end',
    background: 'rgba(0, 0, 0, 0.1)',
  },
  confirmBtn: {
    background: 'var(--color-primary)',
    color: '#030712',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 24px',
    fontSize: '0.85rem',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
  }
};
