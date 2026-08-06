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

export const getSavedClientId = (): string => {
  return localStorage.getItem(DEFAULT_CLIENT_ID_KEY) || '';
};

export const setSavedClientId = (clientId: string): void => {
  localStorage.setItem(DEFAULT_CLIENT_ID_KEY, clientId.trim());
};

/**
 * Initialize Google Token Client for OAuth 2.0 Access Token with Drive scopes
 */
export const requestGoogleOAuthToken = (clientId: string): Promise<{ accessToken: string; user?: Partial<GoogleDriveUserData> }> => {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      reject(new Error('Google Identity Services SDK가 로드되지 않았습니다. 인터넷 연결을 확인해주세요.'));
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
        callback: async (response: any) => {
          if (response.error) {
            reject(new Error(`Google 인증 오류: ${response.error}`));
            return;
          }

          const accessToken = response.access_token;
          try {
            // Fetch User Profile using access token
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${accessToken}` }
            });

            if (userInfoRes.ok) {
              const profile = await userInfoRes.json();
              resolve({
                accessToken,
                user: {
                  id: profile.sub,
                  email: profile.email,
                  name: profile.name || profile.given_name || '구글 사용자',
                  picture: profile.picture || ''
                }
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
          reject(new Error(`Google OAuth error: ${err.message || '인증 실패'}`));
        }
      });

      client.requestAccessToken();
    } catch (err: any) {
      reject(err);
    }
  });
};

/**
 * Helper to check or create 'padlet' folder in user's Google Drive
 */
export const findOrCreatePadletFolder = async (accessToken: string): Promise<string> => {
  // If demo token
  if (accessToken.startsWith('demo-token-')) {
    return 'demo-folder-id';
  }

  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent("name = 'padlet' and mimeType = 'application/vnd.google-apps.folder' and trashed = false")}&fields=files(id,name)`;

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!searchRes.ok) {
    const errorText = await searchRes.text();
    throw new Error(`Google Drive 폴더 검색 실패: ${searchRes.statusText} (${errorText})`);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'padlet',
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!createRes.ok) {
    throw new Error('Google Drive에 padlet 폴더를 생성할 수 없습니다.');
  }

  const createData = await createRes.json();
  return createData.id;
};

/**
 * Search for padlet_data.json inside folderId
 */
export const findPadletDataFile = async (accessToken: string, folderId: string): Promise<string | null> => {
  if (accessToken.startsWith('demo-token-')) {
    return localStorage.getItem('demo_drive_file_id') || 'demo-file-id';
  }

  const query = `name = 'padlet_data.json' and '${folderId}' in parents and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
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
export const loadPadletDataFromDrive = async (accessToken: string, folderId: string): Promise<{ boards: any[]; posts: any[] } | null> => {
  if (accessToken.startsWith('demo-token-')) {
    const localData = localStorage.getItem('padlet-board-storage-local');
    if (localData) {
      try {
        const parsed = JSON.parse(localData);
        return {
          boards: parsed.state?.boards || [],
          posts: parsed.state?.posts || []
        };
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  const fileId = await findPadletDataFile(accessToken, folderId);
  if (!fileId) return null;

  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    throw new Error('Google Drive에서 패들렛 데이터를 읽는데 실패했습니다.');
  }

  const json = await res.json();
  if (json && Array.isArray(json.boards) && Array.isArray(json.posts)) {
    return {
      boards: json.boards,
      posts: json.posts
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
  if (accessToken.startsWith('demo-token-')) {
    // Demo simulation mode
    localStorage.setItem('demo_padlet_drive_sync', JSON.stringify({
      savedAt: new Date().toISOString(),
      data
    }));
    return true;
  }

  const fileId = await findPadletDataFile(accessToken, folderId);
  const jsonContent = JSON.stringify(data, null, 2);

  if (fileId) {
    // Update existing file
    const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const res = await fetch(updateUrl, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: jsonContent
    });

    return res.ok;
  } else {
    // Create new file with Multipart upload
    const metadata = {
      name: 'padlet_data.json',
      mimeType: 'application/json',
      parents: [folderId]
    };

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

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
        'Content-Type': `multipart/related; boundary="${boundary}"`
      },
      body: multipartRequestBody
    });

    return res.ok;
  }
};
