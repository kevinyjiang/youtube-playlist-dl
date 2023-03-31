import fs from 'fs';
import { fetchPlaylistItemDetails, fetchVideoDetails } from './utils.js';
import { getVideoDurationInSeconds } from "get-video-duration";
import { spawn } from "child_process";
import arg from "arg";

const args = arg({
  '--dataset': String,
  '--album': Boolean,
  '--max-retries': Number,
  '-d': '--dataset',
  '-a': '--album',
  '-r': '--max-retries',
});

const apiKey = process.env["YOUTUBE_API_KEY"];
const dataset = args['--dataset'] ?? 'default';
const albumMode = args['--album'] ?? false;
const maxRetries = args['--max-retries'] ?? 3;

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

async function downloadChildProcess(id, name, duration, outputPath, outputFilePath) {
  return new Promise(async (resolve, reject) => {
    let retries = 0;
    while (retries <= maxRetries) {
      try {
        if (retries > 0) console.log(`Attempting ${retries} / ${maxRetries} for ${name} (${id})...`);
        const child = spawn("node", ["downloader.js", id, name, outputPath]);

        child.stdout.on("data", (data) => {
          console.log(`[Child]: ${data}`);
        });

        child.stderr.on("data", (data) => {
          console.error(`[Child Error]: ${data}`);
        });

        await new Promise((childResolve, childReject) => {
          child.on("close", async (code) => {
            if (code === 0) {
              console.log(`Child process for ${name} ${id} exited with success.`);
              if (fs.existsSync(outputFilePath)) {
                try {
                  const fileDuration = await getVideoDurationInSeconds(outputFilePath);
                  if (Math.abs(fileDuration - duration) <= 2) {
                    console.log('Downloaded file of length ' + fileDuration + ' matches expected length of ' + duration + '.');
                    childResolve();
                  } else {
                    console.log("Duration mismatch, retrying: " + fileDuration + " vs " + duration);
                    childReject(new Error(`Duration mismatch for ${name} (${id}): ${fileDuration} vs ${duration}`));
                  }
                } catch (error) {
                  console.error(`Error getting duration of the downloaded file for ${name} (${id}):`, error);
                  childReject(error);
                }
              } else {
                console.error(`Downloaded file not found for ${name} (${id}) at ${outputFilePath}`);
                childReject(new Error(`Downloaded file not found for ${name} (${id}) at ${outputFilePath}`));
              }
            } else {
              childReject(new Error(`Child process for ${name} (${id}) exited with failure. Exit code: ${code}`));
            }
          });
        });

        resolve();
        break;
      } catch (error) {
        console.error(`Error on attempt ${retries + 1} for ${name} (${id}):`, error.message);
        retries++;
      }
    }

    if (retries >= maxRetries) {
      reject(new Error(`All retries failed for ${name} (${id})`));
    }
  });
}


const downloadPromises = [];

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
      console.log(`File ${outputFilePath} already exists and has the correct duration. Skipping.`);
      continue;
    } else {
      console.log(`File ${outputFilePath} has an incorrect duration. Redownloading.`);
    }
  }

  downloadPromises.push(downloadChildProcess(id, name, duration, outputPath, outputFilePath));
}

Promise.all(downloadPromises)
  .then(() => {
    console.log("All downloads complete.");
  })
  .catch((error) => {
    console.error("Error in downloading one or more files:", error);
  });
  