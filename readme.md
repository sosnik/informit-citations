# informit.citations
This is a very messy citation exporter for Informit.org.
For some strange reason, despite being run by an Australian university, informit does not support exporting AGLC-compliant citations.

# Usage

1. Start with a list of Informit DOIs - perhaps you were saving articles while doing your research
2. Run `injest.js` to build the API call. `injest.js` expects a `good.links` file with a list of the DOIs you want to export. You can use other tools (awk/sed) to build the request. 
3. Retrieve an API response from the URL generated by the previous step with, e.g. `weget -O results.json <url>` 
4. Run `index.js` - this will parse the information in `results.json` and output a 95% AGLC4-complaint list of references in markdown format. 
5. Run `index.js bib` to format the reference list as an AGLC bibliography by reversing the first and last names of the first-listed author and removing the full stop at the end of references.
6. *Optional:* convert Markdown to Word Doc with: `[pandoc](https://pandoc.org/) -s --ascii -o aglc.doc aglc.md`

**Caution**: manual review is required. This script tries to comply with AGLC4, but I cannot guarantee perfect coverage. Sometimes there are AGLC4 edgecases which I have not considered (such as journal articles spanning multiple years) and sometimes there are deficiencies in the API response, such as missing delimiters in `container-title` or missing keys.

# Methodology
## Old Method
The old method relied on scraping the HTML from the Informit website to build citation information and save it in a JSON dictionary. A second script would then convert the dictionary into Markdown. The markdown could be converted to doc/rtf with `pandoc`.

## Update 2022-01-09
The web scraping method produces inconsistent results. Some pages just do not render the tags I rely upon for citation information.
Fortunately, Informit exposes an API which they themselves use to export citations. It supports batch jobs, too! 

The URL takes the form of:

```
https://data.informit.org/action/exportCiteProcCitation?dois=DOI_LIST_HERE&targetFile=custom-refWorks&format=text
```

The DOI list is comma-separated and must include the Informit prefix `10.3316/`.

The workflow is to:

 1. Get the DOIs of the files we want to cite with, say, `ls -1 /path/to/saved/articles > good.links` (assuming files were downloaded in the first place and filenames weren't changed)
 2. Build the API call - note that local filenames won't have the `10.3316` prefix
 3. Fire the call and retrieve the JSON - at the moment this needs to be done in `wget` as `got` does not handle all the redirects and cookies that the API requires.
 4. Process the JSON citations and write them to Markdown
    1. Bonus: write separate bibliography and footnote files
    2. Bonus: `process.exec` pandoc conversion

### API Response Spec

The API returns a JSON response. Two top-level keys are of relevance:

 * `items`, which is an array of citation objects; and
 * `exportedDoiLength` which is self-explanatory and may be redundant if you just use `items.length`.

A citation object looks like:

```JSON
{
	"<doi>": {
		// "<citation-key>:<citation:value>
		// ...
	}
}
```

Citation fields vary between articles. These are the most relevant:

 * `author`, which is an array of author objects, each containing a `family` and `given` key, like:

```JSON
"author": [
  {
    "family": "COOPER",
    "given": "RE"
  }
]
```

 * `issued.date-parts[0]` - the year the article was published. The date is presented as an array, so just look at the first element
 * `container-title` this can be ambiguous: it contains either the name of the journal only (if separate keys exist for `volume`, `issue` and/or `page`), or journal name + volume and issue + page range
 * `volume`, `issue` and `title`- are self explanatory.
 * `page` is the page-range for the article, where the start and end pages are separated by a dodgy unicode en dash or hyphen.

# one-liners
## Download a file straight from the abstract page:
In the browser console: 

```JavaScript
let source = window.location.href; let parsed = source.split('/'); parsed.splice(4, 0, "pdf"); let dest = parsed.join('/'); dest += '?download=true'; location.replace(dest)
```

# License
Code licensed Apache 2. Documentation licensed CC-BY-SA.

This project uses `node.js`, `got` and `lodash`. 

# Known issues/improvements

 * Building the API call and retrieving the API response currently requires two separate steps/scripts. While the API does not require credentials, it nevertheless sets and checks for certain cookies and headers that `got` does not handle by default. I don't have the time to look into it for now, so just use `wget`. 
 * I'm not using async code 100% effectively
