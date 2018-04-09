/* By Jessica Kane, UW-Madison, 2018 */

//Wrap everything in a self-executing anonymous function to move to local scope
(function(){

// ---------------  Pseudo-Global Variables  ---------------    

    var attrArray = ["Percent of Residents Participating in Outdoor Recreation", "Direct Jobs (Per 100 People)", "Consumer Spending (Per Capita)", "Wages Generated (Per Capita)", "State/Local Tax Revenue Generated (Per Capita)"]; //list of attributes
    
    var expressed = attrArray[0]; //initial attribute
    
    //chart frame dimensions
    var chartWidth = 750,
        chartHeight = 460,
        leftPadding = 35,
        rightPadding = 2,
        topBottomPadding = 5,
        chartInnerWidth = chartWidth - leftPadding - rightPadding,
        chartInnerHeight = chartHeight - topBottomPadding * 2,
        translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

    //begin script when window loads
    window.onload = setMap();

// ---------------  Set up Choropleth Map  ---------------
    
    function setMap(){
    
        //map frame dimensions
        var width = 750,
            height = 460;

        //create new svg container for the map
        var mapContainer = d3.select("#container")
            .append("div")
            .attr("id", "map-container");
        
        var map = d3.select("#map-container")
            .append("svg")
            .attr("preserveAspectRatio", "xMinYMin meet")
            .attr("viewBox", "0 0 " + width + " " + height)
            .attr("class", "map");
        
        //Make map responsive to changing screen size
        var mapSelect = $(".map");
        var aspect = mapSelect.width() / mapSelect.height(),
            container = mapSelect.parent();
        $(window).on("resize", function() {
            var targetWidth = container.width();
            mapSelect.attr("width", targetWidth);
            mapSelect.attr("height", Math.round(targetWidth / aspect));
        }).trigger("resize");

        //create Albers equal area conic projection centered on US
        var projection = d3.geoAlbersUsa()
            .scale(1000)
            .translate([width / 2, height / 2]);
    
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
            
            createDropdown(csvData);
        };
        
    }; // end of setMap()

// ---------------  Join Data, Set Enumeration Units  ---------------
    
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
    
    function createDomainArray(data){
        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i=0; i<data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val);
        };
        
        return domainArray;
    };
    
    //Set scale according to data displayed
    function setyScale(csvData){
        var domainArray = createDomainArray(csvData);
        console.log(d3.max(domainArray, function(d){
            return d;
        }));
        var yScale = d3.scaleLinear()
            .domain([0, 1.05 * d3.max(domainArray, function(d){
               return d; 
            })])
            .range([chartHeight, 0])
            .nice();
        
        return yScale;
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
            })
            .on("mouseover", function(d){
                highlight(d.properties);
            })
            .on("mouseout", function(d){
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);
        
        var desc = states.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');
    };

// ---------------  Create Color Scale Generator  ---------------
    
    function makeColorScale(data){
        var colorClasses = [
            "#edf8e9",
            "#bae4b3",
            "#74c476",
            "#31a354",
            "#006d2c"
        ];

        //create color scale generator
        var colorScale = d3.scaleThreshold()
            .range(colorClasses);
        
        var domainArray = createDomainArray(data);
        
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

// ---------------  Create Bar Chart  ---------------

    function setChart(csvData, colorScale){

        //create a second svg element to hold the bar chart
        var chartContainer = d3.select("#container")
            .append("div")
            .attr("id", "chart-container");
        
        var chart = d3.select("#chart-container")
            .append("svg")
            .attr("preserveAspectRatio", "xMinYMin meet")
            .attr("viewBox", "0 0 " + chartWidth + " " + chartHeight)
            .attr("class", "chart");
        
        //Make chart responsive to changing screen size
        var chartSelect = $(".chart");
        var aspect = chartSelect.width() / chartSelect.height(),
            container = chartSelect.parent();
        $(window).on("resize", function() {
            var targetWidth = container.width();
            chartSelect.attr("width", targetWidth);
            chartSelect.attr("height", Math.round(targetWidth / aspect));
        }).trigger("resize");
        
        //create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate);
        
        //set bars for each state
        var bars = chart.selectAll(".bars")
            .data(csvData)
            .enter()
            .append("rect")
            .sort(function(a, b){
                return b[expressed]-a[expressed]
            })
            .attr("class", function(d){
                return "bars " + d.adm1_code;
            })
            .attr("width", chartInnerWidth / csvData.length - 1)
            .on("mouseover", highlight)
            .on("mouseout", dehighlight)
            .on("mousemove", moveLabel);
        
        var desc = bars.append("desc")
            .text('{"stroke": "none", "stroke-width": "0px"}');
        
        //Create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", 70)
            .attr("y", 30)
            .attr("class", "chartTitle")
            .text(expressed);
  
        var yScale = setyScale(csvData);
        
        //create vertical axis generator
        var yAxis = d3.axisLeft(yScale);

        //place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);
        
        //set bar positions, heights, and colors
        updateChart(bars, csvData, colorScale);
    };

// ---------------  User Interactions  ---------------
    
    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData){
        //add select element
        var dropdown = d3.select("#container")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function(){
                changeAttribute(this.value, csvData)
            });

        //add initial option
        var titleOption = dropdown.append("option")
            .attr("class", "titleOption")
            .attr("disabled", "true")
            .text("Explore the Data from 2017");

        //add attribute name options
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){ return d })
            .text(function(d){ return d });
    };
    
    //dropdown change listener handler
    function changeAttribute(attribute, csvData){
        //change the expressed attribute
        expressed = attribute;

        //recreate the color scale
        var colorScale = makeColorScale(csvData);

        //recolor enumeration units
        var states = d3.selectAll(".states")
            .transition()
            .duration(1000)
            .style("fill", function(d){
                return choropleth(d.properties, colorScale)
            });
        
        //re-sort, resize, and recolor bars
        var bars = d3.selectAll(".bars")
            //re-sort bars
            .sort(function(a, b){
                return b[expressed] - a[expressed];
            })
            .transition() //add animation
            .delay(function(d, i){
                return i * 20
            })
            .duration(500);
        
        updateChart(bars, csvData, colorScale);
    };
    
    //function to position, size, and color bars in chart
    function updateChart(bars, csvData, colorScale){
        
        n = csvData.length;
        
        var yScale = setyScale(csvData);
        
        //position bars
        bars.attr("x", function(d, i){
                return i * (chartInnerWidth / n) + leftPadding;
            })
            //size/resize bars
            .attr("height", function(d, i){
                return chartHeight - yScale(parseFloat(d[expressed]));
            })
            .attr("y", function(d, i){
                return yScale(parseFloat(d[expressed])) + topBottomPadding;
            })
            //color/recolor bars
            .style("fill", function(d){
                return choropleth(d, colorScale);
            });
        
        //at the bottom of updateChart()...add text to chart title
        var chartTitle = d3.select(".chartTitle")
            .text(expressed);
        
        //create vertical axis generator
        var yAxis = d3.axisLeft(yScale);
        
        var axis = d3.select(".axis")
            .call(yAxis);
        
    };
    
// ---------------  Highlight/Dehighlight  ---------------
    
    //function to highlight enumeration units and bars
    function highlight(props){
        //change stroke
        var selected = d3.selectAll("." + props.adm1_code)
            .style("stroke", "#02421c")
            .style("stroke-width", "3");
        
        setLabel(props);
    };
    
    //function to reset the element style on mouseout
    function dehighlight(props){
        var selected = d3.selectAll("." + props.adm1_code)
            .style("stroke", function(){
                return getStyle(this, "stroke")
            })
            .style("stroke-width", function(){
                return getStyle(this, "stroke-width")
            });

        function getStyle(element, styleName){
            var styleText = d3.select(element)
                .select("desc")
                .text();

            var styleObject = JSON.parse(styleText);

            return styleObject[styleName];
        };
        
        //Remove info label
        d3.select(".infolabel")
            .remove();
    };
    
// -------------------  Labels  -------------------
    
    //function to create dynamic label
    function setLabel(props){

        if (expressed == attrArray[0]) {
            var labelAttribute = "<h1>" + props[expressed] + "%</h1>" + "Residents Participating in Outdoor Recreation";
        } else if (expressed == attrArray[2] || expressed == attrArray[3] || expressed == attrArray[4]) {
            var formatComma = d3.format(",");
            var labelAttribute = "<h1>$" + formatComma(props[expressed]) + "</h1>" + expressed;
        } else {
            var labelAttribute = "<h1>" + props[expressed] + "</h1>" + expressed;
        };
        
        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.adm1_code + "_label")
            .html(labelAttribute);

        var stateName = infolabel.append("div")
            .attr("class", "labelname")
            .html("<b>" + props.name + "</b>");
    };
    
    //function to move info label with mouse
    function moveLabel(){
        //get width of label
        var labelWidth = d3.select(".infolabel")
            .node()
            .getBoundingClientRect()
            .width;
        
        //use coordinates of mousemove event to set label coordinates
        var x1 = d3.event.clientX + 10,
            y1 = d3.event.clientY - 75,
            x2 = d3.event.clientX - labelWidth - 10,
            y2 = d3.event.clientY +25;
        
        //horizontal label coordinate, testing for overflow
        var x = d3.event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
        //vertical label coordinate, testing for overflow
        var y = d3.event.clientY < 75 ? y2 : y1;

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px");
    };

})();