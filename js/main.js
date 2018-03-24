/* By Jessica Kane, UW-Madison, 2018 */

//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap(){
    
    //map frame dimensions
    var width = 960,
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
        
        //add states to map
        var states = map.selectAll(".states")
            .data(statesSpatial)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "states " + d.properties.adm1_code;
            })
            .attr("d", path);
    };
};