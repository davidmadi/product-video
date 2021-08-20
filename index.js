
const robots = {
  amazon : require('./robots/amazon'),
  text: require('./robots/text.js'),
  state : require('./robots/state.js'),
  input : require('./robots/input.js'),
  images : require('./robots/images.js'),
  video : require('./robots/video.js'),
  youtube : require('./robots/youtube.js')
}

async function start(){
  const content = robots.state.load();
  //robots.input();
  //await robots.amazon();
  //await robots.text()
  await robots.images()
  process.exit();
  robots.state.saveScript(content);
  await robots.video();
  //await robots.youtube();
  console.log("> End");
  process.exit();
}


start();