const readline = require('readline-sync');
const robots = {
  state : require('./state.js')
}

const contentFormat = {
  maximumProducts: 5,
  searchTerm: "Top 5 best Galaxy phones on Amazon",
  videoTags: [],
  videoDescription: "",
  videoTitle: "",
  products :[
    {
      url:"",
      amazonResponse:{},
      id:"",
      templateStructure:{
        name:"",
        storeUrl:"",
        coverImage:"",
        variant1:"",
        variant2:"",
        variant3:"",
        firstDescription:"",
        keywords:[],
        specifications:"",
        images:[]
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
    const searchTerm = readline.question("Please type the searchTerm phrase: ");
    content.searchTerm = searchTerm;
    for(i = 0; i < content.maximumProducts;i++){
      var product = Object.assign({}, contentFormat.products[0]);
      const Id = readline.question("Please paste amazon product ID (ABCDDEFG) format: ");
      product.id = Id;
      product.url = "https://amazon24.p.rapidapi.com/api/product/" + Id;
      content.products.push(product);
    }
  }
}

module.exports = robot