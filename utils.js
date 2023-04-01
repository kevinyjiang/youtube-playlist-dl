import fs from 'fs';
import fetch from 'node-fetch';
import { spawn } from 'child_process';
import { getVideoDurationInSeconds } from 'get-video-duration';

const YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3/';

const extractVideoId = (url) => {
  const regex = /(?:v=|youtu\.be\/)([^&?]+)/;
  const match = url.match(regex);
  return match ? match[1] : null;
};

const extractPlaylistId = (_url) => {
  const url = new URL(_url);
  const params = new URLSearchParams(url.search);
  const playlistId = params.get('list');
  if (!playlistId) {
    console.error('Invalid playlist URL.');
    return;
  }
  return playlistId;
};

export const fetchPlaylistName = async (playlistId, apiKey) => {
  const requestUrl = `${YOUTUBE_API_BASE_URL}playlists?part=snippet&id=${playlistId}&key=${apiKey}`;
  const apiResponse = await fetch(requestUrl);

  if (!apiResponse.ok) {
    throw new Error(`Error fetching playlist data from YouTube API: ${apiResponse.status} ${apiResponse.statusText}`);
  }

  const data = await apiResponse.json();
  const playlistName = data.items[0].snippet.title;
  return playlistName;
};

export const fetchVideoDetails = async (url, apiKey) => {
  const videoId = extractVideoId(url);
  const videoDetailsUrl = `${YOUTUBE_API_BASE_URL}videos?part=snippet,contentDetails&id=${videoId}&key=${apiKey}`;

  const apiResponse = await fetch(videoDetailsUrl);

  if (!apiResponse.ok) {
    throw new Error(`[INFO] Error fetching video details from YouTube API: ${apiResponse.status} ${apiResponse.statusText}`);
  }

  const data = await apiResponse.json();

  if (data.items.length > 0) {
    const videoName = data.items[0].snippet.title;
    const videoDuration = data.items[0].contentDetails.duration;
    return [[videoId, videoName, videoDuration]];
  } else {
    console.warn(`Video details not found for videoId: ${videoId}`);
    return [];
  }
};

export const fetchPlaylistItemDetails = async (url, apiKey) => {
  const playlistId = extractPlaylistId(url);
  const result = [];
  let nextPageToken = '';

  const playlistName = await fetchPlaylistName(playlistId, apiKey);

  do {
    const requestUrl = `${YOUTUBE_API_BASE_URL}playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${playlistId}&key=${apiKey}&pageToken=${nextPageToken}`;
    const apiResponse = await fetch(requestUrl);
    if (!apiResponse.ok) {
      throw new Error(`Error fetching playlist data from YouTube API: ${apiResponse.status} ${apiResponse.statusText}`);
    }

    const data = await apiResponse.json();
    nextPageToken = data.nextPageToken;

    for (const item of data.items) {
      const videoId = item.contentDetails.videoId;
      const videoName = item.snippet.title;
      const videoDetailsUrl = `${YOUTUBE_API_BASE_URL}videos?part=contentDetails&id=${videoId}&key=${apiKey}`;
      const videoDetailsResponse = await fetch(videoDetailsUrl);

      if (!videoDetailsResponse.ok) {
        throw new Error(`Error fetching video details from YouTube API: ${videoDetailsResponse.status} ${videoDetailsResponse.statusText}`);
      }
      const videoDetailsData = await videoDetailsResponse.json();
      if (videoDetailsData.items.length > 0) {
        const videoDuration = durationToSeconds(videoDetailsData.items[0].contentDetails.duration);
        result.push([videoId, videoName, videoDuration, playlistName]);
      } else {
        console.warn(`Video details not found for videoId: ${videoId}`);
        continue;
      }
    }
  } while (nextPageToken);

  return result;
};

const verifyFile = async (outputPath, fn, duration) => {
  if (fs.existsSync(outputPath + fn)) {
    try {
      const fileDuration = await getVideoDurationInSeconds(outputPath + fn);
      if (Math.abs(fileDuration - duration) <= 2) {
        console.log(`Downloaded file ${fn} of length ${fileDuration} matches expected length of ${duration}.\n`);
        return true;
      } else {
        console.log(`Duration mismatch for ${fn}, retrying: ${fileDuration} vs ${duration}.\n`);
        return false;
      }
    } catch (error) {
      console.error(`Error getting duration of the downloaded file ${fn}: ${error}.\n`);
      return false;
    }
  } else {
    console.error(`Downloaded file not found at ${outputPath + fn}.\n`);
    return false;
  }
}

export const downloadChildProcess = async (id, name, duration, outputPath, fn, maxRetries) => {
  return new Promise(async (resolve, reject) => {
    let retries = 0;
    while (retries <= maxRetries) {
      try {
        if (retries > 0) console.log(`Attempting ${retries} / ${maxRetries} for ${name} (${id})...\n`);
        const child = spawn('node', ['downloader.js', id, name, outputPath]);

        child.stdout.on('data', (data) => {
          console.log(`${data}`);
        });

        await new Promise((childResolve, childReject) => {
          child.on('close', async (code) => {
            if (code === 0) {
              console.log(`Process for ${name} (${id}) exited with success.\n`);
              if (verifyFile(outputPath, fn, duration)) {
                childResolve();
              } else {
                childReject(new Error(`Downloaded file ${fn} of length ${fileDuration} does not match expected length of ${duration}.\n`));
              }
            } else {
              childReject(new Error(`Process exited with error code ${code}.\n`));
            }
          });
        });

        resolve();
        break;
      } catch (error) {
        if (await verifyFile(outputPath, fn, duration)) {
          resolve();
          break;
        }
        console.error(`Error on attempt ${retries + 1} for ${name} (${id}): ${error.message}`);
        retries++;
      }
    }

    if (retries >= maxRetries) {
      reject(new Error(`All retries failed for ${name} (${id}).\n`));
    }
  });
}

const durationToSeconds = (duration) => {
  const match = duration.match(/P(\d+Y)?(\d+M)?(\d+W)?(\d+D)?T(\d+H)?(\d+M)?(\d+S)?/);
  const parts = [
    { pos: 1, multiplier: 86400 * 365 },
    { pos: 2, multiplier: 86400 * 30 },
    { pos: 3, multiplier: 604800 },
    { pos: 4, multiplier: 86400 },
    { pos: 5, multiplier: 3600 },
    { pos: 6, multiplier: 60 },
    { pos: 7, multiplier: 1 },
  ];

  let total = 0;

  for (const part of parts) {
    if (match[part.pos] != null) {
      total += parseInt(match[part.pos]) * part.multiplier;
    }
  }

  return total;
}

