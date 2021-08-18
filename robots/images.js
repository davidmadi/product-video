const imageDownloader = require('image-downloader')
const google = require('googleapis').google;
const customsearch = google.customsearch('v1');
const gm = require('gm').subClass({imageMagick:true});
const robots = {
  state : require('./state.js')
}
const googleSearchCredentials = require('../credentials/google-search.json');

async function robot(){
  const content = robots.state.load();

  //await downloadAllImages(content);
  await convertAllImages(content);
  //await createAllSentenceImages(content);

  robots.state.save(content);
}

async function downloadAllImages(content){
  const preventDuplicatedImages = {};
  //preventDuplicatedImages[content.products[1].images[0]] = true;
  for (var i = 0; i < content.products.length; i++){
    let product = content.products[i];
    product.templateStructure.images = [];
    const mainUrl = product.amazonResponse.result[0].main_image;
    await downloadAndSave(mainUrl, `${i}-original.png`);
    product.templateStructure.images.push(`${i}-original.png`);
    
    if (product.amazonResponse.result[0].variants.length > 0){
      for(var v = 0; v < product.amazonResponse.result[0].variants.length; v++){
        try{
          const variant = product.amazonResponse.result[0].variants[v];
          if (variant.images && variant.images.length > 0){
            await downloadAndSave(variant.images[0].large, `${i}-variant-${v}-original.png`);
            product.templateStructure.images.push(`${i}-variant-${v}-original.png`);
          }
        }
        catch(error){
          console.log(`Error downloading image: ${imageUrl} | ${error}`);
        }
      }
    }
    else if (product.amazonResponse.result[0].images.length > 0){
      for(var v = 0; v < product.amazonResponse.result[0].images.length; v++){
        try{
          await downloadAndSave(product.amazonResponse.result[0].images[v], `${i}-variant-${v}-original.png`);
          product.templateStructure.images.push(`${i}-variant-${v}-original.png`);
        }
        catch(error){
          console.log(`Error downloading image: ${imageUrl} | ${error}`);
        }
      }
    }

  }
}


async function downloadAndSave(url, fileName){
  console.log(`Downloading image ${url}`);
  return  imageDownloader.image({
    url, url,
    dest: `./content/${fileName}`
  })
}


async function convertAllImages(content){
  for(const product of content.products){
    for(const image of product.templateStructure.images){
      let to = image.replace("original", "converted");
      await convertImage(image, to);
    }
  }
}

async function convertImage(from, to){
  return new Promise((resolve,reject)=>{
    console.log(`Converting image ${from}`)
    const inputFile = `./content/${from}[0]`;
    const outputFile = `./content/${to}`;
    const width = 1920;
    const height = 1080;
    gm()
    .in(inputFile)
    .out('(')
      .out('-clone')
      .out('0')
      .out('-background', 'white')
      .out('-blur', '0x9')
      .out('-resize', `${width}x${height}^`)
    .out(')')
    .out('(')
      .out('-clone')
      .out('0')
      .out('-background', 'white')
      .out('-resize', `${width}x${height}`)
    .out(')')
    .out('-delete', '0')
    .out('-gravity', 'center')
    .out('-compose', 'over')
    .out('-composite')
    .out('-extent', `${width}x${height}`)
    .write(outputFile, (error)=>{
      if (error){
        return reject(error);
      }
      console.log(`Image converted: ${inputFile}`);
      resolve();
    })
  });
}

async function createAllSentenceImages(content){
  for(var i = 0; i < content.products.length; i++){
    await createSentenceImage(i, content.products[i].text);
  }
}

async function createSentenceImage(sentenceIndex, text){
  return new Promise((resolve,reject)=>{
    const outputFile = `./content/${sentenceIndex}-sentence.png`;
    const templateSettings = {
      0:{
        size:'1920x400',
        gravity:'center'
      },
      1:{
        size:'1920x1080',
        gravity:'center'
      },
      2:{
        size:'800x1080',
        gravity:'center'
      },
      3:{
        size:'1920x400',
        gravity:'center'
      },
      4:{
        size:'1920x1080',
        gravity:'center'
      },
      5:{
        size:'800x1080',
        gravity:'center'
      },
      6:{
        size:'1920x400',
        gravity:'center'
      },
    };

    gm()
    .out('-size', templateSettings[sentenceIndex].size)
    .out('-gravity', templateSettings[sentenceIndex].gravity)
    .out('-background', 'transparent')
    .out('-fill', 'white')
    .out('-kerning', '-1')
    .out(`caption:${text}`)
    .write(outputFile, error =>{
      if (error) return reject(error);

      console.log(`> Sentence created ${outputFile}`);
      resolve();
    })
  });
}


module.exports = robot