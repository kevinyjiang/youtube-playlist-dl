import fs from 'fs';
import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import os from 'os';
import path from 'path';

const [, , videoId, videoName, outputPath] = process.argv;

const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
const tempFile = path.join(os.tmpdir(), `temp_${videoId}.webm`);
const outputFilePath = path.join(outputPath, `${videoName}_${videoId}.mp3`);
const writeStream = fs.createWriteStream(tempFile);

// Use temp file as work-around since ffmpeg seems to fail when streaming videos longer than ~15 minutes
ytdl(videoUrl, { quality: 'highestaudio', filter: 'audioonly' })
  .pipe(writeStream)
  .on('finish', () => {
    console.log(`Audio download completed for ${videoName}. Converting to MP3...`);

    ffmpeg(tempFile)
      .output(outputFilePath)
      .format('mp3')
      .audioCodec('libmp3lame')
      .on('error', (error) => {
        console.error('Error converting audio:', error.message);
      })
      .on('end', () => {
        console.log(`Audio conversion completed for ${videoName}.`);
        fs.unlink(tempFile, (error) => {
          if (error) {
            console.error('Error deleting temporary file:', error.message);
          } else {
            console.log(`Temporary file deleted for ${videoId}.`);
          }
        });
      })
      .run();
  });
