const readline = require('readline-sync');
const robots = {
  state : require('./state.js')
}

const contentFormat = {
  products :[
    {
      url:"",
      amazonResponse:{},
      templateStructure:{
        name:"",
        coverImage:"",
        variant1:"",
        variant2:"",
        variant3:"",
        firstDescription:"",
        keywords:[],
        specifications:""
      }
    }
  ]
};

async function robot(){
  const content = {
    maximumProducts: 5,
    products:[]
  }
  askAndReturnSearchTerm(content);
  robots.state.save(content);

  function askAndReturnSearchTerm(content){
    for(i = 0; i < content.maximumProducts;i++){
      var product = Object.assign({}, contentFormat.products[0]);
      const Id = readline.question("Please paste amazon product ID (ABCDDEFG) format: ");
      product.url = "https://amazon24.p.rapidapi.com/api/product/" + Id;
      content.products.push(product);
    }
  }
}

module.exports = robot