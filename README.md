# youtube-playlist-dl

concurrently bulk download youtube videos as mp3 with `node-ytdl-core`.

## Requirements

- Node.js runtime
- ffmpeg
- YouTube Data API v3 key

## Setup

1. Clone this repo:

```bash
git clone https://github.com/kevinyjiang/youtube-playlist-dl.git
```

2. Install dependencies:

```bash
cd youtube-playlist-dl
yarn
```

3. Set environment variable:

```bash
export YOUTUBE_API_KEY=your_api_key
```

## Usage

1. Create a `data` directory in the project root, with a subdirectory named after your dataset

```bash
mkdir -p data/dataset_name
```

2. Inside the subdirectory, create a text file called `playlist_urls.txt` for playlists or `video_urls.txt` for individual videos. Each line should contain a URL to a YouTube playlist or video, respectively.

3. Run the program. Without any flags, it will run on the `default` dataset in playlist mode.

```bash
node main.js [--dataset dataset_name] [--single] [--max-retries retries_count]
```

### Flags

- `--dataset`, `-d`: Name of the dataset. This should match the subdirectory you created inside the `data` directory (default: `default`).
- `--single`, `-s`: Downloading single videos instead of playlists.
- `--max-retries`, `-r`: Max retries for failed downloads or ffmpeg weirdness (default: `3`).

## Output

```
data
└── dataset_name
    └── audio
        ├── playlist1
        │   ├── video1_id.mp3
        │   ├── video2_id.mp3
        │   └── ...
        ├── playlist2
        │   ├── video1_id.mp3
        │   ├── video2_id.mp3
        │   └── ...
        └── singles
            ├── video1_id.mp3
            ├── video2_id.mp3
            └── ...
```
