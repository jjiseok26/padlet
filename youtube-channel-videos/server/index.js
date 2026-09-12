import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const PUBLIC = path.join(ROOT, 'public')
const YT_BASE = 'https://www.googleapis.com/youtube/v3'
const PORT = Number(process.env.PORT) || 3000

const app = express()
app.use(express.static(PUBLIC))

function apiKeyMissing() {
  const key = process.env.YOUTUBE_API_KEY?.trim()
  return !key || key === 'your-api-key-here'
}

function getApiKey() {
  return process.env.YOUTUBE_API_KEY?.trim()
}

async function youtubeGet(pathname, params) {
  const url = new URL(`${YT_BASE}${pathname}`)
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v))
  }
  url.searchParams.set('key', getApiKey())

  const res = await fetch(url)
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const reason =
      data?.error?.errors?.[0]?.reason ||
      data?.error?.status ||
      'youtube_api_error'
    const message =
      data?.error?.message ||
      `YouTube API request failed (${res.status})`
    const err = new Error(message)
    err.status = res.status
    err.reason = reason
    throw err
  }

  return data
}

function mapPlaylistItem(item) {
  const snippet = item.snippet || {}
  const thumbs = snippet.thumbnails || {}
  const thumb =
    thumbs.medium?.url ||
    thumbs.high?.url ||
    thumbs.default?.url ||
    null
  const videoId =
    item.contentDetails?.videoId ||
    snippet.resourceId?.videoId ||
    null

  return {
    videoId,
    title: snippet.title || 'Untitled',
    description: snippet.description || '',
    thumbnail: thumb,
    publishedAt: snippet.publishedAt || item.contentDetails?.videoPublishedAt || null,
    url: videoId ? `https://www.youtube.com/watch?v=${videoId}` : null,
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    apiKeyConfigured: !apiKeyMissing(),
  })
})

app.get('/api/channel/:channelId/videos', async (req, res) => {
  const channelId = String(req.params.channelId || '').trim()

  if (apiKeyMissing()) {
    return res.status(503).json({
      error: 'missing_api_key',
      message:
        'YOUTUBE_API_KEY is not set. Copy .env.example to .env, add a YouTube Data API v3 key, and restart the server.',
    })
  }

  if (!channelId) {
    return res.status(400).json({
      error: 'invalid_channel_id',
      message: 'Enter a YouTube channel ID (for example, UC…).',
    })
  }

  // Typical channel IDs start with UC and are 24 characters; still allow other valid forms.
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(channelId)) {
    return res.status(400).json({
      error: 'invalid_channel_id',
      message:
        'That does not look like a valid channel ID. Use the channel’s UC… ID, not a custom URL or username.',
    })
  }

  const maxResults = Math.min(
    Math.max(Number(req.query.maxResults) || 25, 1),
    50,
  )
  const pageToken = req.query.pageToken ? String(req.query.pageToken) : undefined

  try {
    const channelData = await youtubeGet('/channels', {
      part: 'snippet,contentDetails',
      id: channelId,
    })

    const channel = channelData.items?.[0]
    if (!channel) {
      return res.status(404).json({
        error: 'channel_not_found',
        message:
          'No channel found for that ID. Double-check the channel ID and try again.',
      })
    }

    const uploadsPlaylistId =
      channel.contentDetails?.relatedPlaylists?.uploads

    if (!uploadsPlaylistId) {
      return res.status(404).json({
        error: 'uploads_unavailable',
        message: 'This channel has no uploads playlist available via the API.',
      })
    }

    const playlistData = await youtubeGet('/playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults,
      pageToken,
    })

    const videos = (playlistData.items || [])
      .map(mapPlaylistItem)
      .filter((v) => v.videoId && v.title !== 'Private video' && v.title !== 'Deleted video')

    return res.json({
      channel: {
        id: channel.id,
        title: channel.snippet?.title || 'Unknown channel',
        description: channel.snippet?.description || '',
        thumbnail:
          channel.snippet?.thumbnails?.medium?.url ||
          channel.snippet?.thumbnails?.default?.url ||
          null,
        customUrl: channel.snippet?.customUrl || null,
      },
      uploadsPlaylistId,
      videos,
      nextPageToken: playlistData.nextPageToken || null,
      prevPageToken: playlistData.prevPageToken || null,
      totalResults: playlistData.pageInfo?.totalResults ?? videos.length,
    })
  } catch (err) {
    const reason = err.reason || ''
    let error = 'youtube_api_error'
    let status = err.status || 502
    let message = err.message || 'Failed to fetch videos from YouTube.'

    if (reason === 'keyInvalid' || reason === 'API_KEY_INVALID') {
      error = 'invalid_api_key'
      status = 401
      message =
        'The YouTube API key is invalid. Check YOUTUBE_API_KEY in your .env file.'
    } else if (reason === 'quotaExceeded') {
      error = 'quota_exceeded'
      status = 429
      message =
        'YouTube API quota exceeded for today. Try again later or use another project key.'
    } else if (reason === 'playlistNotFound' || reason === 'channelNotFound') {
      error = 'channel_not_found'
      status = 404
      message = 'Channel or uploads playlist was not found.'
    }

    return res.status(status).json({ error, message, reason: reason || undefined })
  }
})

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC, 'index.html'))
})

app.listen(PORT, () => {
  const keyOk = !apiKeyMissing()
  console.log(`YouTube Channel Videos running at http://localhost:${PORT}`)
  console.log(
    keyOk
      ? 'YOUTUBE_API_KEY is configured.'
      : 'Warning: YOUTUBE_API_KEY is missing. Set it in .env before fetching videos.',
  )
})
