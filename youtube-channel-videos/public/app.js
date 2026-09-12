const form = document.getElementById('search-form')
const input = document.getElementById('channel-id')
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
  if (!iso) return 'Publish date unavailable'
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

function renderChannel(channel) {
  channelMeta.hidden = false
  const thumb = channel.thumbnail
    ? `<img src="${escapeHtml(channel.thumbnail)}" alt="" width="64" height="64" />`
    : `<div class="thumb-wrap" style="width:64px;height:64px;border-radius:50%"></div>`
  const handle = channel.customUrl ? escapeHtml(channel.customUrl) : escapeHtml(channel.id)
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
      ? `${videos.length} shown · ${totalResults.toLocaleString()} total uploads`
      : `${videos.length} videos`

  if (!videos.length) {
    videoList.innerHTML = ''
    showStatus('This channel has no public videos to show.', 'warn')
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

async function checkHealth() {
  try {
    const res = await fetch('/api/health')
    const data = await res.json()
    if (!data.apiKeyConfigured) {
      showStatus(
        'API key missing: set YOUTUBE_API_KEY in a .env file (see README), then restart the server.',
        'warn',
      )
    }
  } catch {
    showStatus('Could not reach the local API server.', 'error')
  }
}

async function loadVideos(pageToken) {
  const channelId = state.channelId
  if (!channelId) return

  hideStatus()
  submitBtn.disabled = true
  submitBtn.textContent = 'Loading…'

  const params = new URLSearchParams({ maxResults: '25' })
  if (pageToken) params.set('pageToken', pageToken)

  try {
    const res = await fetch(
      `/api/channel/${encodeURIComponent(channelId)}/videos?${params}`,
    )
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      channelMeta.hidden = true
      results.hidden = true
      const tone =
        data.error === 'missing_api_key' || data.error === 'invalid_api_key'
          ? 'warn'
          : 'error'
      showStatus(data.message || 'Request failed.', tone)
      return
    }

    state.nextPageToken = data.nextPageToken
    state.prevPageToken = data.prevPageToken

    renderChannel(data.channel)
    renderVideos(data.videos || [], data.totalResults)
    renderPager()

    if ((data.videos || []).length) {
      hideStatus()
    }
  } catch {
    channelMeta.hidden = true
    results.hidden = true
    showStatus('Network error while fetching videos. Is the server running?', 'error')
  } finally {
    submitBtn.disabled = false
    submitBtn.textContent = 'Load videos'
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault()
  const channelId = input.value.trim()
  if (!channelId) {
    showStatus('Enter a YouTube channel ID.', 'warn')
    return
  }
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

checkHealth()
