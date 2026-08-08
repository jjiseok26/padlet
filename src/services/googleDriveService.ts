// Google Identity & Google Drive API Service

declare global {
  interface Window {
    google?: any;
  }
}

export interface GoogleDriveUserData {
  id: string;
  email: string;
  name: string;
  picture: string;
  accessToken: string;
}

const DEFAULT_CLIENT_ID_KEY = 'padlet_google_client_id';

/** Prefer build-time env, then localStorage override. */
export const getGoogleClientId = (): string => {
  const fromEnv = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '';
  if (fromEnv) return fromEnv;
  return localStorage.getItem(DEFAULT_CLIENT_ID_KEY)?.trim() || '';
};

export const getSavedClientId = (): string => getGoogleClientId();

export const setSavedClientId = (clientId: string): void => {
  localStorage.setItem(DEFAULT_CLIENT_ID_KEY, clientId.trim());
};

export const hasEnvClientId = (): boolean => {
  return Boolean((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim());
};

const waitForGoogleSdk = (timeoutMs = 10000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) {
      resolve();
      return;
    }

    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.accounts?.oauth2) {
        window.clearInterval(timer);
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        window.clearInterval(timer);
        reject(new Error('Google 로그인 SDK 로딩 시간 초과. 페이지를 새로고침한 뒤 다시 시도해주세요.'));
      }
    }, 100);
  });
};

/**
 * Initialize Google Token Client for OAuth 2.0 Access Token with Drive scopes
 */
export const requestGoogleOAuthToken = async (
  clientId: string
): Promise<{ accessToken: string; user?: Partial<GoogleDriveUserData> }> => {
  if (!clientId.trim()) {
    throw new Error('Google OAuth Client ID가 필요합니다.');
  }

  await waitForGoogleSdk();

  return new Promise((resolve, reject) => {
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId.trim(),
        scope:
          'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (response: any) => {
          if (response.error) {
            const detail = response.error_description || response.error;
            reject(new Error(`Google 인증 오류: ${detail}`));
            return;
          }

          if (!response.access_token) {
            reject(new Error('Google 액세스 토큰을 받지 못했습니다.'));
            return;
          }

          const accessToken = response.access_token as string;
          try {
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (userInfoRes.ok) {
              const profile = await userInfoRes.json();
              resolve({
                accessToken,
                user: {
                  id: profile.sub,
                  email: profile.email,
                  name: profile.name || profile.given_name || '구글 사용자',
                  picture: profile.picture || '',
                },
              });
            } else {
              resolve({ accessToken });
            }
          } catch (e) {
            console.warn('Google profile fetch warning:', e);
            resolve({ accessToken });
          }
        },
        error_callback: (err: any) => {
          const type = err?.type || err?.message || '';
          if (String(type).includes('popup_closed') || String(type).includes('popup_failed')) {
            reject(new Error('Google 로그인 창이 닫혔습니다. 다시 시도해주세요.'));
            return;
          }
          reject(new Error(`Google OAuth error: ${err?.message || err?.type || '인증 실패'}`));
        },
      });

      // Always show account picker so users can choose the right Google account
      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
};

/**
 * Helper to check or create 'padlet' folder in user's Google Drive
 */
export const findOrCreatePadletFolder = async (accessToken: string): Promise<string> => {
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
    "name = 'padlet' and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
  )}&fields=files(id,name)&pageSize=10`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    throw new Error(`Google Drive 폴더 검색 실패: ${searchRes.status} (${errorText})`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'padlet',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Google Drive에 padlet 폴더를 생성할 수 없습니다. (${createRes.status}: ${errorText})`);
  }

  const createData = await createRes.json();
  return createData.id;
};

/**
 * Search for padlet_data.json inside folderId
 */
export const findPadletDataFile = async (accessToken: string, folderId: string): Promise<string | null> => {
  const query = `name = 'padlet_data.json' and '${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=10`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;

  const data = await res.json();
  if (data.files && data.files.length > 0) {
    return data.files[0].id;
  }
  return null;
};

/**
 * Load board and post data from Google Drive padlet/padlet_data.json
 */
export const loadPadletDataFromDrive = async (
  accessToken: string,
  folderId: string
): Promise<{ boards: any[]; posts: any[] } | null> => {
  const fileId = await findPadletDataFile(accessToken, folderId);
  if (!fileId) return null;

  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error('Google Drive에서 패들렛 데이터를 읽는데 실패했습니다.');
  }

  const json = await res.json();
  if (json && Array.isArray(json.boards) && Array.isArray(json.posts)) {
    return {
      boards: json.boards,
      posts: json.posts,
    };
  }
  return null;
};

/**
 * Save board and post data to Google Drive padlet/padlet_data.json
 */
export const savePadletDataToDrive = async (
  accessToken: string,
  folderId: string,
  data: { boards: any[]; posts: any[] }
): Promise<boolean> => {
  const fileId = await findPadletDataFile(accessToken, folderId);
  const jsonContent = JSON.stringify(data, null, 2);

  if (fileId) {
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const res = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: jsonContent,
    });

    return res.ok;
  }

  const metadata = {
    name: 'padlet_data.json',
    mimeType: 'application/json',
    parents: [folderId],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const close_delim = `\r\n--${boundary}--`;

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    'Content-Type: application/json\r\n\r\n' +
    jsonContent +
    close_delim;

  const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
  const res = await fetch(createUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary="${boundary}"`,
    },
    body: multipartRequestBody,
  });

  return res.ok;
};
