const algorithmia = require("algorithmia");
const sentenceBoundaryDetection = require("sbd");
const algorithmiaCredentials = require("../credentials/algorithmia.json")
const watsonCredentials = require('../credentials/watson.json');
const robots = {
  state : require('./state.js')
}

const NaturalLanguageUnderstandingV1 = require('ibm-watson/natural-language-understanding/v1');
const { IamAuthenticator } = require('ibm-watson/auth');

const naturalLanguageUnderstanding = new NaturalLanguageUnderstandingV1({
  version: '2021-03-25',
  authenticator: new IamAuthenticator({
    apikey: watsonCredentials.apiKey,
  }),
  serviceUrl: watsonCredentials.url,
});


async function robot(){
  // //await fetchContentFromWikipedia(content);
  // //sanitizeContent(content);
  // //breakContentIntoSentences(content);
  // //limitMaximumSentences(content);

  const content = robots.state.load();
  await fetchKeywordOfAllProducts(content);
  setVideoParams(content);

  robots.state.save(content);

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
      //videoDescription += breakLine + product.templateStructure.name;
      //breakLine = "\n\n";
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