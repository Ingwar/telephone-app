function tree(nodes) {
  var nodeById = {};

  // Index the nodes by id, in case they come out of order.
  nodes.forEach(function(d) {
  nodeById[d.pk] = d;
  });

  // Lazily compute children.
  nodes.forEach(function(d) {
  if (d.parent) {
    var parent = nodeById[d.parent];
    if (parent.children) parent.children.push(d);
    else parent.children = [d];
  }
  });

  return nodes[0];
}

function playMessage(message) {
  $("audio").attr("src", message.audio);
  $("audio").trigger("play");
}

function navToUploadPage(message) {
  window.location.href = message.upload_url
}

function splitChain(message) {
  $.post(message.sprout_url,
    {csrfmiddlewaretoken: csrf_token},
    function() { window.location.reload(); }
  );
}

function deleteBranch(message) {
  $.post(message.close_url,
    {csrfmiddlewaretoken: csrf_token},
    function() { window.location.reload(); }
  );
}

function createChainTree(chain) {
  var chainName = "chain-" + chain.pk.toString();
  var nestedMessages = tree(chain.messages);

  var maxDepth = d3.max(chain.messages, function (el) { return el.generation; }),
      heightPerGeneration = 200;

  var svgWidth = 600,
      svgHeight = maxDepth * heightPerGeneration;

  var bumpDown = 40;

  treeChart = d3.layout.tree();
  treeChart.size([svgWidth, svgHeight-(2*bumpDown)])
    .children(function(d) { return d.children });

  var linkGenerator = d3.svg.diagonal()
    .projection(function (d) {return [d.x, d.y+bumpDown]})

  // Make an svg element for each chain
  d3.select("div.chains")
    .append("div")
    .attr("class", "jumbotron")
    .append("svg")
    .attr("id", chainName)
    .attr("width", svgWidth)
    .attr("height", svgHeight);

  d3.select("#" + chainName)
    .selectAll("g")
    .data(treeChart(nestedMessages))
    .enter()
    .append("g")
    .attr("class", function(d) {
      var type = d.audio ? "filled" : "empty";
      return "message " + type;
    })
    .attr("transform", function(d) {
      return "translate(" +d.x+","+(d.y+bumpDown)+")"
    });

  d3.selectAll("g.message")
    .append("circle")
    .attr("r", 10);

  var bumpTextsRight = 18,
      bumpTextsDown = -5,
      buttonGutter = 20;

  d3.selectAll("g.message")
    .append("g")
    .attr("transform", function(d) {
      return "translate(" + bumpTextsRight + "," + bumpTextsDown + ")";
    })
    .append("text")
    .text(function(el) { return el.audio ? "play" : "upload"; })
    .attr("class", function(el) { return el.audio ? "play" : "upload"; })
    .on("click", function(el) { return el.audio ? playMessage(el) : navToUploadPage(el); })

  d3.selectAll("g.message")
    .append("g")
    .attr("transform", function(d) {
      return "translate(" + bumpTextsRight + "," + (bumpTextsDown + buttonGutter) + ")";
    })
    .append("text")
    .text(function(el) { return el.audio ? "split" : "close"; })
    .attr("class", function(el) { return el.audio ? "split" : "delete"; })
    .on("click", function(el) { return el.audio ? splitChain(el) : deleteBranch(el); })

  d3.selectAll("text")
    .on("mouseover", function () {
      d3.select(this).classed("active", true);
    })
    .on("mouseout", function () {
      d3.select(this).classed("active", false);
    });

  d3.select("#" + chainName)
    .selectAll("path")
    .data(treeChart.links(treeChart(nestedMessages)))
    .enter().insert("path","g")
    .attr("d", linkGenerator)
    .style("fill", "none")
    .style("stroke", "black")
    .style("stroke-width", "2px");
}

function visualize(messageData) {
  messageData = JSON.parse(messageData);

  messageData.forEach(
    function (chain) {
      createChainTree(chain);
    }
  );

}
