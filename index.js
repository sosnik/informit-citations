const _ = require('lodash')
const got = require('got')
const fs = require('fs/promises')
/* disabled: use injest.js instead
let links = fs.readFileSync('./good.links', 'utf-8').split('\n')
let apiCall = `https://data.informit.org/action/exportCiteProcCitation?dois=10.3316/${links.join(',10.3316/')}&targetFile=custom-refWorks&format=text`
*/ 

// Bibliography mode toggle
const BIBLIOGRAPHY = (process.argv.length >= 3 && process.argv[2] == "bib" ) ? true : false

// API fetcher - currently not working
const ua = {
	headers: {
		'User-Agent': 'AGLC Citation Builder v0.0.1 (since I can\'t export AGLC from web ui)'
	}
}

async function fetch(url) {
	try {
		let result = await got(url, ua)
		console.log(result)
		// Sanity check 
		if (result.exportedDoiLength != links.length)
			throw new Error(`Requested ${links.length} citations, but received ${result.exportedDoiLength}`)
		return result.items
	} catch (e) {
		console.error('Error encountered retrieving citations from API\n', e)
	}
}

async function toAGLC(citation) {
	let authors, title, pubinfo, year, volume, issue, journal, startPage
	
	title = citation.title
	year = citation.issued["date-parts"][0]

	// author formatting - AGLC requires different handling depending on 1, 2, and 3+ authors
	switch (citation.author.length) {
		case 1:
			// Reverse first and last name if using bibliography mode
			authors = BIBLIOGRAPHY ? `${_.capitalize(citation.author[0].family)}, ${citation.author[0].given}` : `${citation.author[0].given} ${_.capitalize(citation.author[0].family)}`
			break;
		case 2:
			// Reverse first and last name if using bibliography mode
			authors = BIBLIOGRAPHY ? `${_.capitalize(citation.author[0].family)}, ${citation.author[0].given} and ${citation.author[1].given} ${_.capitalize(citation.author[1].family)}` : `${citation.author[0].given} ${_.capitalize(citation.author[0].family)} and ${citation.author[1].given} ${_.capitalize(citation.author[1].family)}`
			break;
		default: // 3 or more authors
			citation.authors.foreach((e, i) => {
				// last author is separated by `and` 
				if (i == (citation.author.length-1)) {
					authors += `and ${e.given} ${_.capitalize(e.family)}`
				// first author needs no prefix
				} else if (e == 0) {
					// Reverse first and last name if using bibliography mode
					authors = BIBLIOGRAPHY ? `${_.capitalize(e.family)}, ${e.given}` : `${e.given} ${_.capitalize(e.family)}`
				// all intermediate authors are separated by `,` 
				} else {
					authors += `, ${e.given} ${_.capitalize(e.family)}`
				}
			})
			break;
	}

	// Publication Info 
	// This is where it gets complicated. Publication consists of a year, volume and issue number. Normally the year is enclosed in round brackets, but if there is no volume number, then it is encased in square brackets.
	// The year is its own independent key, but the journal name, volume, issue and page range can be independent or all stored in the container-title key.
	// if the container-title includes the full publication information, then it will contain 4 comma-separated sections:
	//  - Journal name
	//  - volume?
	//  - issue?
	//  - date and page range
	// volume/issue might be prefixed with vol. or v. etc. The date and pages will be separated by a ': '
	// Methodology: try to look up defined keys, fall back to parsing container-title with regex, and lastly fall back to undefined

	let containerTitle = citation["container-title"]
	journal = _.capitalize(containerTitle.split(',')[0])
	volume = citation.volume || _.last(containerTitle.match(/(V|v)(ol)*\. *(\d+)/)) || undefined
	issue = citation.issue || _.last(containerTitle.match(/(N|n)(o)*\. *(\d+)/)) || undefined
	let pageRange = citation.page || _.last(containerTitle.split(": "))
	startPage = _.first(pageRange.match(/\d+/)) || undefined

	// Now that we have gathered all the citation information we are likely to get, let's build the year-volume-issue string
	if (volume == undefined ) {
		pubinfo = `[${year}] (${issue})`
	} else {
		pubinfo = `(${year}) ${volume}(${issue})`
	}
	// Report an error if we are missing some critical fields
	if (!authors || !year || !issue || !pageRange )
		console.error(`\x1b[33mFormatting Error: the following citation may be mangled or missing parts:\x1b[0m`, citation)

	// Format the final string
	return `${authors}, ‘${title}’ ${pubinfo} *${journal}* ${startPage}`
}

async function start() {
	// Retrieve citations from local file. In the future, this would be retrieved by fetch()
	let citations = JSON.parse(await fs.readFile('results.json', 'utf-8' )) //await fetch(apiCall)
	// The citations are an array of objects, where each object starts with a unique key. This is cumbersome to traverse.
	// Flatten the array with object.assign
	citations = Object.assign({}, ...citations.items)

	let output = []
	// now iterate as normal
	for (doi in citations) {
		output.push(await toAGLC(citations[doi]))
	}
	// Write output to file. Don't use a full stop if running in Bibliography Mode. 
	await fs.writeFile(`aglc${BIBLIOGRAPHY ? '-bib' : ''}.md`, output.join(`${BIBLIOGRAPHY ? '' : '.'}\n\n`), {encoding:'utf-8'})
}

start()
