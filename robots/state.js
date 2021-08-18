const fs = require('fs');
const contentFilePath = "./content.json";
const scriptFilePath = './content/after-effects-script.js'

function save(content){
  const contentString = JSON.stringify(content);
  fsSaved = fs.writeFileSync(contentFilePath, contentString);
  console.log("content saved");
  return fsSaved;
}

function saveScript(content) {
  const contentString = JSON.stringify(content)
  const scriptString = `var content = ${contentString}`
  return fs.writeFileSync(scriptFilePath, scriptString)
}

function load(){
  const fileBuffer = fs.readFileSync(contentFilePath, 'utf-8');
  const contentJson = JSON.parse(fileBuffer);
  return contentJson;
}

module.exports = {
  save, load, saveScript
}