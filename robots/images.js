const imageDownloader = require('image-downloader')
const google = require('googleapis').google;
const customsearch = google.customsearch('v1');
const gm = require('gm').subClass({imageMagick:true});
const robots = {
  state : require('./state.js')
}
const googleSearchCredentials = require('../credentials/google-search.json');

async function robot(){
  console.log('> [images] Starting...')
  const content = robots.state.load();
  await downloadAllImages(content);

  await convertAllImages(content);
  await createAllDescriptionImages(content);
  await createAllImportantFeatureImages(content);
  await createAllExtraFeatureImages(content);
  await createAllNameImages(content);

  robots.state.save(content);
  robots.state.saveScript(content);
}

async function downloadAllImages(content){
  const preventDuplicatedImages = {};
  //preventDuplicatedImages[content.products[1].images[0]] = true;
  for (var i = 0; i < content.products.length; i++){
    let product = content.products[i];
    let qtyImages = 0;
    product.templateStructure.images = [];
    const mainUrl = product.amazonResponse.result[0].main_image;
    await downloadAndSave(mainUrl, `${i}-original.png`);
    product.templateStructure.images.push(`${i}-original.png`);
    
    if (product.amazonResponse.result[0].variants.length > 0){
      for(var v = 0; v < product.amazonResponse.result[0].variants.length && qtyImages < 3; v++){
        let imageUrl = "";
        try{
          const variant = product.amazonResponse.result[0].variants[v];
          if (variant.images && variant.images.length > 0){
            imageUrl = variant.images[0];
            if (imageUrl.large) imageUrl = imageUrl.large;
            await downloadAndSave(imageUrl, `${i}-variant-${qtyImages}-original.png`);
            product.templateStructure.images.push(`${i}-variant-${qtyImages}-original.png`);
            qtyImages++;
          }
        }
        catch(error){
          console.log(`Error downloading image: ${imageUrl} | ${error}`);
        }
      }
    }
    if (product.amazonResponse.result[0].images.length > 0){
      for(var v = 0; v < product.amazonResponse.result[0].images.length && qtyImages < 3; v++){
        try{
          await downloadAndSave(product.amazonResponse.result[0].images[v], `${i}-variant-${qtyImages}-original.png`);
          product.templateStructure.images.push(`${i}-variant-${qtyImages}-original.png`);
          qtyImages++;
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

async function createAllImportantFeatureImages(content){
  for(var i = 0; i < content.products.length; i++){
    await createSentenceImage(content.products[i].templateStructure.importantFeatures.slice(0,3), `${i}-importantFeatures.png` , 'center' ,'1920x1080');
  }
}

async function createAllExtraFeatureImages(content){
  for(var i = 0; i < content.products.length; i++){
    await createSentenceImage(content.products[i].templateStructure.extraFeatures.slice(0,3), `${i}-extraFeatures.png`, 'center' ,'1920x1080');
  }
}

async function createAllDescriptionImages(content){
  for(var i = 0; i < content.products.length; i++){
    await createSentenceImage(content.products[i].templateStructure.firstDescription, `${i}-description.png`, 'center' ,'1920x1080');
  }
}

async function createAllNameImages(content){
  for(var i = 0; i < content.products.length; i++){
    await createSentenceImage(content.products[i].templateStructure.name, `${i}-name.png`, 'northeast', '1920x1080');
  }
}

async function createSentenceImage(text, name, gravity, size, pointSize){
  return new Promise((resolve,reject)=>{
    console.log(`Creating image ${name}`);
    const outputFile = `./content/${name}`;
    

    let gmFile = gm()
    .out('-size', size)//half '800x1080'
    .out('-gravity', gravity)
    .out('-background', 'transparent')
    .out('-fill', 'white')
    .out('-kerning', '-1')
    .out(`caption:${text}`);

    gmFile = gmFile.out('-pointsize', 'X11');

    gmFile.write(outputFile, error =>{
      if (error) return reject(error);

      resolve();
    })
  });
}


module.exports = robot