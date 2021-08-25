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
  await fetchKeywordOfAllProducts(content);
  setVideoParams(content);
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
    let firstProductKeywords = content.products[0].templateStructure.keywords;
    for(var firstProductKey of firstProductKeywords){
      for(var splitted of firstProductKey.split(' ')){
        let foundInAll = true;
        for(var i = 1; i < content.products.length; i++){
          let foundInThisProduct = false;
          for(var key of content.products[i].templateStructure.keywords){
            if (key.toLowerCase().indexOf(splitted.toLowerCase()) > -1){
              foundInThisProduct = true;
              break;
            }
          }
          if (!foundInThisProduct){
            foundInAll = false;
            break;
          }
        }
        if (foundInAll)
          sameKeyWords.push(splitted);
      }
    }
    return sameKeyWords;
  }

  function setVideoParams(content){
    content.videoTitle = `${content.searchTerm} on Amazon`
    content.videoTags = content.searchTerm.split(' ');
    content.videoDescription = content.products.map((p)=> 
      p.templateStructure.name + "\n" + p.templateStructure.storeUrl ).join("\n\n");
    var breakLine = "";
    var tagCount = 0;
    for(var product of content.products){
      const eightFirst = product.templateStructure.keywords.slice(0, 8);
      for(var keyword of eightFirst){
        for(var splitted of keyword.split(' ')){
          tagCount += splitted.length;
          if (tagCount > 500) break;
          content.videoTags.push(splitted);
        }
      }
    }

  }

  async function fetchContentFromWikipedia(content){
    const algorithmiaAuthenticated = algorithmia.client(algorithmiaCredentials.apiKey);
    const wikipediaAlgorithm = algorithmiaAuthenticated.algo("web/WikipediaParser/0.1.2?timeout=300"); // timeout is optional
    const input = `{ "search": ${content.searchTerm} "lang": "en" };`
    let wikipediaResponse = await wikipediaAlgorithm.pipe(input);
    let wikipediaContent = wikipediaResponse.get();
    content.sourceContentOriginal = wikipediaContent.content;
  }

  function limitMaximumSentences(content){
    content.sentences = content.sentences.slice(0, content.maximumSentences);
  }

  function sanitizeContent(content){
    const cleanedLines = removeBlankLinesAndMarkDowns(content.sourceContentOriginal);
    content.sourceContentSanitized = cleanedLines.join(' ');

    function removeBlankLinesAndMarkDowns(text){
      const allLines = text.split("\n");
      const withoutBlankLines = allLines.filter((line)=>{
        if (line.trim().length === 0 || line.trim().startsWith("=")){
          return false;
        }
        return true;
      })
      return withoutBlankLines;
    }
  }

  function breakContentIntoSentences(content){
    content.sentences = [];
    const sentences = sentenceBoundaryDetection.sentences(content.sourceContentSanitized);
    sentences.forEach((sentence)=>{
      content.sentences.push({
        text: sentence,
        keywords:[],
        images:[]
      })
    })
  }

  async function fetchKeywordOfAllProducts(content){
    for(const product of content.products){
      if (product.amazonResponse.result.length > 0){
        const result = product.amazonResponse.result[0];
        product.templateStructure.name = result.title;
        console.log("Finding keywords for product " + product.id)
        product.templateStructure.keywords = await fetchNLASentenceKeyWords(result.title);
        for(const feature of result.feature_bullets){
          const keywords = await fetchNLASentenceKeyWords(feature);
          product.templateStructure.keywords = product.templateStructure.keywords.concat(keywords);
        }
      }
    }
  }

  function fetchNLASentenceKeyWords(sentence){
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
          if (k.relevance > 0.3)
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