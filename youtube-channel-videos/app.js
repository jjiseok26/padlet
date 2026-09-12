const YT_BASE = 'https://www.googleapis.com/youtube/v3'

const form = document.getElementById('search-form')
const apiKeyInput = document.getElementById('api-key')
const channelInput = document.getElementById('channel-id')
const submitBtn = document.getElementById('submit-btn')
const statusEl = document.getElementById('status')
const channelMeta = document.getElementById('channel-meta')
const results = document.getElementById('results')
const resultsCount = document.getElementById('results-count')
const videoList = document.getElementById('video-list')
const pager = document.getElementById('pager')
const prevBtn = document.getElementById('prev-page')
const nextBtn = document.getElementById('next-page')

const state = {
  apiKey: '',
  channelId: '',
  nextPageToken: null,
  prevPageToken: null,
}

function showStatus(message, tone = 'info') {
  statusEl.hidden = false
  statusEl.dataset.tone = tone
  statusEl.textContent = message
}

function hideStatus() {
  statusEl.hidden = true
  statusEl.textContent = ''
}

function formatDate(iso) {
  if (!iso) return '게시일 정보 없음'
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function mapPlaylistItem(item) {
  const snippet = item.snippet || {}
  const thumbs = snippet.thumbnails || {}
  const thumb =
    thumbs.medium?.url || thumbs.high?.url || thumbs.default?.url || null
  const videoId =
    item.contentDetails?.videoId || snippet.resourceId?.videoId || null

  return {
    videoId,
    title: snippet.title || 'Untitled',
    thumbnail: thumb,
    publishedAt: snippet.publishedAt || item.contentDetails?.videoPublishedAt || null,
    url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
  }
}

async function youtubeGet(pathname, params, apiKey) {
  const url = new URL(`${YT_BASE}${pathname}`)
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v))
  }
  url.searchParams.set('key', apiKey)

  let res
  try {
    res = await fetch(url)
  } catch {
    const err = new Error(
      '네트워크 오류입니다. 인터넷 연결을 확인하세요. Chrome/Edge에서 index.html 파일을 직접 연 뒤 다시 시도해 보세요.',
    )
    err.code = 'network'
    throw err
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || data?.error?.status || ''
    const message = data?.error?.message || `YouTube API 오류 (${res.status})`
    const err = new Error(message)
    err.reason = reason
    err.status = res.status
    throw err
  }
  return data
}

function renderChannel(channel) {
  channelMeta.hidden = false
  const thumb = channel.thumbnail
    ? `<img src="${escapeHtml(channel.thumbnail)}" alt="" width="64" height="64" />`
    : `<div class="thumb-wrap" style="width:64px;height:64px;border-radius:50%"></div>`
  const handle = channel.customUrl
    ? escapeHtml(channel.customUrl)
    : escapeHtml(channel.id)
  channelMeta.innerHTML = `
    ${thumb}
    <div>
      <h1>${escapeHtml(channel.title)}</h1>
      <p>${handle}</p>
    </div>
  `
}

function renderVideos(videos, totalResults) {
  results.hidden = false
  resultsCount.textContent =
    totalResults != null
      ? `${videos.length}개 표시 · 전체 ${totalResults.toLocaleString()}개`
      : `${videos.length}개 영상`

  if (!videos.length) {
    videoList.innerHTML = ''
    showStatus('이 채널에 표시할 공개 영상이 없습니다.', 'warn')
    return
  }

  videoList.innerHTML = videos
    .map((video, index) => {
      const thumb = video.thumbnail
        ? `<img src="${escapeHtml(video.thumbnail)}" alt="" loading="lazy" />`
        : ''
      const href = video.url || '#'
      return `
        <li style="animation-delay: ${Math.min(index * 40, 320)}ms">
          <a class="video-item" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">
            <div class="thumb-wrap">${thumb}</div>
            <div class="video-body">
              <h3 class="video-title">${escapeHtml(video.title)}</h3>
              <p class="video-date">${escapeHtml(formatDate(video.publishedAt))}</p>
            </div>
          </a>
        </li>
      `
    })
    .join('')
}

function renderPager() {
  const hasPrev = Boolean(state.prevPageToken)
  const hasNext = Boolean(state.nextPageToken)
  pager.hidden = !(hasPrev || hasNext)
  prevBtn.disabled = !hasPrev
  nextBtn.disabled = !hasNext
}

function explainApiError(err) {
  const reason = err.reason || ''
  if (err.code === 'network') {
    return { message: err.message, tone: 'error' }
  }
  if (reason === 'keyInvalid' || reason === 'API_KEY_INVALID') {
    return {
      message: 'API 키가 올바르지 않습니다. Google Cloud에서 발급한 YouTube Data API v3 키를 확인하세요.',
      tone: 'warn',
    }
  }
  if (reason === 'quotaExceeded') {
    return {
      message: '오늘 YouTube API 할당량을 초과했습니다. 나중에 다시 시도하세요.',
      tone: 'warn',
    }
  }
  if (reason === 'channelNotFound' || reason === 'playlistNotFound') {
    return { message: '채널 또는 업로드 재생목록을 찾을 수 없습니다.', tone: 'error' }
  }
  return { message: err.message || '영상을 불러오지 못했습니다.', tone: 'error' }
}

async function loadVideos(pageToken) {
  const { apiKey, channelId } = state
  if (!apiKey || !channelId) return

  hideStatus()
  submitBtn.disabled = true
  submitBtn.textContent = '불러오는 중…'

  try {
    const channelData = await youtubeGet(
      '/channels',
      { part: 'snippet,contentDetails', id: channelId },
      apiKey,
    )

    const channel = channelData.items?.[0]
    if (!channel) {
      channelMeta.hidden = true
      results.hidden = true
      showStatus('해당 ID의 채널을 찾을 수 없습니다. UC… 채널 ID인지 확인하세요.', 'error')
      return
    }

    const uploadsPlaylistId = channel.contentDetails?.relatedPlaylists?.uploads
    if (!uploadsPlaylistId) {
      channelMeta.hidden = true
      results.hidden = true
      showStatus('이 채널의 업로드 재생목록을 API로 가져올 수 없습니다.', 'error')
      return
    }

    const playlistParams = {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: 25,
    }
    if (pageToken) playlistParams.pageToken = pageToken

    const playlistData = await youtubeGet('/playlistItems', playlistParams, apiKey)

    const videos = (playlistData.items || [])
      .map(mapPlaylistItem)
      .filter(
        (v) =>
          v.videoId && v.title !== 'Private video' && v.title !== 'Deleted video',
      )

    state.nextPageToken = playlistData.nextPageToken || null
    state.prevPageToken = playlistData.prevPageToken || null

    renderChannel({
      id: channel.id,
      title: channel.snippet?.title || 'Unknown channel',
      thumbnail:
        channel.snippet?.thumbnails?.medium?.url ||
        channel.snippet?.thumbnails?.default?.url ||
        null,
      customUrl: channel.snippet?.customUrl || null,
    })
    renderVideos(videos, playlistData.pageInfo?.totalResults ?? videos.length)
    renderPager()

    if (videos.length) hideStatus()
  } catch (err) {
    channelMeta.hidden = true
    results.hidden = true
    const { message, tone } = explainApiError(err)
    showStatus(message, tone)
  } finally {
    submitBtn.disabled = false
    submitBtn.textContent = '영상 불러오기'
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const apiKey = apiKeyInput.value.trim()
  const channelId = channelInput.value.trim()

  if (!apiKey) {
    showStatus('YouTube API 키를 입력하세요. (코드/파일에 넣지 말고 이 칸에만)', 'warn')
    return
  }
  if (!channelId) {
    showStatus('YouTube 채널 ID를 입력하세요.', 'warn')
    return
  }
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(channelId)) {
    showStatus('채널 ID 형식이 올바르지 않습니다. UC… ID를 사용하세요.', 'warn')
    return
  }

  state.apiKey = apiKey
  state.channelId = channelId
  state.nextPageToken = null
  state.prevPageToken = null
  loadVideos()
})

prevBtn.addEventListener('click', () => {
  if (state.prevPageToken) loadVideos(state.prevPageToken)
})

nextBtn.addEventListener('click', () => {
  if (state.nextPageToken) loadVideos(state.nextPageToken)
})
