const google = require('googleapis').google
const OAuth2 = google.auth.OAuth2
// Import other required libraries
const fs = require('fs');
const util = require('util');
var axios = require("axios");

const state = require('./state.js')
const junctions = ["and", "with", "also", "including"];
let OAuthClient = null;

async function robot() {
  console.log('> [text to speech] Starting...')
  const content = state.load();

  //await createProductSpeechAudio();
  //convertDescriptionToSpeech(content);
  let channelAuthorization = await loadCachedYoutubeAuthorization();
  OAuthClient = await createOAuthClient();
  await fetchNewFreshToken(OAuthClient, channelAuthorization);
  
  await createAllSpeechAudio(content);

  state.save(content);
}

async function createProductSpeechAudio(product, index){
  return new Promise(async (resolve,reject)=>{
    console.log(`Getting speech ${index}-featureSpeech.mp3`);
    const accessToken  = await OAuthClient.getAccessToken();

    // The text to synthesize
    const text = product.templateStructure.featureSpeech;
    const data = {
      "audioConfig": {
        "audioEncoding": "LINEAR16",
        "effectsProfileId": [
          "headphone-class-device"
        ],
        "pitch": -9.0,
        "speakingRate": 1
      },
      "input": {
        "text": text
      },
      "voice": {
        "languageCode": "en-US",
        "name": "en-US-Wavenet-D"
      }
    };


    var config = {
      method: 'post',
      url: 'https://texttospeech.googleapis.com/v1/text:synthesize',
      headers: { 
        'Content-Type': 'application/json; charset=utf-8', 
        'Authorization': `Bearer ${accessToken.token}`
      },
      data : data
    };

    axios(config)
    .then( (response)=> {
      fs.writeFile(`./content/${index}-featureSpeech.mp3`, response.data.audioContent, 'base64', (err) => {
        resolve();
      });
    })
    .catch( (error)=> {
      console.log(error);
      reject(error);
    });
    //const writeFile = util.promisify(fs.writeFile);
    //await writeFile('./content/0-speech.mp3', response.audioContent, 'binary');
  });

}

async function createAllSpeechAudio(content){
  for(var i = 0; i < content.products.length;i++){
    var product = content.products[i];
    await createProductSpeechAudio(product, i);
  }
}

function convertDescriptionToSpeech(content){
  let junctionIndex = 0;
  let junction = "";
  for(var product of content.products){
    let wholeSpeech = "";
    let speech = product.templateStructure.extraFeatures;
    if (!speech.length) speech = product.templateStructure.importantFeatures;
    for(var feature of speech){
      wholeSpeech += " " + junction + " " + feature;
      junction = junctions[junctionIndex++];
      if (junctionIndex > junctions.length-1){
         junctionIndex = 0;
         junction = junctions[junctionIndex++];
        }
    }
    product.templateStructure.featureSpeech = wholeSpeech.trim();
  }
}

async function createOAuthClient() {
  const credentials = require('../credentials/google-youtube.json')
  const OAuthClient = new OAuth2(
    credentials.web.client_id,
    credentials.web.client_secret,
    credentials.web.redirect_uris[0]
  );
  return OAuthClient
}

function fetchNewFreshToken(OAuthClient, channelAuthorization){
  return new Promise(async (resolve,reject)=>{
    OAuthClient.credentials.refresh_token = channelAuthorization.refresh_token;  
    const authorizationToken = await OAuthClient.getRequestHeaders();
    resolve(authorizationToken);
  });
}

function loadCachedYoutubeAuthorization(){
  return new Promise((resolve)=>{
    fs.readFile('./credentials/youtube-authorization.json', 'utf-8', (err, data)=>{
      if (err){
        return resolve(false);
      }
      else{
        resolve(JSON.parse(data));
      }
    });
  });
}

module.exports = robot
