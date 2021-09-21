const algorithmia = require("algorithmia");
const sentenceBoundaryDetection = require("sbd");
const algorithmiaCredentials = require("../credentials/algorithmia.json")
const watsonCredentials = require('../credentials/watson.json');
const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1');
const { IamAuthenticator } = require('ibm-watson/auth');

const naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
  version: '2021-03-25',
  authenticator: new IamAuthenticator({
    apikey: watsonCredentials.apiKey,
  }),
  serviceUrl: watsonCredentials.url,
});
const robots = {
  state : require('./state.js')
}

async function robot(){
  console.log('> [text] Starting...')
  ////await fetchContentFromWikipedia(content);
  ////sanitizeContent(content);
  ////breakContentIntoSentences(content);
  ////limitMaximumSentences(content);

  const content = robots.state.load();
  //await fetchKeywordOfAllProducts(content);
  setVideoParams(content);
  setProductName(content);
  const unionKeywords = getSameKeyWords(content);
  setImportantFeatures(unionKeywords, content);
  //list same keywords of all products
  //list feature bullets that contains merged keywords
  //set important features in template structure
  //image robot, create features image

  robots.state.save(content);

  function setImportantFeatures(unionKeywords, content){
    for(const product of content.products){
      product.templateStructure.importantFeatures = [];
      product.templateStructure.extraFeatures = [];
      for(const bullet of product.amazonResponse.result[0].feature_bullets){
        let foundInKeys = false;
        for(var key of unionKeywords){
          if (bullet.toLowerCase().indexOf(key) > -1){
            product.templateStructure.importantFeatures.push(bullet);
            foundInKeys = true;
            break;
          }
        }
        if (!foundInKeys){
          product.templateStructure.extraFeatures.push(bullet);
        }
      }

    }
  }

  function getSameKeyWords(content){
    const sameKeyWords = [];
    let firstProductKeywords = content.products[0].templateStructure.featureKeywords;
    for(var firstProductKey of firstProductKeywords){
      for(var splitted of firstProductKey.split(' ')){
        let foundInAnyOtherProduct = false;
        for(var i = 1; i < content.products.length; i++){
          for(var key of content.products[i].templateStructure.featureKeywords){
            if (key.toLowerCase().indexOf(splitted.toLowerCase()) > -1){
              foundInAnyOtherProduct = true;
              break;
            }
          }
          if (foundInAnyOtherProduct){
            break;
          }
        }
        if (foundInAnyOtherProduct)
          sameKeyWords.push(splitted);
      }
    }
    return sameKeyWords;
  }

  function setProductName(content){
    for(var product of content.products){
      product.templateStructure.firstDescription = product.amazonResponse.result[0].title;
      product.templateStructure.name = product.amazonResponse.result[0].title.split('-')[0];
      product.templateStructure.name = product.templateStructure.name.split(',')[0].trim();
      product.templateStructure.name = product.templateStructure.name.split('with')[0].trim();
      product.templateStructure.name = product.templateStructure.name.split('and')[0].trim();
    }
  }

  function setVideoParams(content){
    content.videoTitle = `${content.searchTerm} on Amazon`
    let videoTags = content.searchTerm.split(' ');
    let cuttags = [];
    let totalLength = 0;
    for(var tag of videoTags) {
      if (totalLength + tag.length < 500){
        cuttags.push(tag);
        totalLength += tag.length + 1;
      }
    }
    content.videoTags = cuttags;
    content.videoDescription = content.products.map((p)=> 
      p.templateStructure.name + "\n" + p.templateStructure.storeUrl ).join("\n\n");
    var breakLine = "";
    for(var product of content.products){
      const eightFirst = product.templateStructure.featureKeywords.slice(0, 8);
      for(var keyword of eightFirst){
        for(var tag of keyword.split(' ')){
          if (totalLength + tag.length < 500){
            content.videoTags.push(tag);
            totalLength += tag.length + 1;
          }
        }
      }
    }

  }

  async function fetchKeywordOfAllProducts(content){
    for(const product of content.products){
      if (product.amazonResponse.result.length > 0){
        const result = product.amazonResponse.result[0];
        console.log("Finding keywords for product " + product.id)
        product.templateStructure.titleKeywords = await fetchNLASentenceKeyWords(result.title, 0.8);
        product.templateStructure.featureKeywords = [];
        for(const feature of result.feature_bullets){
          const keywords = await fetchNLASentenceKeyWords(feature, 0.8);
          product.templateStructure.featureKeywords = product.templateStructure.featureKeywords.concat(keywords);
        }
      }
    }
  }

  function fetchNLASentenceKeyWords(sentence, minimumRelevance){
    return new Promise(async (resolve, reject) =>{
      const analyzeParams = {
        'text': sentence,
        'features': {
          'keywords': {}
        }
      };
      
      try
      {
        const analysisResults = await naturalLanguageUnderstanding.analyze(analyzeParams);
        const filtered = [];
        analysisResults.result.keywords.forEach((k)=>{
          if (k.relevance > minimumRelevance)
            return filtered.push(k.text);
        })
        resolve(filtered);
      }
      catch(err){
        reject(err)
      }
    });
  }  
}
module.exports = robot;