var axios = require("axios");
var rapidapiAmazon = require('../credentials/rapidapi-amazon.json');

const robots = {
  state : require('./state.js')
}

async function robot(){
  const content = robots.state.load();
  await loadProductsFromAmazon(content);

  robots.state.save(content);
  console.log(content);
}

async function loadProductsFromAmazon(content){
  for(const product of content.products){
    await loadProductFromAPI(product);
  }
}

async function loadProductFromAPI(product){
  return new Promise((resolve,reject)=>{    
    product.storeUrl = `https://www.amazon.ca/dp/${product.id}`;
    var config = {
      method: 'get',
      url: `https://amazon23.p.rapidapi.com/product-details?asin=${product.id}&country=CA`,
      headers: {
        'X-RapidAPI-Key': rapidapiAmazon['x-rapidapi-key'],
        'X-RapidAPI-Host': rapidapiAmazon['x-rapidapi-host'],
      }
    };
    
    axios(config)
    .then(function (response) {
      product.amazonResponse = response.data;
      //console.log(response.data);
      resolve(response.data);
    })
    .catch(function (error) {
      console.log(error);
      reject(error);
    });

  })
}

module.exports = robot;