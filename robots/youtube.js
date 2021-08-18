const express = require('express')
const google = require('googleapis').google
const youtube = google.youtube({ version: 'v3'})
const OAuth2 = google.auth.OAuth2
const state = require('./state.js')
const fs = require('fs')

async function robot() {
  console.log('> [youtube-robot] Starting...')
  const content = state.load()

  await authenticateWithOAuth()
  const videoInformation = await uploadVideo(content)
  await uploadThumbnail(videoInformation)

  async function authenticateWithOAuth() {
    let channelAuthorization = await loadCachedYoutubeAuthorization();
    const OAuthClient = await createOAuthClient();
    if (!channelAuthorization){
      const webServer = await startWebServer()
      requestUserConsent(OAuthClient)
      const authorizationToken = await waitForGoogleCallback(webServer);
      channelAuthorization = await fetchRenewToken(authorizationToken);
      await writeAuthFile(channelAuthorization);
      await stopWebServer(webServer)
    }
    await fetchNewFreshToken(OAuthClient, channelAuthorization);
    //await requestGoogleForAccessTokens(OAuthClient, authorizationToken)
    await requestGoogleForAccess(OAuthClient);
    await setGlobalGoogleAuthentication(OAuthClient)

    async function requestGoogleForAccess(OAuthClient){
      await OAuthClient.getAccessToken();
    }

    function fetchNewFreshToken(OAuthClient, channelAuthorization){
      return new Promise(async (resolve,reject)=>{
        OAuthClient.credentials.refresh_token = channelAuthorization.refresh_token;  
        const authorizationToken = await OAuthClient.getRequestHeaders();
        resolve(authorizationToken);
      });
    }

    function fetchRenewToken(authorizationToken){
      return new Promise(async (resolve,reject)=>{
        const access = await OAuthClient.getToken(authorizationToken);//get access token
        if (access && access.tokens && access.tokens.refresh_token)
          return resolve(access.tokens);
        reject("Usuario nao permitiu acesso ao canal do youtube.")
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

    function writeAuthFile(authorizationResult){
      return new Promise((resolve,reject)=>{
        const jsonAuth = JSON.stringify(authorizationResult);
        fs.writeFile('./credentials/youtube-authorization.json', jsonAuth, function (err) {
          if (err) return reject(console.log(err));
          resolve();
        });
      });
    }

    async function startWebServer() {
      return new Promise((resolve, reject) => {
        const port = 5000
        const app = express()

        const server = app.listen(port, () => {
          console.log(`> [youtube-robot] Listening on http://localhost:${port}`)

          resolve({
            app,
            server
          })
        })
      })
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

    //{"authorizationToken":"4/0AX4XfWgpPdSkcYA9nj7Dz25MEMU4txNYFZ2XEYt5z4z_yld8ABmIhph7db8Rpwc_nmrYNw"}
    //{"authorizationToken":"4/0AX4XfWhzAiIyWJQuDfrkNqgxxaPMO3LaLVE2Vj5KqZAgG0tBOr-_wRaSjiGVIFxiOhj4Jg"}

    function requestUserConsent(OAuthClient) {
      const consentUrl = OAuthClient.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/youtube']
      })

      console.log(`> [youtube-robot] Please give your consent: ${consentUrl}`)
    }

    async function waitForGoogleCallback(webServer) {
      return new Promise((resolve, reject) => {
        console.log('> [youtube-robot] Waiting for user consent...')

        webServer.app.get('/oauth2callback', (req, res) => {
          const authCode = req.query.code
          console.log(`> [youtube-robot] Consent given: ${authCode}`)

          res.send('<h1>Thank you!</h1><p>Now close this tab.</p>')
          resolve(authCode)
        })
      })
    }

    async function requestGoogleForAccessTokens(OAuthClient, authorizationToken) {
      return new Promise((resolve, reject) => {
        OAuthClient.getToken(authorizationToken, (error, tokens) => {
          if (error) {
            return reject(error)
          }

          console.log('> [youtube-robot] Access tokens received!')

          OAuthClient.setCredentials(tokens)
          resolve()
        })
      })
    }

    function setGlobalGoogleAuthentication(OAuthClient) {
      google.options({
        auth: OAuthClient
      })
    }

    async function stopWebServer(webServer) {
      return new Promise((resolve, reject) => {
        webServer.server.close(() => {
          resolve()
        })
      })
    }
  }

  async function uploadVideo(content) {
    console.log('> uploading /content/output.mov');
    const videoFilePath = './content/output.mov'
    const videoFileSize = fs.statSync(videoFilePath).size
    const videoTitle = `${content.prefix} ${content.searchTerm}`
    const videoTags = [content.searchTerm, ...content.sentences[0].keywords]
    const videoDescription = content.sentences.map((sentence) => {
      return sentence.text
    }).join('\n\n')

    const requestParameters = {
      part: 'snippet, status',
      requestBody: {
        snippet: {
          title: videoTitle,
          description: videoDescription,
          tags: videoTags
        },
        status: {
          privacyStatus: 'unlisted'
        }
      },
      media: {
        body: fs.createReadStream(videoFilePath)
      }
    }

    console.log('> [youtube-robot] Starting to upload the video to YouTube')
    const youtubeResponse = await youtube.videos.insert(requestParameters, {
      onUploadProgress: onUploadProgress
    })

    console.log(`> [youtube-robot] Video available at: https://youtu.be/${youtubeResponse.data.id}`)
    return youtubeResponse.data

    function onUploadProgress(event) {
      const progress = Math.round( (event.bytesRead / videoFileSize) * 100 )
      console.log(`> [youtube-robot] ${progress}% completed`)
    }

  }

  async function uploadThumbnail(videoInformation) {
    const videoId = videoInformation.id
    const videoThumbnailFilePath = './content/youtube-thumbnail.jpg'

    const requestParameters = {
      videoId: videoId,
      media: {
        mimeType: 'image/jpeg',
        body: fs.createReadStream(videoThumbnailFilePath)
      }
    }

    console.log(`> [youtube-robot] Uploading Thumbnail...`)
    const youtubeResponse = youtube.thumbnails.set(requestParameters)
    console.log(`> [youtube-robot] Thumbnail uploaded!`)
  }


}

module.exports = robot
