import fs from 'fs';
import { fetchPlaylistItemDetails, fetchVideoDetails } from './utils.js';
import { getVideoDurationInSeconds } from "get-video-duration";
import { spawn } from "child_process";

const apiKey = process.env["YOUTUBE_API_KEY"];
const maxRetries = process.env["MAX_RETRIES"] ?? 3;

const dataset = process.argv[2] ?? 'brad';
const albumMode = process.argv[3] && process.argv[3] == 'album';
const rawUrls = fs.readFileSync(`./data/${dataset}/${albumMode ? 'playlist_' : ''}urls.txt`, 'utf-8');

let videoDetails = [];

if (albumMode) {
  for (const playlistUrl of rawUrls.split('\n')) {
    try {
      videoDetails.push(...await fetchPlaylistItemDetails(playlistUrl, apiKey));
    } catch (error) {
      console.error(error.message);
    }
  }
} else {
  for (const videoUrl of rawUrls.split('\n')) {
    try {
      videoDetails.push(...await fetchVideoDetails(videoUrl, apiKey));
    } catch (error) {
      console.error(error.message);
    }
  }
}

for (let [id, name, duration, playlistName] of videoDetails) {
  name = name.replace(/[^\w]+/g, '');
  playlistName = playlistName.replace(/[^\w]+/g, '') ?? 'singles';
  
  const fn = name + "_" + id + ".mp3";
  const outputPath = './data/' + dataset + '/audio/' + playlistName + '/';
  const outputFilePath = outputPath + fn;

  if (!fs.existsSync(outputPath))
    fs.mkdirSync(outputPath, { recursive: true });
  else if (fs.existsSync(outputFilePath)) {
    const existingFileDuration = await getVideoDurationInSeconds(outputFilePath);
    if (Math.abs(existingFileDuration - duration) <= 2) {
      console.log(`Skipping ${name} (${id}) because it already exists.`);
      continue;
    }
  }

  console.log(`Downloading ${name} (${id})...`);

  let retries = 0;
  while (retries < maxRetries) {
    if (retries > 1) console.log(`Attempting ${retries + 1} / ${maxRetries} for ${name} (${id})...`)
    const child = spawn("node", ["downloader.js", id, name, outputPath]);

    child.stdout.on("data", (data) => {
      console.log(`[Child]: ${data}`);
    });

    child.stderr.on("data", (data) => {
      console.error(`[Child Error]: ${data}`);
    });

    child.on("close", async (code) => {
      if (code === 0) {
        console.log(`Child process for ${name} ${id} exited with success.`);
        const fileDuration = await getVideoDurationInSeconds(outputFilePath);
        if (Math.abs(fileDuration - duration) <= 2) {
          console.log('Downloaded file of length ' + fileDuration + ' matches expected length of ' + duration + '.');
          return;
        } else {
          console.log("Duration mismatch: " + fileDuration + " vs " + duration);
        }
      } else {
        console.log(`Child process for id: ${name} ${id} exited with failure. Exit code: ${code}`);
      }
      retries++;
      if (retries >= maxRetries) {
        console.log(`Error downloading video ${name} ${id} after ${maxRetries} attempts.`);
        return;
      }
    });

    if (retries < maxRetries) {
      break;
    }
  }
}