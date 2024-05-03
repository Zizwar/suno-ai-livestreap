const youTubeStreamKey = '';

const fs = require('fs');
const axios = require('axios');
const { execSync } = require('child_process');
const path = require('path');

const downloadVideo = async (url, filename) => {
  const response = await axios.get(url, { responseType: 'stream' });
  const videoPath = path.join('videos', filename);
  const writer = fs.createWriteStream(videoPath);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
};

async function loadSuno() {
  try {
    const response = await axios.get('https://studio-api.suno.ai/api/playlist/1190bf92-10dc-4ce5-968a-7a377f37f984/?page=1');
    const data = response.data;

    if (!data.playlist_clips) {
      console.error("not playlist");
      return;
    }

    const videoUrls = data.playlist_clips.map(clip => clip.clip.video_url);
    console.log({ videoUrls });

    const promises = videoUrls.map(async (videoUrl) => {
      const filename = videoUrl.split('/').pop();
      await downloadVideo(videoUrl, filename);
      return `videos/${filename}`;
    });

    const videoPaths = await Promise.all(promises);
    const fileContent = videoPaths.join('\nfile ');
    fs.writeFileSync('assets.txt', 'file '+fileContent);
    console.log("Videos downloaded and URLs saved to assets.txt");

    // Execute FFmpeg command
    const ffmpegCommand = `ffmpeg -re -f concat -safe 0 -i assets.txt -vf "scale=640:-2" -c:v libx264 -preset fast -b:v 1M -maxrate 1M -bufsize 2M -c:a aac -b:a 128k -f flv rtmp://a.rtmp.youtube.com/live2/${youTubeStreamKey}`;
    execSync(ffmpegCommand, { stdio: 'inherit' });
    console.log("FFmpeg command executed successfully");
  } catch (error) {
    console.error("Error fetching data: ", error);
  }
}

loadSuno();
