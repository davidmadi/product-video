const gm = require('gm').subClass({imageMagick:true});
const spawn = require('child_process').spawn;
const path = require('path');
const rootPath = path.resolve(__dirname, '..'); 
const state = require("./state.js");

async function robot(){
  const content = state.load();
  await createYoutubeThumbnail();
  await createAfterEffectsScript(content);
  await renderVideoWithAfterEffects();
}


async function createYoutubeThumbnail(){
  return new Promise((resolve,reject)=>{
    gm()
    .in('./content/0-converted.png')
    .write('./content/youtube-thumbnail.png', (error)=>{
      if (error) return reject(error);
      console.log(`> Creating youtube thumbnail`);
      resolve();
    });
  });
}

async function createAfterEffectsScript(content) {
  await state.saveScript(content);
}

async function renderVideoWithAfterEffects() {
  return new Promise((resolve, reject) => {
    const aerenderFilePath = `/Applications/Adobe After Effects 2020/aerender`;
    const templateFilePath = `${rootPath}/templates/1/template.aep`;
    const destinationFilePath = `${rootPath}/content/output.mov`;

    console.log(`${rootPath}/templates/1/template.aep`);
    console.log('> [video-robot] Starting After Effects');

    const aerender = spawn(aerenderFilePath, [
      '-comp', 'main',
      '-project', templateFilePath,
      '-output', destinationFilePath,
      '-reuse'
    ]);

    aerender.stdout.on('data', (data) => {
      process.stdout.write(data)
    });

    aerender.on('close', () => {
      console.log('> [video-robot] After Effects closed')
      resolve()
    })
  })
}

module.exports = robot