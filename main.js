import fs from 'fs';
import arg from 'arg';
import { fetchPlaylistItemDetails, fetchVideoDetails, downloadChildProcess } from './utils.js';
import { getVideoDurationInSeconds } from 'get-video-duration';

const args = arg({
  '--dataset': String,
  '--single': Boolean,
  '--max-retries': Number,
  '-d': '--dataset',
  '-s': '--single',
  '-r': '--max-retries',
});

const apiKey = process.env['YOUTUBE_API_KEY'];
const dataset = args['--dataset'] ?? 'default';
const playlistMode = !args['--single'] ?? true;
const maxRetries = args['--max-retries'] ?? 3;
const rawUrls = fs.readFileSync(`./data/${dataset}/${playlistMode ? 'playlist_' : 'video_'}urls.txt`, 'utf-8').split('\n');

console.log(`Fetching metadata for ${rawUrls.length} ${playlistMode ? 'playlists' : 'videos'}...\n`);

const videoDetails = [];
for (const url of rawUrls) {
  try {
    let details = playlistMode ? 
      await fetchPlaylistItemDetails(url, apiKey) : 
      await fetchVideoDetails(url, apiKey);
    videoDetails.push(...details);
  } catch (error) {
    console.error(error.message);
  }
}

const promises = [];
for (let [id, name, duration, playlistName] of videoDetails) {
  name = name.replace(/[^\w]+/g, '');
  playlistName = playlistName.replace(/[^\w]+/g, '') ?? 'singles';

  const fn = name + '_' + id + '.mp3';
  const outputPath = './data/' + dataset + '/audio/' + playlistName + '/';

  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath, { recursive: true });
  } else if (fs.existsSync(outputPath + fn)) {
    // If the file exists, skip the download if the duration is correct.
    const existingFileDuration = await getVideoDurationInSeconds(outputPath + fn);

    if (Math.abs(existingFileDuration - duration) <= 2) {
      console.log(`Skipping: File ${fn} exists and has the correct duration.\n`);
      continue;
    } else {
      console.log(`Redownloading: File ${fn} has an incorrect duration.\n`);
    }
  }
  promises.push(downloadChildProcess(id, name, duration, outputPath, fn, maxRetries));
}

Promise.all(promises)
  .then(() => {
    console.log('All downloads complete.\n');
  })
  .catch((error) => {
    console.error('Error in downloading one or more files:', error);
  });
  