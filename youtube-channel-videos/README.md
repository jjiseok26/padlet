# Channel Reel — YouTube channel video list

A small JavaScript web app: enter a YouTube **channel ID**, and the app fetches that channel’s uploads via the **YouTube Data API v3** (`channels` → uploads playlist → `playlistItems`).

## Features

- Input: YouTube channel ID (`UC…`)
- Output: video title, thumbnail, watch link, and publish date
- Clear messages for missing/invalid API key, bad channel ID, empty results, and API errors
- Responsive layout for mobile and desktop
- API key stays on the server (`YOUTUBE_API_KEY`) — never hardcoded in the client

## Requirements

- Node.js 18+
- A YouTube Data API v3 key from Google Cloud

## Get a YouTube API key

1. Open [Google Cloud Console](https://console.cloud.google.com/).
2. Create a project (or select an existing one).
3. Go to **APIs & Services → Library**, search for **YouTube Data API v3**, and enable it.
4. Go to **APIs & Services → Credentials → Create credentials → API key**.
5. (Recommended) Restrict the key to **YouTube Data API v3**.
6. Copy the key into your local `.env` file (next section). Do not commit it.

### Finding a channel ID

- Open a channel on YouTube → **About** → share / channel details, or
- Use a URL like `https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx` — the `UC…` part is the ID.
- A `@handle` is **not** a channel ID for this app.

## Run the app

```bash
cd youtube-channel-videos
cp .env.example .env
# Edit .env and set YOUTUBE_API_KEY=your-real-key

npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

Optional: `npm run dev` starts the server with Node’s `--watch` reload.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `YOUTUBE_API_KEY` | Yes | YouTube Data API v3 key |
| `PORT` | No | Server port (default `3000`) |

## How it works

1. Browser submits a channel ID to `GET /api/channel/:channelId/videos`.
2. Server calls `channels.list` with `part=snippet,contentDetails` to read `relatedPlaylists.uploads`.
3. Server calls `playlistItems.list` on that uploads playlist and returns titles, thumbnails, links, and dates.
4. UI renders the list and supports next/previous page tokens when available.

## Project layout

```
youtube-channel-videos/
├── public/           # HTML, CSS, client JS
├── server/index.js   # Express app + YouTube API proxy
├── .env.example
├── package.json
└── README.md
```

## Notes

- Without `YOUTUBE_API_KEY`, the UI shows a clear warning and API routes return `503`.
- Private/deleted playlist entries are filtered out of the list.
- Quota: each load uses a small number of YouTube API units; Google’s free daily quota can run out.
