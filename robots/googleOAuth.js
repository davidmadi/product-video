const express = require('express')
const google = require('googleapis').google
const youtube = google.youtube({ version: 'v3'})
const OAuth2 = google.auth.OAuth2
const state = require('./state.js')
const fs = require('fs')

async function robot() {
  console.log('> [google-api] Starting...')
  const content = state.load()

  await authenticateWithOAuth()

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

    function requestUserConsent(OAuthClient) {
      const consentUrl = OAuthClient.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/youtube', "https://www.googleapis.com/auth/cloud-platform"]
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

}

module.exports = robot
