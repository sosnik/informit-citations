const fs = require('fs')
let links = fs.readFileSync('./good.links', 'utf-8').split('\n')
let apiCall = `https://data.informit.org/action/exportCiteProcCitation?dois=10.3316/${links.join(',10.3316/')}&targetFile=custom-refWorks&format=text`
console.log(apiCall)