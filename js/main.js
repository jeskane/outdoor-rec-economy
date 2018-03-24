/* By Jessica Kane, UW-Madison, 2018 */

//First line of main.js...wrap everything in a self-executing anonymous function to move to local scope
(function(){
    
    //pseudo-global variables
    var attrArray = ["perc_partic", "direct_jobs_p100p", "consumer_spend_pp", "wages_salaries_pp", "tax_rev_pp"]; //list of attributes
    var expressed = attrArray[0]; //initial attribute

    //begin script when window loads
    window.onload = setMap();

// -------------------  set up choropleth map  --------------------
    
    function setMap(){
    
        //map frame dimensions
        var width = window.innerWidth * 0.5,
            height = 460;

        //create new svg container for the map
        var map = d3.select("body")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        //create Albers equal area conic projection centered on US
        var projection = d3.geoAlbersUsa()
            //.center([0, 38.6])
            //.rotate([-96, 0, 0])
            //.parallels([43, 34])
            .scale(1000)
            .translate([width / 2, height / 2]);
        /* 
        var projection = d3.geoAlbers()
            .center([1.82, 39.05])
            .rotate([101.00, 0, 0])
            .parallels([43.14, 34.34])
            .scale(957.58)
            .translate([width / 2, height / 2]);
        */
    
        var path = d3.geoPath()
            .projection(projection);
    
        //use queue to parallelize asynchronous data loading
        d3.queue()
            .defer(d3.csv, "data/outdoorRecEcon.csv") //load attributes from csv
            .defer(d3.json, "data/states.topojson") //load choropleth spatial data
            .await(callback);
    
        function callback(error, csvData, statesSpatial){
            //translate TopoJSON
            var statesSpatial = topojson.feature(statesSpatial, statesSpatial.objects.states).features;

            //join csv data to GeoJSON enumeration units
            statesSpatial = joinData(statesSpatial, csvData);
        
            //create the color scale
            var colorScale = makeColorScale(csvData);
            
            //add enumeration units to the map
            setEnumerationUnits(statesSpatial, map, path, colorScale);
            
            //add coordinated visualization to the map
            setChart(csvData, colorScale);
        };
        
    }; // end of setMap()

// -------------------  other functions  --------------------
    
    function joinData(statesSpatial, csvData){
        //loop through csv to assign each set of csv attribute values to geojson state
        for (var i = 0; i < csvData.length; i++){
            var csvState = csvData[i]; //the current state
            var csvKey = csvState.adm1_code; //the CSV primary key

            //loop through geojson states to find correct state
            for (var a = 0; a < statesSpatial.length; a++){

                var geojsonProps = statesSpatial[a].properties; //the current region geojson properties
                var geojsonKey = geojsonProps.adm1_code; //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey){
                    //assign all attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvState[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                };    
            };
        };
        return statesSpatial;
    };
    
    function setEnumerationUnits(statesSpatial, map, path, colorScale){
        //add states to map
        var states = map.selectAll(".states")
            .data(statesSpatial)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "states " + d.properties.adm1_code;
            })
            .attr("d", path)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale);
            });   
    };
    
    //function to create color scale generator
    function makeColorScale(data){
        var colorClasses = [
            "#D4B9DA",
            "#C994C7",
            "#DF65B0",
            "#DD1C77",
            "#980043"
        ];

        //create color scale generator
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i=0; i<data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };

        //cluster data using ckmeans clustering algorithm to create natural breaks
        var clusters = ss.ckmeans(domainArray, 5);
        
        //reset domain array to cluster minimums
        domainArray = clusters.map(function(d){
            return d3.min(d);
        });
        //remove first value from domain array to create class breakpoints
        domainArray.shift();

        //assign array of last 4 cluster minimums as domain
        colorScale.domain(domainArray);

        return colorScale;
    };
    
    //function to test for data value and return color
    function choropleth(props, colorScale){
        //make sure attribute value is a number
        var val = parseFloat(props[expressed]);
        //if attribute value exists, assign a color; otherwise assign gray
        if (typeof val == 'number' && !isNaN(val)){
            return colorScale(val);
        } else {
            return "#CCC";
        };
    };
    
    //function to create coordinated bar chart
    function setChart(csvData, colorScale){
        //chart frame dimensions
        var chartWidth = window.innerWidth * 0.425,
            chartHeight = 473,
            leftPadding = 25,
            rightPadding = 2,
            topBottomPadding = 5,
            chartInnerWidth = chartWidth - leftPadding - rightPadding,
            chartInnerHeight = chartHeight - topBottomPadding * 2,
            translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

        //create a second svg element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");
        
        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
        
        //create a scale to size bars proportionally to frame and for axis
        var yScale = d3.scaleLinear()
            .range([463, 0])
            .domain([0, 1]);
        
        //set bars for each state
        var bars = chart.selectAll(".bars")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b){
                return a[expressed]-b[expressed]
            })
            .attr("class", function(d){
                return "bars " + d.adm1_code;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            .attr("x", function(d, i){
                return i * (chartInnerWidth / csvData.length) + leftPadding;
            })
            .attr("height", function(d, i){
                return 463 - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            .style("fill", function(d){
                return choropleth(d, colorScale)
            });
        
        //below Example 2.8...create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 40)
            .attr("y", 40)
            .attr("class", "chartTitle")
            .text(expressed + " in each state");
        
        //create vertical axis generator
        var yAxis = d3.axisLeft(yScale)
            .scale(yScale);

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        //create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
    };
    
})();