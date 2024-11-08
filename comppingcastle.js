let xmlData=[];
xmlData['A']={};
xmlData['B']={};
scoresOrder=['StaleObjects','PrivilegedAccounts','Trusts','Anomalies'];	// Match the order of HTML reports


function buttonClick() {
	alert("Button clicked");
}

function dragOver(event, w) {
	event.preventDefault();
}

function dropHandler(event, w) {
	// Used when a file is dropped on the area
	event.preventDefault();
	if(event.dataTransfer==null) {
		console.log("No dataTransfer object");
		alert("No file detected. This could be a known bug with older versions of Firefox. Try Chrome");
		return;
	}
	if (event.dataTransfer.items) {
		//console.log("Have dataTransfer.items");
		[...event.dataTransfer.items].forEach((item, i) => {
			if(item.kind=="file") {
				if(item.type=="text/xml") {
					const file = item.getAsFile();
					console.log(`… file[${i}].name = ${file.name}`);
					readPingCastleFile(file, w);
				} else {
					console.log("Not a valid file type "+item.type);
					var oa=document.getElementById('output'+w);
					oa.innerHTML="<strong>Error: File must be a XML file  generated by PingCastle</strong>";
				}
					
			}
			
		});
	} else {
		[...event.dataTransfer.files].forEach((file, i) => {
			console.log("I can't handle files in this way.....");
			console.log(`… file[${i}].name = ${file.name}`);
		});
	}
	
}

function readPingCastleFile(file, w) {
	// Read the content of a file
	//console.log("Reading file");
	//console.log(file);
	reader = new FileReader()
	reader.readAsText(file);
	
	reader.onload = function() {
		//console.log("File read complete");
		//console.log(reader.result);
			
		oa=document.getElementById('output'+w);		// Set the output area
		outstr="";	// Empty output stringify

		parser = new DOMParser();
		xmlDoc = parser.parseFromString(reader.result, "text/xml");
		
		const errorNode = xmlDoc.querySelector("parsererror");
		if (errorNode) {
		  // parsing failed
		  console.log("Parse failed");
		  outstr=errorNode.innerHTML;
		} else {
		  // parsing succeeded
		  //console.log("Parse success");
		
		  // Store in global variable
		  //xmlData[w]=xmlDoc;
		  // Process it
		  outstr=processPingCastle(xmlDoc, w);
		  
			// List top level elements
/* 			topLevel=xmlDoc.documentElement.childNodes;
			for(i=0; i<topLevel.length; i++) {
				console.log(topLevel[i]);
			}
 */		}
		
		// Display output
		oa.innerHTML=outstr;
		
		// Do we enable the compare report button?
		if(Object.keys(xmlData['A']).length>0 && Object.keys(xmlData['B']).length>0) {
			var cb=document.getElementById("compButton");
			cb.disabled=false;
		}
			
	}
}

function processPingCastle(xmlDoc, w) {
	// Process the result of a ping castle file, returning a string to be displayed in the output area
	
	// Set up global data
	xmlData[w]['scores']={'StaleObjects':0, 'Trusts':0, 'PrivilegedAccounts':0, 'Anomalies':0};
	xmlData[w]['risks']=Array();
	var rd=xmlDoc.getElementsByTagName("GenerationDate")[0].innerHTML;
	ts=Date.parse(rd)
	dobj=new Date(ts);
	dstr=dobj.toDateString();
	xmlData[w]['reportDate']=dstr;
	var shortDate=('0' + dobj.getDate()).slice(-2) + '/'
             + ('0' + (dobj.getMonth()+1)).slice(-2) + '/'
             + dobj.getFullYear();
	xmlData[w]['shortDate']=shortDate;
	console.log("Report date", dstr);
	
	outstr="<p><b>Report date:</b>"+dstr+"</p></br>";

	risks=xmlDoc.documentElement.getElementsByTagName("RiskRules");
	riskRules=risks[0].childNodes;
	
	for(r=0; r<riskRules.length; r++) {
		//console.log("Risk "+r);
		//console.log(riskRules[r]);
		riskElements=riskRules[r].childNodes;
		//console.log(riskElements);
		riskSection={};
		for(s=0; s<riskElements.length; s++) {
			key=riskElements[s].nodeName;
			value=riskElements[s].innerHTML;
			//console.log(key+": "+value);
			riskSection[key]=value;
		}
		xmlData[w]['risks'].push(riskSection);
		cat=riskSection['Category'];
		xmlData[w]['scores'][cat]+=Number(riskSection['Points']);
	}
	//console.log(xmlData[w]);
	
	outstr+=scoresToTable(w);
	return outstr;
}

function scoresToTable(w) {
	// Take the global scores and convert them to a table. Also fill in the ultimate score
	outstr="<table class='scoresTable'>";
	outstr+="<tr><th>Category</th><th>Score</th><th>Actual Score</th></tr>";
	maxScore=0;
	//for(const key in xmlData[w]['scores']) {
	for(i=0; i<scoresOrder.length; i++) {
		key=scoresOrder[i];
		v=xmlData[w]['scores'][key];
		if(v>100) {
			s=100;
		} else {
			s=v;
		}
		if(s>maxScore) {
			maxScore=s;
		}
		//console.log(key, s);
		outstr+="<tr><td class='leftCol'>"+key+"</td><td>"+s+" / 100</td><td>"+v+"</td></tr>";
	}
	xmlData[w]["totalScore"]=maxScore;
	outstr+="<tr><td class='leftCol'>Domain risk level</td><td>"+maxScore+"/100</td><td></td></tr>";
		
	
	outstr+="</table>";
	return outstr;
}

function compareReports() {
	// Compare the two reports side by side and report changes
	
	// Have we been called in error?
	if(Object.keys(xmlData['A']).length==0 || Object.keys(xmlData['B']).length==0) {
		console.log("Error: We do not have two reports");
		var cb=document.getElementById("compButton");
		cb.disabled=true;
		return;
	}
	var compOut=document.getElementById("compOutput");
	outstr="";
	
	// Scores
	outstr+="<div class='catHeader'>Scores</div>";
	outstr+="<table class='scoresTable' style='margin-top: 1em'>";
	outstr+="<tr><th>Category</th><th>"+xmlData['A']['shortDate']+" score</th>";
	outstr+="<th>"+xmlData['B']['shortDate']+" score</th><th>Score change</th></td>";
	for(i=0; i<scoresOrder.length; i++) {
		key=scoresOrder[i];
		var A=xmlData['A']['scores'][key];
		var B=xmlData['B']['scores'][key];
		var diff=plusMinus(B-A);
		outstr+=`<tr><td>${key}</td><td>${A}</td><td>${B}</td><td>${diff}</td></tr>`;
	}
	
	var A=xmlData['A']['totalScore'];
	var B=xmlData['B']['totalScore'];
	var diff=plusMinus(B-A);
	outstr+=`<tr><td>Cappped risk change</td><td>${A}</td><td>${B}</td><td>${diff}</td></tr>`

	outstr+="</table>";

	// Sections
	console.log(scoresOrder.length);
	for(var i=0; i<scoresOrder.length; i++) {
		key=scoresOrder[i];
		console.log(key);
		outstr+="<div class='catHeader'>"+key+"</div>";
		
		var aonly="", bonly="", unchanged="", rchanged="";
		
		// Build up lists
		for(var j=0; j<xmlData['A']['risks'].length; j++) {
			risk=xmlData['A']['risks'][j];
			if(risk['Category']==key) {
				//console.log(risk);
				brisk=findRisk(risk['RiskId'], 'B');
				if(brisk===null) {
					// Risk not in B
					//console.log("Risk not in B", risk);
					aonly+=riskLine(risk["Rationale"], plusMinus(risk["Points"]));
				} else {
					// Risk in both, has it changed?
					if(risk["Rationale"]==brisk["Rationale"] && risk["Points"]==brisk["Points"]) {
						// No, add to unchanged list
						unchanged+=riskLine(risk["Rationale"], plusMinus(risk["Points"]));
					} else {
						// Show changes
						var A=risk["Points"];
						var B=brisk["Points"];
						var pchange=plusMinus(B-A);
						rchanged+=riskLine(risk["Rationale"]+" <b>&rarr;</b> "+brisk["Rationale"], pchange);
					}
				}
			}
		}
		
		// Repeat for items in B not in A
		for(j=0; j<xmlData['B']['risks'].length; j++) {
			risk=xmlData['B']['risks'][j];
			if(risk['Category']==key) {
				//console.log(risk);
				arisk=findRisk(risk['RiskId'], 'A');
				if(arisk===null) {
					// Risk not in A
					//console.log("Risk not in A", risk);
					bonly+=riskLine(risk["Rationale"], plusMinus(risk["Points"]));
				}
			}
		}
		
		// Items in A which are not in B
		outstr+="<div class='resultHeader'>Issues resolved</div>";
		outstr+=riskList(aonly);

		// Items in B which are not in A
		outstr+="<div class='resultHeader'>New issues</div>";
		outstr+=riskList(bonly);
		
		// Items in A which are different in B
		outstr+="<div class='resultHeader'>Changed issues</div>";
		outstr+=riskList(rchanged);
		
		// Items in A which are the same in B
		outstr+="<div class='resultHeader'>Unchanged issues</div>";
		outstr+=riskList(unchanged);
	}
	compOut.innerHTML=outstr;
}

function findRisk(rid, w) {
	// Looks for the risk r in the xmlData for w (where w is A or B)
	x=null;
	//console.log("Looking for risk ", rid);
	for(var i=0; i<xmlData[w]['risks'].length; i++) {
		if(xmlData[w]['risks'][i]['RiskId']==rid) {
			x=xmlData[w]['risks'][i];
			break;
		}
	}
	//console.log(x);
	return x;
}

function plusMinus(v) {
	if(typeof(v)=="string") {
		v=Number(v);
	}
	if(v<1) {
		var rtn=String(v);
	} else {
		var rtn="+"+String(v);
	}
	return rtn;
}

function riskLine(rat, points) {
	// Return a risk line ready for formatting
	str="<li><span class='riskInfo'>"+rat+"</span> <span class='riskPoints'>("+points+" points)</span></li>";
	return str;
}

function riskList(l) {
	// Return a HTML risk list from l
	str="<ul class='riskList'>";
	if(l=="") {
		str+="None";
	} else {
		str+=l;
	}
	str+="</ul>";
	return str;
}