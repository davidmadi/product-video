const express = require('express')
const google = require('googleapis').google
const youtube = google.youtube({ version: 'v3'})
const OAuth2 = google.auth.OAuth2
const state = require('./state.js')
const fs = require('fs')

async function robot() {
  console.log('> [youtube-robot] Starting...')
  const content = state.load()

  await refreshOAuthToken()
  const videoInformation = await uploadVideo(content)
  await uploadThumbnail(videoInformation)

  async function refreshOAuthToken() {
    let channelAuthorization = await loadCachedYoutubeAuthorization();
    const OAuthClient = await createOAuthClient();
    await fetchNewFreshToken(OAuthClient, channelAuthorization);
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

    async function createOAuthClient() {
      const credentials = require('../credentials/google-youtube.json')
      const OAuthClient = new OAuth2(
        credentials.web.client_id,
        credentials.web.client_secret,
        credentials.web.redirect_uris[0]
      );
      return OAuthClient
    }

    function setGlobalGoogleAuthentication(OAuthClient) {
      google.options({
        auth: OAuthClient
      })
    }
  }

  async function uploadVideo(content) {
    console.log('> uploading /content/output.mov');
    const videoFilePath = './content/output.mov'
    const videoFileSize = fs.statSync(videoFilePath).size
    const requestParameters = {
      part: 'snippet, status',
      requestBody: {
        snippet: {
          title: content.videoTitle,
          description: content.videoDescription,
          tags: content.videoTags
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
