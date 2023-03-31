import YoutubeMp3Downloader from "youtube-mp3-downloader";

const [, , videoId, videoName, outputPath] = process.argv;

process.env.YTDL_NO_UPDATE = false;

const downloader = new YoutubeMp3Downloader({
  ffmpegPath: "/opt/homebrew/opt/ffmpeg/bin/ffmpeg",
  outputPath: outputPath,
  youtubeVideoQuality: "highestaudio",
  queueParallelism: 1,
  progressTimeout: 5000,
});

downloader.on("finished", function (err, data) {
  process.exit(0);
});

downloader.on("error", function (error) {
  console.log("error:", error);
  process.exit(1);
});

downloader.on("progress", function(progress) {
    let percentage = Math.round(progress.progress.percentage);
    if (percentage % 20 === 0)
      console.log(videoName + ': ' + percentage + '%');
});

downloader.download(videoId, videoName + "_" + videoId + ".mp3");
