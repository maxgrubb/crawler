var express = require('express');
var async = require('async');
var exphbs = require('express-handlebars');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var server = require('http').createServer(app);
var request = require('request');
var events = require('events').EventEmitter.prototype._maxListeners = 100;
var cheerio = require('cheerio');


var app	= express();

var dataHolder = {};
dataHolder.nodes = []; 
dataHolder.links = [];
var searchDS; 
var startUrl;
var SEARCH_WORD;
var searchType;
var MAX_PAGES;
var pagesVisited = 0;
var numLinksFound = 0;
var totalLinksFound = 0;
var nodeToLink;


app.engine('handlebars', exphbs({defaultLayout: 'main'}));
app.set('view engine', 'handlebars')
app.use(express.static(__dirname + '/public'));

// Adding the express framework
app.use( bodyParser.json()); 
app.use(bodyParser.urlencoded({ extended: true}));
app.use(cookieParser());



// Routes
app.get('/', function(req, res) {
	res.render('home', {
		title : 'Start Crawling'
	});
});


app.get('/ck', function(req, res){


	var list = {},

	/*internal listing of cookies -- to console.log*/

	rc = req.headers.cookie;

	rc && rc.split(';').forEach(function( cookie ) {
	        var parts = cookie.split('=');
	        list[parts.shift().trim()] = decodeURI(parts.join('='));
	    });


	 console.log("Cookies: ", list);

	console.log(JSON.stringify(res.cookie));
	 res.writeHead(200, {
	    'Set-Cookie': 'mycookie=test',
	    'Content-Type': 'text/plain'
	  });
	  res.end('Hello World\n');

});

app.post('/crawl', function(req, res) {
	 startUrl = req.body.starturl;
	 SEARCH_WORD = req.body.keywords;
	 searchType = req.body.searchType;
	 MAX_PAGES = req.body.depth;

	//  res.end('Hello World\n');

	if(searchType == 'BFS'){
		searchDS = new Queue();
		//var startUrl = "http://web.engr.oregonstate.edu/~grubbm/search.html";
		//var MAX_PAGES = 100;
		//var pagesVisited = 0;

		searchDS.Enqueue(startUrl);
		lambdaCrawlerBFS(); 
	}
	else if(searchType == 'DFS'){

		searchDS = []; 
		searchDS.push(startUrl); 
		lambdaCrawlerDFS(res); 
	}

	res.render('graph', {
			title : 'Graph',
			jsonData : JSON.stringify(dataHolder)
	});
	console.log(dataHolder);
	pagesVisited = 0; 
	dataHolder.nodes = []; 
	dataHolder.links = [];
	totalLinksFound = 0;

});


app.get('/about', function(req, res) {
	res.render('about');
});

app.get('/graph', function(req, res) {
	res.render('graph', {
		title : 'Graph',
		jsonData : JSON.stringify(require('./public/graph-json/fakeSiteData.json'))
	});
});


// Start the server
app.listen(3003, function() {
	console.log('Server running at http://127.0.0.1:3003/');
});


function Queue(){
	var count = 0;
	var head = null;
	var tail = null;

	this.GetCount = function(){
    	return count;
	}



	this.Enqueue = function (data) {
		var node = {
	    	data: data,
	    	next: head
		};

		if (head === null) {
	    	tail = node;
		}

		head = node;

		count++;
	}


	this.Dequeue = function () {
		if (count === 0) {
	    	return;
		}
		else {
	    	var dq = tail.data;
	    	var current = head;
	    	var previous = null;

	    	while (current.next) {
	        	previous = current;
	        	current = current.next;
	    	}

	    	if (count > 1) {
	        	previous.next = null;

	        	tail = previous;
	    	}
	    	else {
	        	head = null;
	        	tail = null;
	    	}

	    	count--;
		}
	    	return dq;
	}

}

function searchForWord($, word) {
  var bodyText = $('html > body').text();
  if(bodyText.toLowerCase().indexOf(word.toLowerCase()) !== -1) {
    return true;
  }
  return false;
}


function lambdaCrawlerBFS() {
	
	var nextPageBFS = searchDS.Dequeue();

	if(pagesVisited >= MAX_PAGES){	
        console.log("Crawl Complete");
		//res.send(dataHolder);
		return;
	}
	else{
        // Add the current page to the dataHolder
		siteInfo = {};
	    siteInfo.URL = nextPageBFS;
	    siteInfo.depth = pagesVisited;
	    dataHolder.nodes.push(siteInfo);

	    // Collect the links
		visitPageBFS(nextPageBFS, lambdaCrawlerBFS);

		// Add all found links to dataHolder
		buildJsonBFS();
    }
}

function visitPageBFS(url, callback){


	pagesVisited++;

	console.log("Current page " + url);
	dataHolder.nodes.push(url); 
  	request(url,  function(error, response, body) {

	 	console.log("Status code: " + response.statusCode);
	 	if(response.statusCode !== 200) {
		   	//callback(res);
		   	return;
	 	}

	 	var $ = cheerio.load(body.toLowerCase());
		var isWordFound = searchForWord($, SEARCH_WORD);

		if(isWordFound) {
	    	console.log('Crawler found ' + SEARCH_WORD + ' at page ' + url);
			dataHolder.nodes.push('Crawler found ' + SEARCH_WORD + ' at page ' + url);
			//res.send(dataHolder);

		} 
		else{ 
			collectInternalLinksBFS($);
	   		//callback(res);
		}
	
    });
}

function collectInternalLinksBFS($) {

    var absoluteLinksBFS = $("a[href^='http']");
    numLinksFound = 0;
    absoluteLinksBFS.each(function() {
	    searchDS.Enqueue($(this).attr('href'));
	    numLinksFound++;
	    totalLinksFound++;
    });
    console.log("size of gQ: " + searchDS.GetCount());
}


function lambdaCrawlerDFS() {

    var nextPageDFS = searchDS.pop();

    if(pagesVisited >= MAX_PAGES){

        console.log("Crawl Complete");
		//res.send(dataHolder);


        return;
	}
	else{
    	// Add the current page to the data holder.
    	siteInfo = {};
	    siteInfo.URL = nextPageDFS;
	    siteInfo.depth = pagesVisited;
	    dataHolder.nodes.push(siteInfo);

	    // Get the links on page
        visitPageDFS(nextPageDFS, lambdaCrawlerDFS);

        // Add links found on page and connections
        buildJsonDFS();
    }
}

function visitPageDFS(url, callback){


	pagesVisited++;

	console.log("Current page " + url);
	request(url, function(error, response, body) {

	 	console.log("Status code: " + response.statusCode);

	 	if(response.statusCode !== 200) {
		   	//callback(res);
		   	return;
	 	}

	 	var $ = cheerio.load(body.toLowerCase());
		var isWordFound = searchForWord($, SEARCH_WORD);

		if(isWordFound) {
	 		console.log('Crawler found ' + SEARCH_WORD + ' at page ' + url);
			dataHolder.nodes.push('Crawler found ' + SEARCH_WORD + ' at page ' + url);
			//res.send(dataHolder.nodes);
		} 
		else{ 
			collectInternalLinksDFS($);
		   	//callback(res);
		}
	
    });
}

function collectInternalLinksDFS($) {

    var absoluteLinksDFS = $("a[href^='http']");
    numLinksFound = 0;
    absoluteLinksDFS.each(function() {
	    searchDS.push($(this).attr('href'));
	    numLinksFound++;
	    totalLinksFound++;
	    //pagesToVisit.push($(this).attr('href'));
    });
}


function buildJsonDFS() {
	var curSite;
	var counter = 0;

	// Get all URLS found on current page
	for (i = (searchDS.length - numLinksFound); i < searchDS.length; i++) {
		// Add website and link to dataHolder to each
		counter++;
		siteInfo = {};
		linkInfo = {};
		curSite = searchDS[i];
		siteInfo.URL = curSite;
		siteInfo.depth = pagesVisited;
		dataHolder.nodes.push(siteInfo);

		// Add a link from each url to the current page
		linkInfo.source = pagesVisited;
		linkInfo.target = pagesVisited + counter;
		dataHolder.links.push(linkInfo);
	}

}

function buildJsonBFS() {
	var curSite;
	var counter = 0;
	var currentNode;

	// Add all the newly added links to dataHolder
	for(i = 0; i < numLinksFound; i++) {
		// Vars
		counter++;
		siteInfo = {};
		linkInfo = {};

		// Start at the last added link
		currentNode = searchDS.GetHead();

		// Get the url and add it to the dataHolder
		if(currentNode != null) {
			siteInfo.URL = currentNode.data;
			siteInfo.depth = pagesVisited;
			dataHolder.nodes.push(siteInfo);

			// Add a link from url to current page
			linkInfo.source = pagesVisited;
			linkInfo.target = pagesVisited + counter;
			dataHolder.links.push(linkInfo);

			// Go to next link in queue
			correntNode = currentNode.next;
		}
		
	}


}