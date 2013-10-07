
// *************************************************************
//   LiteGraph CLASS                                     *******
// *************************************************************

/**
* The Global Scope. It contains all the registered node classes.
*
* @class LiteGraph
* @constructor
*/

var LiteGraph = {

	NODE_TITLE_HEIGHT: 16,
	NODE_SLOT_HEIGHT: 15,
	NODE_WIDTH: 140,
	NODE_MIN_WIDTH: 50,
	NODE_COLLAPSED_RADIUS: 10,
	CANVAS_GRID_SIZE: 10,
	NODE_DEFAULT_COLOR: "#888",
	NODE_DEFAULT_BGCOLOR: "#333",
	NODE_DEFAULT_BOXCOLOR: "#AEF",
	NODE_DEFAULT_SHAPE: "box",
	MAX_NUMBER_OF_NODES: 1000, //avoid infinite loops
	DEFAULT_POSITION: [100,100],
	node_images_path: "",

	debug: false,
	registered_node_types: {},
	graphs: [],

	/**
	* Register a node class so it can be listed when the user wants to create a new one
	* @method registerNodeType
	* @param {String} type name of the node and path
	* @param {Class} base_class class containing the structure of a node
	*/

	registerNodeType: function(type, base_class)
	{
		var title = type;
		if(base_class.prototype && base_class.prototype.title)
			title = base_class.prototype.title;
		else if(base_class.title)
			title = base_class.title;

		base_class.type = type;
		if(LiteGraph.debug)
			console.log("Node registered: " + type);

		var categories = type.split("/");

		var pos = type.lastIndexOf("/");
		base_class.category = type.substr(0,pos);
		//info.name = name.substr(pos+1,name.length - pos);

		//inheritance
		if(base_class.prototype) //is a class
			for(var i in LGraphNode.prototype)
				if(!base_class.prototype[i])
					base_class.prototype[i] = LGraphNode.prototype[i];

		this.registered_node_types[type] = base_class;
	},

	/**
	* Create a node of a given type with a name. The node is not attached to any graph yet.
	* @method createNode
	* @param {String} type full name of the node class. p.e. "math/sin"
	* @param {String} name a name to distinguish from other nodes
	* @param {Object} options to set options
	*/

	createNode: function(type,name, options)
	{
		var base_class = this.registered_node_types[type];
		if (!base_class)
		{
			if(LiteGraph.debug)
				console.log("GraphNode type \"" + type + "\" not registered.");
			return null;
		}

		var prototype = base_class.prototype || base_class;

		name = name || prototype.title || base_class.title || type;

		var node = null;
		if (base_class.prototype) //is a class
		{
			node = new base_class(name);
		}
		else
		{
			node = new LGraphNode(name);
			node.inputs = [];
			node.outputs = [];

			//add inputs and outputs
			for (var i in prototype)
			{
				if(i == "inputs")
				{
					for(var j in prototype[i])
						node.addInput( prototype[i][j][0],prototype[i][j][1], prototype[i][j][2] );
				}
				else if(i == "outputs")
				{
					for(var j in prototype[i])
						node.addOutput( prototype[i][j][0],prototype[i][j][1], prototype[i][j][2] );
				}
				else
				{
					if( prototype[i].concat ) //array
						node[i] = prototype[i].concat();
					else if (typeof(prototype[i]) == 'object')
						node[i] = jQuery.extend({}, prototype[i]);
					else
						node[i] = prototype[i];
				}
			}
			//set size
			if(base_class.size) node.size = base_class.size.concat(); //save size
		}

		node.type = type;
		if(!node.name) node.name = name;
		if(!node.flags) node.flags = {};
		if(!node.size) node.size = node.computeSize();
		if(!node.pos) node.pos = LiteGraph.DEFAULT_POSITION.concat();

		//extra options
		if(options)
		{
			for(var i in options)
				node[i] = options[i];								
		}

		return node;
	},

	/**
	* Returns a registered node type with a given name
	* @method getNodeType
	* @param {String} type full name of the node class. p.e. "math/sin"
	* @return {Class} the node class
	*/

	getNodeType: function(type)
	{
		return this.registered_node_types[type];
	},


	/**
	* Returns a list of node types matching one category
	* @method getNodeType
	* @param {String} category category name
	* @return {Array} array with all the node classes
	*/

	getNodeTypesInCategory: function(category)
	{
		var r = [];
		for(var i in this.registered_node_types)
			if(category == "")
			{
				if (this.registered_node_types[i].category == null)
					r.push(this.registered_node_types[i]);
			}
			else if (this.registered_node_types[i].category == category)
				r.push(this.registered_node_types[i]);

		return r;
	},

	/**
	* Returns a list with all the node type categories
	* @method getNodeTypesCategories
	* @return {Array} array with all the names of the categories 
	*/

	getNodeTypesCategories: function()
	{
		var categories = {"":1};
		for(var i in this.registered_node_types)
			if(this.registered_node_types[i].category && !this.registered_node_types[i].skip_list)
				categories[ this.registered_node_types[i].category ] = 1;
		var result = [];
		for(var i in categories)
			result.push(i);
		return result;
	},

	//debug purposes: reloads all the js scripts that matches a wilcard
	reloadNodes: function (folder_wildcard)
	{
		var tmp = document.getElementsByTagName("script");
		//weird, this array changes by its own, so we use a copy
		var script_files = [];
		for(var i in tmp)
			script_files.push(tmp[i]);


		var docHeadObj = document.getElementsByTagName("head")[0];
		folder_wildcard = document.location.href + folder_wildcard;

		for(var i in script_files)
		{
			var src = script_files[i].src;
			if( !src || src.substr(0,folder_wildcard.length ) != folder_wildcard)
				continue;

			try
			{
				if(LiteGraph.debug)
					console.log("Reloading: " + src);
				var dynamicScript = document.createElement("script");
				dynamicScript.type = "text/javascript";
				dynamicScript.src = src;
				docHeadObj.appendChild(dynamicScript);
				docHeadObj.removeChild(script_files[i]);
			}
			catch (err)
			{
				if(LiteGraph.throw_errors)
					throw err;
				if(LiteGraph.debug)
					console.log("Error while reloading " + src);
			}
		}

		for (var i in LiteGraph.graphs)
		{
			for (var j in LiteGraph.graphs[i].nodes)
			{
				var m = LiteGraph.graphs[i].nodes[j];
				var t = LiteGraph.getNodeType(n.type);
				if(!t) continue;

				for (var k in t)
					if( typeof(t[k]) == "function" )
						m[k] = t[k];
			}
		}

		if(LiteGraph.debug)
			console.log("Nodes reloaded");
	}

	/*
	benchmark: function(mode)
	{
		mode = mode || "all";

		trace("Benchmarking " + mode + "...");
		trace("  Num. nodes: " + this.nodes.length );
		var links = 0;
		for(var i in this.nodes)
			for(var j in this.nodes[i].outputs)
				if(this.nodes[i].outputs[j].node_id != null)
					links++;
		trace("  Num. links: " + links );
		
		var numTimes = 200;
		if(mode == "core")
			numTimes = 30000;

		var start = new Date().getTime();

		for(var i = 0; i < numTimes; i++)
		{
			if(mode == "render")
				this.draw(false);
			else if(mode == "core")
				this.sendEventToAllNodes("onExecute");
			else
			{
				this.sendEventToAllNodes("onExecute");
				this.draw(false);
			}
		}

		var elapsed = (new Date().getTime()) - start;
		trace("  Time take for  " + numTimes + " iterations: " + (elapsed*0.001).toFixed(3) + " seconds.");
		var seconds_per_iteration = (elapsed*0.001)/numTimes;
		trace("  Time per iteration:  " + seconds_per_iteration.toFixed( seconds_per_iteration < 0.001 ? 6 : 3) + " seconds");
		trace("  Avg FPS: " + (1000/(elapsed/numTimes)).toFixed(3));
	}
	*/
};





//*********************************************************************************
// LGraph CLASS                                  
//*********************************************************************************

/**
* LGraph is the class that contain a full graph. We instantiate one and add nodes to it, and then we can run the execution loop.
*
* @class LGraph
* @constructor
*/

function LGraph()
{
	if (LiteGraph.debug)
		console.log("Graph created");
	this.canvas = null;
	LiteGraph.graphs.push(this);
	this.clear();
}

LGraph.STATUS_STOPPED = 1;
LGraph.STATUS_RUNNING = 2;

/**
* Removes all nodes from this graph
* @method clear
*/

LGraph.prototype.clear = function()
{
	this.stop();
	this.status = LGraph.STATUS_STOPPED;
	this.last_node_id = 0;

	//nodes
	this.nodes = [];
	this.nodes_by_id = {};

	//links
	this.last_link_id = 0;
	this.links = {};

	//iterations
	this.iteration = 0;

	this.config = {
		canvas_offset: [0,0],
		canvas_scale: 1.0
	};

	//timing
	this.globaltime = 0;
	this.runningtime = 0;
	this.fixedtime =  0;
	this.fixedtime_lapse = 0.01;
	this.elapsed_time = 0.01;
	this.starttime = 0;

	this.graph = {};
	this.debug = true;

	this.change();
	if(this.canvas)
		this.canvas.clear();
}

/**
* Starts running this graph every interval milliseconds.
* @method start
* @param {number} interval amount of milliseconds between executions, default is 1
*/

LGraph.prototype.start = function(interval)
{
	if(this.status == LGraph.STATUS_RUNNING) return;
	this.status = LGraph.STATUS_RUNNING;

	if(this.onPlayEvent)
		this.onPlayEvent();

	this.sendEventToAllNodes("onStart");

	//launch
	this.starttime = new Date().getTime();
	interval = interval || 1;
	var that = this;	

	this.execution_timer_id = setInterval( function() { 
		//execute
		that.runStep(1); 
	},interval);
}

/**
* Stops the execution loop of the graph
* @method stop
*/

LGraph.prototype.stop = function()
{
	if(this.status == LGraph.STATUS_STOPPED)
		return;

	this.status = LGraph.STATUS_STOPPED;

	if(this.onStopEvent)
		this.onStopEvent();

	if(this.execution_timer_id != null)
		clearInterval(this.execution_timer_id);
	this.execution_timer_id = null;

	this.sendEventToAllNodes("onStop");
}

/**
* Run N steps (cycles) of the graph
* @method runStep
* @param {number} num number of steps to run, default is 1
*/

LGraph.prototype.runStep = function(num)
{
	num = num || 1;

	var start = new Date().getTime();
	this.globaltime = 0.001 * (start - this.starttime);

	try
	{
		for(var i = 0; i < num; i++)
		{
			this.sendEventToAllNodes("onExecute");
			this.fixedtime += this.fixedtime_lapse;
			if( this.onExecuteStep )
				this.onExecuteStep();
		}

		if( this.onAfterExecute )
			this.onAfterExecute();
		this.errors_in_execution = false;
	}
	catch (err)
	{
		this.errors_in_execution = true;
		if(LiteGraph.throw_errors)
			throw err;
		if(LiteGraph.debug)
			console.log("Error during execution: " + err);
		this.stop();
	}

	var elapsed = (new Date().getTime()) - start;
	if (elapsed == 0) elapsed = 1;
	this.elapsed_time = 0.001 * elapsed;
	this.globaltime += 0.001 * elapsed;
	this.iteration += 1;
}

/**
* Updates the graph execution order according to relevance of the nodes (nodes with only outputs have more relevance than
* nodes with only inputs.
* @method updateExecutionOrder
*/
	
LGraph.prototype.updateExecutionOrder = function()
{
	this.nodes_in_order = this.computeExecutionOrder();
}

//This is more internal, it computes the order and returns it
LGraph.prototype.computeExecutionOrder = function()
{
	var L = [];
	var S = [];
	var M = {};
	var visited_links = {}; //to avoid repeating links
	var remaining_links = {}; //to a
	
	//search for the nodes without inputs (starting nodes)
	for (var i in this.nodes)
	{
		var n = this.nodes[i];
		M[n.id] = n; //add to pending nodes

		var num = 0; //num of input connections
		if(n.inputs)
			for(var j = 0, l = n.inputs.length; j < l; j++)
				if(n.inputs[j] && n.inputs[j].link != null)
					num += 1;

		if(num == 0) //is a starting node
			S.push(n);
		else //num of input links 
			remaining_links[n.id] = num;
	}

	while(true)
	{
		if(S.length == 0)
			break;
			
		//get an starting node
		var n = S.shift();
		L.push(n); //add to ordered list
		delete M[n.id]; //remove from the pending nodes
		
		//for every output
		if(n.outputs)
			for(var i = 0; i < n.outputs.length; i++)
			{
				var output = n.outputs[i];
				//not connected
				if(output == null || output.links == null || output.links.length == 0)
					continue;

				//for every connection
				for(var j = 0; j < output.links.length; j++)
				{
					var link = output.links[j];

					//already visited link (ignore it)
					if(visited_links[ link[0] ])
						continue;

					var target_node = this.getNodeById( link[3] );
					if(target_node == null)
					{
						visited_links[ link[0] ] = true;
						continue;
					}

					visited_links[link[0]] = true; //mark as visited
					remaining_links[target_node.id] -= 1; //reduce the number of links remaining
					if (remaining_links[target_node.id] == 0)
						S.push(target_node); //if no more links, then add to Starters array
				}
			}
	}
	
	//the remaining ones (loops)
	for(var i in M)
		L.push(M[i]);
		
	if(L.length != this.nodes.length && LiteGraph.debug)
		console.log("something went wrong, nodes missing");

	//save order number in the node
	for(var i in L)
		L[i].order = i;
	
	return L;
}


/**
* Returns the amount of time the graph has been running in milliseconds
* @method getTime
* @return {number} number of milliseconds the graph has been running
*/

LGraph.prototype.getTime = function()
{
	return this.globaltime;
}

/**
* Returns the amount of time accumulated using the fixedtime_lapse var. This is used in context where the time increments should be constant
* @method getFixedTime
* @return {number} number of milliseconds the graph has been running
*/

LGraph.prototype.getFixedTime = function()
{
	return this.fixedtime;
}

/**
* Returns the amount of time it took to compute the latest iteration. Take into account that this number could be not correct
* if the nodes are using graphical actions
* @method getElapsedTime
* @return {number} number of milliseconds it took the last cycle
*/

LGraph.prototype.getElapsedTime = function()
{
	return this.elapsed_time;
}

/**
* Sends an event to all the nodes, useful to trigger stuff
* @method sendEventToAllNodes
* @param {String} eventname the name of the event
* @param {Object} param an object containing the info
*/

LGraph.prototype.sendEventToAllNodes = function(eventname, param)
{
	var M = this.nodes_in_order ? this.nodes_in_order : this.nodes;
	for(var j in M)
		if(M[j][eventname])
			M[j][eventname](param);
}

/**
* Adds a new node instasnce to this graph
* @method add
* @param {LGraphNode} node the instance of the node
*/

LGraph.prototype.add = function(node)
{
	if(!node || (node.id != -1 && this.nodes_by_id[node.id] != null))
		return; //already added

	if(this.nodes.length >= LiteGraph.MAX_NUMBER_OF_NODES)
		throw("LiteGraph: max number of nodes in a graph reached");

	//give him an id
	if(node.id == null || node.id == -1)
		node.id = this.last_node_id++;

	node.graph = this;

	this.nodes.push(node);
	this.nodes_by_id[node.id] = node;

	/*
	// rendering stuf... 
	if(node.bgImageUrl)
		node.bgImage = node.loadImage(node.bgImageUrl);
	*/

	if(node.onInit)
		node.onInit();

	if(this.config.align_to_grid)
		node.alignToGrid();
		
	this.updateExecutionOrder();	

	if(this.canvas)
		this.canvas.dirty_canvas = true;

	this.change();

	return node; //to chain actions
}

/**
* Removes a node from the graph
* @method remove
* @param {LGraphNode} node the instance of the node
*/

LGraph.prototype.remove = function(node)
{
	if(this.nodes_by_id[node.id] == null)
		return; //not found

	if(node.ignore_remove) 
		return; //cannot be removed

	//disconnect inputs
	if(node.inputs)
		for(var i = 0; i < node.inputs.length; i++)
		{
			var slot = node.inputs[i];
			if(slot.link != null)
				node.disconnectInput(i);
		}

	//disconnect outputs
	if(node.outputs)
		for(var i = 0; i < node.outputs.length; i++)
		{
			var slot = node.outputs[i];
			if(slot.links != null && slot.links.length)
				node.disconnectOutput(i);
		}

	node.id = -1;

	//callback
	if(node.onDelete)
		node.onDelete();

	//remove from environment
	if(this.canvas)
	{
		if(this.canvas.selected_nodes[node.id])
			delete this.canvas.selected_nodes[node.id];
		if(this.canvas.node_dragged == node)
			this.canvas.node_dragged = null;
	}

	//remove from containers
	var pos = this.nodes.indexOf(node);
	if(pos != -1)
		this.nodes.splice(pos,1);
	delete this.nodes_by_id[node.id];

	if(this.canvas)
		this.canvas.setDirty(true,true);

	this.change();

	this.updateExecutionOrder();
}

/**
* Returns a node by its id.
* @method getNodeById
* @param {String} id
*/

LGraph.prototype.getNodeById = function(id)
{
	if(id==null) return null;
	return this.nodes_by_id[id];
}


/**
* Returns a list of nodes that matches a type
* @method findNodesByType
* @param {String} type the name of the node type
* @return {Array} a list with all the nodes of this type
*/

LGraph.prototype.findNodesByType = function(type)
{
	var r = [];
	for(var i in this.nodes)
		if(this.nodes[i].type == type)
			r.push(this.nodes[i]);
	return r;
}

/**
* Returns a list of nodes that matches a name
* @method findNodesByName
* @param {String} name the name of the node to search
* @return {Array} a list with all the nodes with this name
*/

LGraph.prototype.findNodesByName = function(name)
{
	var result = [];
	for (var i in this.nodes)
		if(this.nodes[i].name == name)
			result.push(this.nodes[i]);
	return result;
}

/**
* Returns the top-most node in this position of the canvas
* @method getNodeOnPos
* @param {number} x the x coordinate in canvas space
* @param {number} y the y coordinate in canvas space
* @param {Array} nodes_list a list with all the nodes to search from, by default is all the nodes in the graph
* @return {Array} a list with all the nodes that intersect this coordinate
*/

LGraph.prototype.getNodeOnPos = function(x,y, nodes_list)
{
	nodes_list = nodes_list || this.nodes;
	for (var i = nodes_list.length - 1; i >= 0; i--)
	{
		var n = nodes_list[i];
		if(n.isPointInsideNode(x,y))
			return n;
	}
	return null;
}

/**
* Assigns a value to all the nodes that matches this name. This is used to create global variables of the node that
* can be easily accesed from the outside of the graph
* @method setInputData
* @param {String} name the name of the node
* @param {*} value value to assign to this node
*/

LGraph.prototype.setInputData = function(name,value)
{
	var m = this.findNodesByName(name);
	for(var i in m)
		m[i].setValue(value);
}

/**
* Returns the value of the first node with this name. This is used to access global variables of the graph from the outside
* @method setInputData
* @param {String} name the name of the node
* @return {*} value of the node
*/

LGraph.prototype.getOutputData = function(name)
{
	var n = this.findNodesByName(name);
	if(n.length)
		return m[0].getValue();
	return null;
}

//This feature is not finished yet, is to create graphs where nodes are not executed unless a trigger message is received

LGraph.prototype.triggerInput = function(name,value)
{
	var m = this.findNodesByName(name);
	for(var i in m)
		m[i].onTrigger(value);
}

LGraph.prototype.setCallback = function(name,func)
{
	var m = this.findNodesByName(name);
	for(var i in m)
		m[i].setTrigger(func);
}

//**********


LGraph.prototype.onConnectionChange = function()
{
	this.updateExecutionOrder();
}

LGraph.prototype.isLive = function()
{
	if(!this.canvas) return false;
	return this.canvas.live_mode;
}

LGraph.prototype.change = function()
{
	if(LiteGraph.debug)
		console.log("Graph changed");
	if(this.on_change)
		this.on_change(this);
}

//save and recover app state ***************************************
/**
* Creates a JSON String containing all the info about this graph
* @method serialize
* @return {String} value of the node
*/
LGraph.prototype.serialize = function()
{
	var nodes_info = [];
	for (var i in this.nodes)
		nodes_info.push( this.nodes[i].objectivize() );

	var data = {
		graph: this.graph,

		iteration: this.iteration,
		frame: this.frame,
		last_node_id: this.last_node_id,
		last_link_id: this.last_link_id,

		config: this.config,
		nodes: nodes_info
	};

	return JSON.stringify(data);
}

/**
* Configure a graph from a JSON string 
* @method unserialize
* @param {String} str configure a graph from a JSON string
*/
LGraph.prototype.unserialize = function(str, keep_old)
{
	if(!keep_old)
		this.clear();

	var data = JSON.parse(str);
	var nodes = data.nodes;

	//copy all stored fields
	for (var i in data)
		this[i] = data[i];

	var error = false;

	//create nodes
	this.nodes = [];
	for (var i in nodes)
	{
		var n_info = nodes[i]; //stored info
		var n = LiteGraph.createNode( n_info.type, n_info.name );
		if(!n)
		{
			if(LiteGraph.debug)
				console.log("Node not found: " + n_info.type);
			error = true;
			continue;
		}

		n.copyFromObject(n_info);
		this.add(n);
	}

	//TODO: dispatch redraw
	if(this.canvas)
		this.canvas.draw(true,true);

	return error;
}

LGraph.prototype.onNodeTrace = function(node, msg, color)
{
	if(this.canvas)
		this.canvas.onNodeTrace(node,msg,color);
}

// *************************************************************
//   Node CLASS                                          *******
// *************************************************************

/* flags:
		+ skip_title_render
		+ clip_area
		+ unsafe_execution: not allowed for safe execution

	supported callbacks: 
		+ onInit: when added to graph
		+ onStart:	when starts playing
		+ onStop:	when stops playing
		+ onDrawForeground
		+ onDrawBackground
		+ onMouseMove
		+ onMouseOver
		+ onExecute: execute the node
		+ onPropertyChange: when a property is changed in the panel (return true to skip default behaviour)
		+ onGetInputs: returns an array of possible inputs
		+ onGetOutputs: returns an array of possible outputs
		+ onClick
		+ onDblClick
		+ onSerialize
		+ onSelected
		+ onDeselected
*/

/**
* Base Class for all the node type classes
* @class LGraphNode
* @param {String} name a name for the node
*/

function LGraphNode(name)
{
	this.name = name || "Unnamed";
	this.size = [LiteGraph.NODE_WIDTH,60];
	this.graph = null;

	this.pos = [10,10];
	this.id = -1; //not know till not added
	this.type = null;

	//inputs available: array of inputs
	this.inputs = [];
	this.outputs = [];
	this.connections = [];

	//local data
	this.data = null; //persistent local data
	this.flags = {
		//skip_title_render: true,
		//unsafe_execution: false,
	};
}

//serialization *************************

LGraphNode.prototype.objectivize = function()
{
	var o = {
		id: this.id,
		name: this.name,
		type: this.type,
		pos: this.pos,
		size: this.size,
		data: this.data,
		properties: jQuery.extend({}, this.properties),
		flags: jQuery.extend({}, this.flags),
		inputs: this.inputs,
		outputs: this.outputs
	};

	if(!o.type)
		o.type = this.constructor.type;

	if(this.color)
		o.color = this.color;
	if(this.bgcolor)
		o.bgcolor = this.bgcolor;
	if(this.boxcolor)
		o.boxcolor = this.boxcolor;
	if(this.shape)
		o.shape = this.shape;

	return o;
}

//reduced version of objectivize: NOT FINISHED
LGraphNode.prototype.reducedObjectivize = function()
{
	var o = this.objectivize();
	
	var type = LiteGraph.getNodeType(o.type);

	if(type.name == o.name)
		delete o["name"];

	if(type.size && compareObjects(o.size,type.size))
		delete o["size"];

	if(type.properties && compareObjects(o.properties, type.properties))
		delete o["properties"];

	return o;
}


LGraphNode.prototype.serialize = function()
{
	if(this.onSerialize)
		this.onSerialize();
	return JSON.stringify( this.reducedObjectivize() );
}
//LGraphNode.prototype.unserialize = function(info) {} //this cannot be done from within, must be done in LiteGraph


// Execution *************************

LGraphNode.prototype.setOutputData = function(slot,data)
{
	if(!this.outputs) return;
	if(slot > -1 && slot < this.outputs.length && this.outputs[slot] && this.outputs[slot].links != null)
	{
		for(var i = 0; i < this.outputs[slot].links.length; i++)
			this.graph.links[ this.outputs[slot].links[i][0] ] = data;
	}
}

LGraphNode.prototype.getInputData = function(slot)
{
	if(!this.inputs) return null;
	if(slot < this.inputs.length && this.inputs[slot].link != null)
		return this.graph.links[ this.inputs[slot].link[0] ];
	return null;
}

LGraphNode.prototype.getInputInfo = function(slot)
{
	if(!this.inputs) return null;
	if(slot < this.inputs.length)
		return this.inputs[slot];
	return null;
}


LGraphNode.prototype.getOutputInfo = function(slot)
{
	if(!this.outputs) return null;
	if(slot < this.outputs.length)
		return this.outputs[slot];
	return null;
}

LGraphNode.prototype.getOutputNodes = function(slot)
{
	if(!this.outputs || this.outputs.length == 0) return null;
	if(slot < this.outputs.length)
	{
		var output = this.outputs[slot];
		var r = [];
		for(var i = 0; i < output.length; i++)
			r.push( this.graph.getNodeById( output.links[i][3] ));
		return r;
	}
	return null;
}

LGraphNode.prototype.triggerOutput = function(slot,param)
{
	var n = this.getOutputNode(slot);
	if(n && n.onTrigger)
		n.onTrigger(param);
}

//connections

LGraphNode.prototype.addOutput = function(name,type,extra_info)
{
	var o = {name:name,type:type,links:null};
	if(extra_info)
		for(var i in extra_info)
			o[i] = extra_info[i];

	if(!this.outputs) this.outputs = [];
	this.outputs.push(o);
	this.size = this.computeSize();
}

LGraphNode.prototype.removeOutput = function(slot)
{
	this.disconnectOutput(slot);
	this.outputs.splice(slot,1);
	this.size = this.computeSize();
}

LGraphNode.prototype.addInput = function(name,type,extra_info)
{
	var o = {name:name,type:type,link:null};
	if(extra_info)
		for(var i in extra_info)
			o[i] = extra_info[i];

	if(!this.inputs) this.inputs = [];
	this.inputs.push(o);
	this.size = this.computeSize();
}

LGraphNode.prototype.removeInput = function(slot)
{
	this.disconnectInput(slot);
	this.inputs.splice(slot,1);
	this.size = this.computeSize();
}

//trigger connection
LGraphNode.prototype.addConnection = function(name,type,pos,direction)
{
	this.connections.push( {name:name,type:type,pos:pos,direction:direction,links:null});
}


LGraphNode.prototype.computeSize = function(minHeight)
{
	var rows = Math.max( this.inputs ? this.inputs.length : 1, this.outputs ? this.outputs.length : 1);
	var size = [0,0];
	size[1] = rows * 14 + 6;
	if(!this.inputs || this.inputs.length == 0 || !this.outputs || this.outputs.length == 0)
		size[0] = LiteGraph.NODE_WIDTH * 0.5;
	else
		size[0] = LiteGraph.NODE_WIDTH;
	return size;
}

//returns the bounding of the object, used for rendering purposes
LGraphNode.prototype.getBounding = function()
{
	return new Float32Array([this.pos[0] - 4, this.pos[1] - LGraph.NODE_TITLE_HEIGHT, this.pos[0] + this.size[0] + 4, this.pos[1] + this.size[1] + LGraph.NODE_TITLE_HEIGHT]);
}

//checks if a point is inside the shape of a node
LGraphNode.prototype.isPointInsideNode = function(x,y)
{
	var margin_top = this.graph.isLive() ? 0 : 20;
	if(this.flags.collapsed)
	{
		if ( distance([x,y], [this.pos[0] + this.size[0]*0.5, this.pos[1] + this.size[1]*0.5]) < LiteGraph.NODE_COLLAPSED_RADIUS)
			return true;
	}
	else if (this.pos[0] - 4 < x && (this.pos[0] + this.size[0] + 4) > x
		&& (this.pos[1] - margin_top) < y && (this.pos[1] + this.size[1]) > y)
		return true;
	return false;
}

LGraphNode.prototype.findInputSlot = function(name)
{
	if(!this.inputs) return -1;
	for(var i = 0, l = this.inputs.length; i < l; ++i)
		if(name == this.inputs[i].name)
			return i;
	return -1;
}

LGraphNode.prototype.findOutputSlot = function(name)
{
	if(!this.outputs) return -1;
	for(var i = 0, l = this.outputs.length; i < l; ++i)
		if(name == this.outputs[i].name)
			return i;
	return -1;
}

//connect this node output to the input of another node
LGraphNode.prototype.connect = function(slot, node, target_slot)
{
	target_slot = target_slot || 0;

	//seek for the output slot
	if( slot.constructor === String )
	{
		slot = this.findOutputSlot(slot);
		if(slot == -1)
		{
			if(LiteGraph.debug)
				console.log("Connect: Error, no slot of name " + slot);
			return false;
		}
	}
	else if(!this.outputs || slot >= this.outputs.length) 
	{
		if(LiteGraph.debug)
			console.log("Connect: Error, slot number not found");
		return false;
	}

	//avoid loopback
	if(node == this) return false; 
	//if( node.constructor != LGraphNode ) throw ("LGraphNode.connect: node is not of type LGraphNode");

	if(target_slot.constructor === String)
	{
		target_slot = node.findInputSlot(target_slot);
		if(target_slot == -1)
		{
			if(LiteGraph.debug)
				console.log("Connect: Error, no slot of name " + target_slot);
			return false;
		}
	}
	else if(!node.inputs || target_slot >= node.inputs.length) 
	{
		if(LiteGraph.debug)
			console.log("Connect: Error, slot number not found");
		return false;
	}

	//if there is something already plugged there, disconnect
	if(target_slot != -1 && node.inputs[target_slot].link != null)
		node.disconnectInput(target_slot);
		
	//special case: -1 means node-connection, used for triggers
	var output = this.outputs[slot];
	if(target_slot == -1)
	{
		if( output.links == null )
			output.links = [];
		output.links.push({id:node.id, slot: -1});
	}
	else if(output.type == 0 ||  //generic output
			node.inputs[target_slot].type == 0 || //generic input
			output.type == node.inputs[target_slot].type) //same type
	{
		//info: link structure => [ 0:link_id, 1:start_node_id, 2:start_slot, 3:end_node_id, 4:end_slot ]
		var link = [ this.graph.last_link_id++, this.id, slot, node.id, target_slot ];

		//connect
		if( output.links == null )	output.links = [];
		output.links.push(link);
		node.inputs[target_slot].link = link;

		this.setDirtyCanvas(false,true);
		this.graph.onConnectionChange();
	}
	return true;
}

LGraphNode.prototype.disconnectOutput = function(slot, target_node)
{
	if( slot.constructor === String )
	{
		slot = this.findOutputSlot(slot);
		if(slot == -1)
		{
			if(LiteGraph.debug)
				console.log("Connect: Error, no slot of name " + slot);
			return false;
		}
	}
	else if(!this.outputs || slot >= this.outputs.length) 
	{
		if(LiteGraph.debug)
			console.log("Connect: Error, slot number not found");
		return false;
	}

	//get output slot
	var output = this.outputs[slot];
	if(!output.links || output.links.length == 0)
		return false;

	if(target_node)
	{
		for(var i = 0, l = output.links.length; i < l; i++)
		{
			var link = output.links[i];
			//is the link we are searching for...
			if( link[3] == target_node.id )
			{
				output.links.splice(i,1); //remove here
				target_node.inputs[ link[4] ].link = null; //remove there
				delete this.graph.links[link[0]];
				break;
			}
		}
	}
	else
	{
		for(var i = 0, l = output.links.length; i < l; i++)
		{
			var link = output.links[i];
			var target_node = this.graph.getNodeById( link[3] );
			if(target_node)
				target_node.inputs[ link[4] ].link = null; //remove other side link
		}
		output.links = null;
	}

	this.setDirtyCanvas(false,true);
	this.graph.onConnectionChange();
	return true;
}

LGraphNode.prototype.disconnectInput = function(slot)
{
	//seek for the output slot
	if( slot.constructor === String )
	{
		slot = this.findInputSlot(slot);
		if(slot == -1)
		{
			if(LiteGraph.debug)
				console.log("Connect: Error, no slot of name " + slot);
			return false;
		}
	}
	else if(!this.inputs || slot >= this.inputs.length) 
	{
		if(LiteGraph.debug)
			console.log("Connect: Error, slot number not found");
		return false;
	}

	var input = this.inputs[slot];
	if(!input) return false;
	var link = this.inputs[slot].link;
	this.inputs[slot].link = null;

	//remove other side
	var node = this.graph.getNodeById( link[1] );
	if(!node) return false;

	var output = node.outputs[ link[2] ];
	if(!output || !output.links || output.links.length == 0) 
		return false;

	for(var i = 0, l = output.links.length; i < l; i++)
	{
		var link = output.links[i];
		if( link[3] == this.id )
		{
			output.links.splice(i,1);
			break;
		}
	}

	this.setDirtyCanvas(false,true);
	this.graph.onConnectionChange();
	return true;
}

//returns the center of a connection point in canvas coords
LGraphNode.prototype.getConnectionPos = function(is_input,slot_number)
{
	if(this.flags.collapsed)
		return [this.pos[0] + this.size[0] * 0.5, this.pos[1] + this.size[1] * 0.5];

	if(is_input && slot_number == -1)
	{
		return [this.pos[0] + 10, this.pos[1] + 10];
	}

	if(is_input && this.inputs.length > slot_number && this.inputs[slot_number].pos)
		return [this.pos[0] + this.inputs[slot_number].pos[0],this.pos[1] + this.inputs[slot_number].pos[1]];
	else if(!is_input && this.outputs.length > slot_number && this.outputs[slot_number].pos)
		return [this.pos[0] + this.outputs[slot_number].pos[0],this.pos[1] + this.outputs[slot_number].pos[1]];

	if(!is_input) //output
		return [this.pos[0] + this.size[0] + 1, this.pos[1] + 10 + slot_number * LiteGraph.NODE_SLOT_HEIGHT];
	return [this.pos[0] , this.pos[1] + 10 + slot_number * LiteGraph.NODE_SLOT_HEIGHT];
}

/* Renders the LGraphNode on the canvas */
LGraphNode.prototype.draw = function(ctx, canvasrender)
{
	var glow = false;

	var color = this.color || LiteGraph.NODE_DEFAULT_COLOR;
	//if (this.selected) color = "#88F";

	var render_title = true;
	if(this.flags.skip_title_render || this.graph.isLive())
		render_title = false;
	if(this.mouseOver)
		render_title = true;

	//shadow and glow
	if (this.mouseOver) glow = true;
	
	if(this.selected)
	{
		/*
		ctx.shadowColor = "#EEEEFF";//glow ? "#AAF" : "#000";
		ctx.shadowOffsetX = 0;
		ctx.shadowOffsetY = 0;
		ctx.shadowBlur = 1;
		*/
	}
	else if(canvasrender.render_shadows)
	{
		ctx.shadowColor = "#111";
		ctx.shadowOffsetX = 2;
		ctx.shadowOffsetY = 2;
		ctx.shadowBlur = 4;
	}
	else
		ctx.shadowColor = "transparent";

	//only render if it forces it to do it
	if(canvasrender.live_mode)
	{
		if(!this.flags.collapsed)
		{
			ctx.shadowColor = "transparent";
			if(this.onDrawBackground)
				this.onDrawBackground(ctx);
			if(this.onDrawForeground)
				this.onDrawForeground(ctx);
		}

		return;
	}

	//draw in collapsed form
	if(this.flags.collapsed)
	{
		if(!this.onDrawCollapsed || this.onDrawCollapsed(ctx) == false)
			this.drawNodeCollapsed(ctx,color,this.bgcolor);
		return;
	}

	//clip if required (mask)
	if(this.flags.clip_area)
	{
		ctx.save();
		if(this.shape == null || this.shape == "box")
		{
			ctx.beginPath();
			ctx.rect(0,0,this.size[0], this.size[1]);
		}
		else if (this.shape == "round")
		{
			ctx.roundRect(0,0,this.size[0], this.size[1],10);
		}
		else if (this.shape == "circle")
		{
			ctx.beginPath();
			ctx.arc(this.size[0] * 0.5, this.size[1] * 0.5,this.size[0] * 0.5, 0, Math.PI*2);
		}
		ctx.clip();
	}

	//draw shape
	this.drawNodeShape(ctx,color, this.bgcolor, !render_title, this.selected );
	ctx.shadowColor = "transparent";

	//connection slots
	ctx.textAlign = "left";
	ctx.font = "12px Arial";

	var render_text = this.graph.config.canvas_scale > 0.6;

	//input connection slots
	if(this.inputs)
		for(var i = 0; i < this.inputs.length; i++)
		{
			var slot = this.inputs[i];

			ctx.globalAlpha = 1.0;
			if (canvasrender.connecting_node != null && canvasrender.connecting_output.type != 0 && this.inputs[i].type != 0 && canvasrender.connecting_output.type != this.inputs[i].type)
				ctx.globalAlpha = 0.4;

			ctx.fillStyle = slot.link != null ? "#7F7" : "#AAA";

			var pos = this.getConnectionPos(true,i);
			pos[0] -= this.pos[0];
			pos[1] -= this.pos[1];

			ctx.beginPath();

			if (1 || slot.round)
				ctx.arc(pos[0],pos[1],4,0,Math.PI*2);
			//else
			//	ctx.rect((pos[0] - 6) + 0.5, (pos[1] - 5) + 0.5,14,10);

			ctx.fill();

			//render name
			if(render_text)
			{
				var text = slot.label != null ? slot.label : slot.name;
				if(text)
				{
					ctx.fillStyle = color; 
					ctx.fillText(text,pos[0] + 10,pos[1] + 5);
				}
			}
		}

	//output connection slots
	if(canvasrender.connecting_node)
		ctx.globalAlpha = 0.4;

	ctx.lineWidth = 1;

	ctx.textAlign = "right";
	ctx.strokeStyle = "black";
	if(this.outputs)
		for(var i = 0; i < this.outputs.length; i++)
		{
			var slot = this.outputs[i];

			var pos = this.getConnectionPos(false,i);
			pos[0] -= this.pos[0];
			pos[1] -= this.pos[1];

			ctx.fillStyle = slot.links && slot.links.length ? "#7F7" : "#AAA";
			ctx.beginPath();
			//ctx.rect( this.size[0] - 14,i*14,10,10);

			if (1 || slot.round)
				ctx.arc(pos[0],pos[1],4,0,Math.PI*2);
			//else
			//	ctx.rect((pos[0] - 6) + 0.5,(pos[1] - 5) + 0.5,14,10);

			//trigger
			//if(slot.node_id != null && slot.slot == -1)
			//	ctx.fillStyle = "#F85";

			//if(slot.links != null && slot.links.length)
			ctx.fill();
			ctx.stroke();

			//render output name
			if(render_text)
			{
				var text = slot.label != null ? slot.label : slot.name;
				if(text)
				{
					ctx.fillStyle = color;
					ctx.fillText(text, pos[0] - 10,pos[1] + 5);
				}
			}
		}

	ctx.textAlign = "left";
	ctx.globalAlpha = 1.0;

	if(this.onDrawForeground)
		this.onDrawForeground(ctx);

	if(this.flags.clip_area)
		ctx.restore();
}

/* Renders the node shape */
LGraphNode.prototype.drawNodeShape = function(ctx, fgcolor, bgcolor, no_title, selected )
{
	//bg rect
	ctx.strokeStyle = fgcolor || LiteGraph.NODE_DEFAULT_COLOR;
	ctx.fillStyle = bgcolor || LiteGraph.NODE_DEFAULT_BGCOLOR;

	/* gradient test
	var grad = ctx.createLinearGradient(0,0,0,this.size[1]);
	grad.addColorStop(0, "#AAA");
	grad.addColorStop(0.5, fgcolor || LiteGraph.NODE_DEFAULT_COLOR);
	grad.addColorStop(1, bgcolor || LiteGraph.NODE_DEFAULT_BGCOLOR);
	ctx.fillStyle = grad;
	*/

	var title_height = LiteGraph.NODE_TITLE_HEIGHT;

	//render depending on shape
	if(this.shape == null || this.shape == "box")
	{
		if(selected)
		{
			ctx.strokeStyle = "#CCC";
			ctx.strokeRect(-0.5,no_title ? -0.5 : -title_height + -0.5,this.size[0]+2, no_title ? (this.size[1]+2) : (this.size[1] + title_height+2) );
			ctx.strokeStyle = fgcolor;
		}

		ctx.beginPath();
		ctx.rect(0.5,no_title ? 0.5 : -title_height + 0.5,this.size[0], no_title ? this.size[1] : this.size[1] + title_height);
	}
	else if (this.shape == "round")
	{
		ctx.roundRect(0,no_title ? 0 : -title_height,this.size[0], no_title ? this.size[1] : this.size[1] + title_height, 10);
	}
	else if (this.shape == "circle")
	{
		ctx.beginPath();
		ctx.arc(this.size[0] * 0.5, this.size[1] * 0.5,this.size[0] * 0.5, 0, Math.PI*2);
	}

	ctx.fill();
	ctx.shadowColor = "transparent";
	ctx.stroke();

	//image
	if (this.bgImage && this.bgImage.width)
		ctx.drawImage( this.bgImage, (this.size[0] - this.bgImage.width) * 0.5 , (this.size[1] - this.bgImage.height) * 0.5);

	if(this.bgImageUrl && !this.bgImage)
		this.bgImage = this.loadImage(this.bgImageUrl);

	if(this.onDrawBackground)
		this.onDrawBackground(ctx);

	//title bg
	if(!no_title)
	{
		ctx.fillStyle = fgcolor || LiteGraph.NODE_DEFAULT_COLOR;

		if(this.shape == null || this.shape == "box")
		{
			ctx.fillRect(0,-title_height,this.size[0],title_height);
			ctx.stroke();
		}
		else if (this.shape == "round")
		{
			ctx.roundRect(0,-title_height,this.size[0], title_height,10,0);
			//ctx.fillRect(0,8,this.size[0],NODE_TITLE_HEIGHT - 12);
			ctx.fill();
			ctx.stroke();
		}

		//box
		ctx.fillStyle = this.boxcolor || LiteGraph.NODE_DEFAULT_BOXCOLOR;
		ctx.beginPath();
		if (this.shape == "round")
			ctx.arc(title_height *0.5, title_height * -0.5, (title_height - 6) *0.5,0,Math.PI*2);
		else
			ctx.rect(3,-title_height + 3,title_height - 6,title_height - 6);
		ctx.fill();

		//title text
		ctx.font = "bold 12px Arial";
		if(this.name != "" && this.graph.config.canvas_scale > 0.8)
		{
			ctx.fillStyle = "#222";
			ctx.fillText(this.name,16,13-title_height );
		}
	}
}

/* Renders the node when collapsed */
LGraphNode.prototype.drawNodeCollapsed = function(ctx, fgcolor, bgcolor)
{
	//draw default collapsed shape
	ctx.strokeStyle = fgcolor || LiteGraph.NODE_DEFAULT_COLOR;
	ctx.fillStyle = bgcolor || LiteGraph.NODE_DEFAULT_BGCOLOR;

	var collapsed_radius = LiteGraph.NODE_COLLAPSED_RADIUS;

	//circle shape
	if(this.shape == "circle")
	{
		ctx.beginPath();
		ctx.arc(this.size[0] * 0.5, this.size[1] * 0.5, collapsed_radius,0,Math.PI * 2);
		ctx.fill();
		ctx.shadowColor = "rgba(0,0,0,0)";
		ctx.stroke();

		ctx.fillStyle = this.boxcolor || LiteGraph.NODE_DEFAULT_BOXCOLOR;
		ctx.beginPath();
		ctx.arc(this.size[0] * 0.5, this.size[1] * 0.5, collapsed_radius * 0.5,0,Math.PI * 2);
		ctx.fill();
	}
	else if(this.shape == "round") //rounded box
	{
		ctx.beginPath();
		ctx.roundRect(this.size[0] * 0.5 - collapsed_radius, this.size[1] * 0.5 - collapsed_radius, 2*collapsed_radius,2*collapsed_radius,5);
		ctx.fill();
		ctx.shadowColor = "rgba(0,0,0,0)";
		ctx.stroke();

		ctx.fillStyle = this.boxcolor || LiteGraph.NODE_DEFAULT_BOXCOLOR;
		ctx.beginPath();
		ctx.roundRect(this.size[0] * 0.5 - collapsed_radius*0.5, this.size[1] * 0.5 - collapsed_radius*0.5, collapsed_radius,collapsed_radius,2);
		ctx.fill();
	}
	else //flat box
	{
		ctx.beginPath();
		ctx.rect(this.size[0] * 0.5 - collapsed_radius, this.size[1] * 0.5 - collapsed_radius, 2*collapsed_radius,2*collapsed_radius);
		ctx.fill();
		ctx.shadowColor = "rgba(0,0,0,0)";
		ctx.stroke();

		ctx.fillStyle = this.boxcolor || LiteGraph.NODE_DEFAULT_BOXCOLOR;
		ctx.beginPath();
		ctx.rect(this.size[0] * 0.5 - collapsed_radius*0.5, this.size[1] * 0.5 - collapsed_radius*0.5, collapsed_radius,collapsed_radius);
		ctx.fill();
	}
}

/* Force align to grid */
LGraphNode.prototype.alignToGrid = function()
{
	this.pos[0] = LiteGraph.CANVAS_GRID_SIZE * Math.round(this.pos[0] / LiteGraph.CANVAS_GRID_SIZE);
	this.pos[1] = LiteGraph.CANVAS_GRID_SIZE * Math.round(this.pos[1] / LiteGraph.CANVAS_GRID_SIZE);
}

/* Copy all the info from one object to this node (used for serialization) */
LGraphNode.prototype.copyFromObject = function(info, ignore_connections)
{
	var outputs = null;
	var inputs = null;
	var properties = null;
	var local_data = null;

	for (var j in info)
	{
		if(ignore_connections && (j == "outputs" || j == "inputs"))
			continue;

		if(j == "console") continue;

		if(info[j] == null)
			continue;
		else if( info[j].concat ) //array
			this[j] = info[j].concat();
		else if (typeof(info[j]) == 'object') //object
			this[j] = jQuery.extend({}, info[j]);
		else //value
			this[j] = info[j];
	}

	//redo the connections
	/*
	if(outputs)
		this.outputs = outputs.concat();
	if(inputs)
		this.inputs = inputs.concat();

	if(local_data)
		this.data = local_data;
	if(properties)
	{
		//copy only the ones defined
		for (var j in properties)
			if (this.properties[j] != null)
				this.properties[j] = properties[j];
	}
	*/
}

/* Creates a clone of this node */
LGraphNode.prototype.clone = function()
{
	var node = LiteGraph.createNode(this.type);

	node.size = this.size.concat();
	if(this.inputs)
		for(var i = 0, l = this.inputs.length; i < l; ++i)
		{
			if(node.findInputSlot( this.inputs[i].name ) == -1)
				node.addInput( this.inputs[i].name, this.inputs[i].type );
		}

	if(this.outputs)
		for(var i = 0, l = this.outputs.length; i < l; ++i)
		{
			if(node.findOutputSlot( this.outputs[i].name ) == -1)
				node.addOutput( this.outputs[i].name, this.outputs[i].type );
		}


	return node;
}

/* Console output */
LGraphNode.prototype.trace = function(msg)
{
	if(!this.console)
		this.console = [];
	this.console.push(msg);

	this.graph.onNodeTrace(this,msg);
}

/* Forces to redraw or the main canvas (LGraphNode) or the bg canvas (links) */
LGraphNode.prototype.setDirtyCanvas = function(dirty_foreground, dirty_background)
{
	if(!this.graph || !this.graph.canvas)
		return;

	if(dirty_foreground)
		this.graph.canvas.dirty_canvas = true;
	if(dirty_background)
		this.graph.canvas.dirty_bgcanvas = true;
}

LGraphNode.prototype.loadImage = function(url)
{
	var img = new Image();
	img.src = LiteGraph.node_images_path + url;	
	img.ready = false;

	var that = this;
	img.onload = function() { 
		this.ready = true;
		that.setDirtyCanvas(true);
	}
	return img;
}

//safe LGraphNode action execution (not sure if safe)
LGraphNode.prototype.executeAction = function(action)
{
	if(action == "") return false;

	if( action.indexOf(";") != -1 || action.indexOf("}") != -1)
	{
		this.trace("Error: Action contains unsafe characters");
		return false;
	}

	var tokens = action.split("(");
	var func_name = tokens[0];
	if( typeof(this[func_name]) != "function")
	{
		this.trace("Error: Action not found on node: " + func_name);
		return false;
	}

	var code = action;

	try
	{
		var _foo = eval;
		eval = null;
		(new Function("with(this) { " + code + "}")).call(this);
		eval = _foo;
	}
	catch (err)
	{
		this.trace("Error executing action {" + action + "} :" + err);
		return false;
	}

	return true;
}

/* Allows to get onMouseMove and onMouseUp events even if the mouse is out of focus */
LGraphNode.prototype.captureInput = function(v)
{
	if(!this.graph || !this.graph.canvas)
		return;

	//releasing somebody elses capture?!
	if(!v && this.graph.canvas.node_capturing_input != this)
		return;

	//change
	this.graph.canvas.node_capturing_input = v ? this : null;
	if(this.graph.debug)
		console.log(this.name + ": Capturing input " + (v?"ON":"OFF"));
}

/* Collapse the node */
LGraphNode.prototype.collapse = function()
{
	if(!this.flags.collapsed)
		this.flags.collapsed = true;
	else
		this.flags.collapsed = false;
	this.setDirtyCanvas(true,true);
}

/* Forces the node to do not move or realign on Z */
LGraphNode.prototype.pin = function()
{
	if(!this.flags.pinned)
		this.flags.pinned = true;
	else
		this.flags.pinned = false;
}

LGraphNode.prototype.localToScreen = function(x,y)
{
	return [(x + this.pos[0]) * this.graph.config.canvas_scale + this.graph.config.canvas_offset[0],
		(y + this.pos[1]) * this.graph.config.canvas_scale + this.graph.config.canvas_offset[1]];
}



//*********************************************************************************
// LGraphCanvas: LGraph renderer CLASS                                  
//*********************************************************************************

function LGraphCanvas(canvas, graph)
{
	if(graph === undefined)
		throw ("No graph assigned");

	if( typeof(window) != "undefined" )
	{
		window.requestAnimFrame = (function(){
		  return  window.requestAnimationFrame       ||
				  window.webkitRequestAnimationFrame ||
				  window.mozRequestAnimationFrame    ||
				  function( callback ){
					window.setTimeout(callback, 1000 / 60);
				  };
		})();
	}

	//link canvas and graph
	this.graph = graph;
	if(graph)
		graph.canvas = this;

	this.setCanvas(canvas);
	this.clear();

	this.startRendering();
}

LGraphCanvas.link_type_colors = {'number':"#AAC",'node':"#DCA"};
LGraphCanvas.link_width = 2;

LGraphCanvas.prototype.clear = function()
{
	this.frame = 0;
	this.last_draw_time = 0;
	this.render_time = 0;
	this.fps = 0;

	this.selected_nodes = {};
	this.node_dragged = null;
	this.node_over = null;
	this.node_capturing_input = null;
	this.connecting_node = null;

	this.highquality_render = true;
	this.pause_rendering = false;
	this.render_shadows = true;
	this.dirty_canvas = true;
	this.dirty_bgcanvas = true;
	this.dirty_area = null;

	this.render_only_selected = true;
	this.live_mode = false;
	this.show_info = true;
	this.allow_dragcanvas = true;
	this.allow_dragnodes = true;

	this.node_in_panel = null;

	this.last_mouse = [0,0];
	this.last_mouseclick = 0;

	if(this.onClear) this.onClear();
	//this.UIinit();
}

LGraphCanvas.prototype.setGraph = function(graph)
{
	if(this.graph == graph) return;

	this.clear();
	if(this.graph)
		this.graph.canvas = null; //remove old graph link to the canvas
	this.graph = graph;
	if(this.graph)
		this.graph.canvas = this;
	this.setDirty(true,true);
}

LGraphCanvas.prototype.resize = function(width, height)
{
	if(this.canvas.width == width && this.canvas.height == height)
		return;

	this.canvas.width = width;
	this.canvas.height = height;
	this.bgcanvas.width = this.canvas.width;
	this.bgcanvas.height = this.canvas.height;
	this.setDirty(true,true);
}


LGraphCanvas.prototype.setCanvas = function(canvas)
{
	var that = this;

	//Canvas association
	if(typeof(canvas) == "string")
		canvas = document.getElementById(canvas);

	if(canvas == null)
		throw("Error creating LiteGraph canvas: Canvas not found");
	if(canvas == this.canvas) return;

	this.canvas = canvas;
	//this.canvas.tabindex = "1000";
	this.canvas.className += " lgraphcanvas";
	this.canvas.data = this;

	//bg canvas: used for non changing stuff
	this.bgcanvas = null;
	if(!this.bgcanvas)
	{
		this.bgcanvas = document.createElement("canvas");
		this.bgcanvas.width = this.canvas.width;
		this.bgcanvas.height = this.canvas.height;
	}

	if(this.canvas.getContext == null)
	{
		throw("This browser doesnt support Canvas");
	}

	this.ctx = this.canvas.getContext("2d");
	this.bgctx = this.bgcanvas.getContext("2d");

	//input:  (move and up could be unbinded)
	this._mousemove_callback = this.processMouseMove.bind(this);
	this._mouseup_callback = this.processMouseUp.bind(this);

	this.canvas.addEventListener("mousedown", this.processMouseDown.bind(this) ); //down do not need to store the binded
	this.canvas.addEventListener("mousemove", this._mousemove_callback);

	this.canvas.addEventListener("contextmenu", function(e) { e.preventDefault(); return false; });
	

	this.canvas.addEventListener("mousewheel", this.processMouseWheel.bind(this), false);
	this.canvas.addEventListener("DOMMouseScroll", this.processMouseWheel.bind(this), false);

	//touch events
	//if( 'touchstart' in document.documentElement )
	{
		//alert("doo");
		this.canvas.addEventListener("touchstart", this.touchHandler, true);
		this.canvas.addEventListener("touchmove", this.touchHandler, true);
		this.canvas.addEventListener("touchend", this.touchHandler, true);
		this.canvas.addEventListener("touchcancel", this.touchHandler, true);    
	}

	//this.canvas.onselectstart = function () { return false; };
	this.canvas.addEventListener("keydown", function(e) { 
		that.processKeyDown(e); 
	});

	this.canvas.addEventListener("keyup", function(e) { 
		that.processKeyUp(e); 
	});
}

/*
LGraphCanvas.prototype.UIinit = function()
{
	var that = this;
	$("#node-console input").change(function(e)
	{
		if(e.target.value == "")
			return;

		var node = that.node_in_panel;
		if(!node)
			return;
			
		node.trace("] " + e.target.value, "#333");
		if(node.onConsoleCommand)
		{
			if(!node.onConsoleCommand(e.target.value))
				node.trace("command not found", "#A33");
		}
		else if (e.target.value == "info")
		{
			node.trace("Special methods:");
			for(var i in node)
			{
				if(typeof(node[i]) == "function" && LGraphNode.prototype[i] == null && i.substr(0,2) != "on" && i[0] != "_")
					node.trace(" + " + i);
			}
		}
		else
		{
			try
			{
				eval("var _foo = function() { return ("+e.target.value+"); }");
				var result = _foo.call(node);
				if(result)
					node.trace(result.toString());
				delete window._foo;
			}
			catch(err)
			{
				node.trace("error: " + err, "#A33");
			}
		}
		
		this.value = "";
	});
}
*/

LGraphCanvas.prototype.setDirty = function(fgcanvas,bgcanvas)
{
	if(fgcanvas)
		this.dirty_canvas = true;
	if(bgcanvas)
		this.dirty_bgcanvas = true;
}

LGraphCanvas.prototype.startRendering = function()
{
	if(this.is_rendering) return; //already rendering

	this.is_rendering = true;
	renderFrame.call(this);

	function renderFrame()
	{
		if(!this.pause_rendering)
			this.draw();

		if(this.is_rendering)
			window.requestAnimFrame( renderFrame.bind(this) );
	}


	/*
	this.rendering_timer_id = setInterval( function() { 
		//trace("Frame: " + new Date().getTime() );
		that.draw(); 
	}, 1000/50);
	*/
}

LGraphCanvas.prototype.stopRendering = function()
{
	this.is_rendering = false;
	/*
	if(this.rendering_timer_id)
	{
		clearInterval(this.rendering_timer_id);
		this.rendering_timer_id = null;
	}
	*/
}

/* LiteGraphCanvas input */

LGraphCanvas.prototype.processMouseDown = function(e)
{
	if(!this.graph) return;

	this.adjustMouseEvent(e);
	
	this.canvas.removeEventListener("mousemove", this._mousemove_callback );
	document.addEventListener("mousemove", this._mousemove_callback );
	document.addEventListener("mouseup", this._mouseup_callback );

	var n = this.graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes);
	var skip_dragging = false;

	if(e.which == 1) //left button mouse
	{
		//another node selected
		if(!e.shiftKey) //REFACTOR: integrate with function
		{
			var todeselect = [];
			for(var i in this.selected_nodes)
				if (this.selected_nodes[i] != n)
						todeselect.push(this.selected_nodes[i]);
			//two passes to avoid problems modifying the container
			for(var i in todeselect)
				this.processNodeDeselected(todeselect[i]);
		}
		var clicking_canvas_bg = false;

		//when clicked on top of a node
		//and it is not interactive
		if(n) 
		{
			if(!this.live_mode && !n.flags.pinned)
				this.bringToFront(n); //if it wasnt selected?
			var skip_action = false;

			//not dragging mouse to connect two slots
			if(!this.connecting_node && !n.flags.collapsed && !this.live_mode)
			{
				//search for outputs
				if(n.outputs)
					for(var i = 0, l = n.outputs.length; i < l; ++i)
					{
						var output = n.outputs[i];
						var link_pos = n.getConnectionPos(false,i);
						if( isInsideRectangle(e.canvasX, e.canvasY, link_pos[0] - 10, link_pos[1] - 5, 20,10) )
						{
							this.connecting_node = n;
							this.connecting_output = output;
							this.connecting_pos = n.getConnectionPos(false,i);
							this.connecting_slot = i;

							skip_action = true;
							break;
						}
					}

				//search for inputs
				if(n.inputs)
					for(var i = 0, l = n.inputs.length; i < l; ++i)
					{
						var input = n.inputs[i];
						var link_pos = n.getConnectionPos(true,i);
						if( isInsideRectangle(e.canvasX, e.canvasY, link_pos[0] - 10, link_pos[1] - 5, 20,10) )
						{
							if(input.link)
							{
								n.disconnectInput(i);
								this.dirty_bgcanvas = true;
								skip_action = true;
							}
						}
					}

				//Search for corner
				if( !skip_action && isInsideRectangle(e.canvasX, e.canvasY, n.pos[0] + n.size[0] - 5, n.pos[1] + n.size[1] - 5 ,5,5 ))
				{
					this.resizing_node = n;
					this.canvas.style.cursor = "se-resize";
					skip_action = true;
				}
			}

			//it wasnt clicked on the links boxes
			if(!skip_action) 
			{
				var block_drag_node = false;

				//double clicking
				var now = new Date().getTime();
				if ((now - this.last_mouseclick) < 300 && this.selected_nodes[n.id])
				{
					//double click node
					if( n.onDblClick)
						n.onDblClick(e);
					this.processNodeDblClicked(n);
					block_drag_node = true;
				}

				//if do not capture mouse

				if( n.onMouseDown && n.onMouseDown(e) )
					block_drag_node = true;
				else if(this.live_mode)
				{
					clicking_canvas_bg = true;
					block_drag_node = true;
				}
				
				if(!block_drag_node)
				{
					if(this.allow_dragnodes)
						this.node_dragged = n;

					if(!this.selected_nodes[n.id])
						this.processNodeSelected(n,e);
				}

				this.dirty_canvas = true;
			}
		}
		else
			clicking_canvas_bg = true;

		if(clicking_canvas_bg && this.allow_dragcanvas)
		{
			this.dragging_canvas = true;
		}
	}
	else if (e.which == 2) //middle button
	{

	}
	else if (e.which == 3) //right button
	{
		this.processContextualMenu(n,e);
	}

	//TODO
	//if(this.node_selected != prev_selected)
	//	this.onNodeSelectionChange(this.node_selected);

	this.last_mouse[0] = e.localX;
	this.last_mouse[1] = e.localY;
	this.last_mouseclick = new Date().getTime();
	this.canvas_mouse = [e.canvasX, e.canvasY];

	/*
	if( (this.dirty_canvas || this.dirty_bgcanvas) && this.rendering_timer_id == null) 
		this.draw();
	*/

	this.graph.change();

	//this is to ensure to defocus(blur) if a text input element is on focus
	if(!document.activeElement || (document.activeElement.nodeName.toLowerCase() != "input" && document.activeElement.nodeName.toLowerCase() != "textarea"))
		e.preventDefault();
	e.stopPropagation();
	return false;
}

LGraphCanvas.prototype.processMouseMove = function(e)
{
	if(!this.graph) return;

	this.adjustMouseEvent(e);
	var mouse = [e.localX, e.localY];
	var delta = [mouse[0] - this.last_mouse[0], mouse[1] - this.last_mouse[1]];
	this.last_mouse = mouse;
	this.canvas_mouse = [e.canvasX, e.canvasY];

	if(this.dragging_canvas)
	{
		this.graph.config.canvas_offset[0] += delta[0] / this.graph.config.canvas_scale;
		this.graph.config.canvas_offset[1] += delta[1] / this.graph.config.canvas_scale;
		this.dirty_canvas = true;
		this.dirty_bgcanvas = true;
	}
	else
	{
		if(this.connecting_node)
			this.dirty_canvas = true;

		//get node over
		var n = this.graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes);

		//remove mouseover flag
		for(var i in this.graph.nodes)
		{
			if(this.graph.nodes[i].mouseOver && n != this.graph.nodes[i])
			{
				//mouse leave
				this.graph.nodes[i].mouseOver = false;
				if(this.node_over && this.node_over.onMouseLeave)
					this.node_over.onMouseLeave(e);
				this.node_over = null;
				this.dirty_canvas = true;
			}
		}

		//mouse over a node
		if(n)
		{
			//this.canvas.style.cursor = "move";
			if(!n.mouseOver)
			{
				//mouse enter
				n.mouseOver = true;
				this.node_over = n;
				this.dirty_canvas = true;

				if(n.onMouseEnter) n.onMouseEnter(e);
			}

			if(n.onMouseMove) n.onMouseMove(e);

			//ontop of input
			if(this.connecting_node)
			{
				var pos = this._highlight_input || [0,0];
				var slot = this.isOverNodeInput(n, e.canvasX, e.canvasY, pos);
				if(slot != -1 && n.inputs[slot])
				{	
					var slot_type = n.inputs[slot].type;
					if(slot_type == this.connecting_output.type || slot_type == "*" || this.connecting_output.type == "*")
						this._highlight_input = pos;
				}
				else
					this._highlight_input = null;
			}

			//Search for corner
			if( isInsideRectangle(e.canvasX, e.canvasY, n.pos[0] + n.size[0] - 5, n.pos[1] + n.size[1] - 5 ,5,5 ))
				this.canvas.style.cursor = "se-resize";
			else
				this.canvas.style.cursor = null;
		}
		else
			this.canvas.style.cursor = null;

		if(this.node_capturing_input && this.node_capturing_input != n && this.node_capturing_input.onMouseMove)
		{
			this.node_capturing_input.onMouseMove(e);
		}


		if(this.node_dragged && !this.live_mode)
		{
			/*
			this.node_dragged.pos[0] += delta[0] / this.graph.config.canvas_scale;
			this.node_dragged.pos[1] += delta[1] / this.graph.config.canvas_scale;
			this.node_dragged.pos[0] = Math.round(this.node_dragged.pos[0]);
			this.node_dragged.pos[1] = Math.round(this.node_dragged.pos[1]);
			*/
			
			for(var i in this.selected_nodes)
			{
				var n = this.selected_nodes[i];
				
				n.pos[0] += delta[0] / this.graph.config.canvas_scale;
				n.pos[1] += delta[1] / this.graph.config.canvas_scale;
				n.pos[0] = Math.round(n.pos[0]);
				n.pos[1] = Math.round(n.pos[1]);
			}
			
			this.dirty_canvas = true;
			this.dirty_bgcanvas = true;
		}

		if(this.resizing_node && !this.live_mode)
		{
			this.resizing_node.size[0] += delta[0] / this.graph.config.canvas_scale;
			this.resizing_node.size[1] += delta[1] / this.graph.config.canvas_scale;
			var max_slots = Math.max( this.resizing_node.inputs ? this.resizing_node.inputs.length : 0, this.resizing_node.outputs ? this.resizing_node.outputs.length : 0);
			if(this.resizing_node.size[1] < max_slots * LiteGraph.NODE_SLOT_HEIGHT + 4)
				this.resizing_node.size[1] = max_slots * LiteGraph.NODE_SLOT_HEIGHT + 4;
			if(this.resizing_node.size[0] < LiteGraph.NODE_MIN_WIDTH)
				this.resizing_node.size[0] = LiteGraph.NODE_MIN_WIDTH;

			this.canvas.style.cursor = "se-resize";
			this.dirty_canvas = true;
			this.dirty_bgcanvas = true;
		}
	}

	/*
	if((this.dirty_canvas || this.dirty_bgcanvas) && this.rendering_timer_id == null) 
		this.draw();
	*/

	e.preventDefault();
	e.stopPropagation();
	return false;
	//this is not really optimal
	//this.graph.change();
}

LGraphCanvas.prototype.processMouseUp = function(e)
{
	if(!this.graph) return;

	document.removeEventListener("mousemove", this._mousemove_callback, true );
	this.canvas.addEventListener("mousemove", this._mousemove_callback, true);
	document.removeEventListener("mouseup", this._mouseup_callback, true );

	this.adjustMouseEvent(e);

	if (e.which == 1) //left button
	{
		//dragging a connection
		if(this.connecting_node)
		{
			this.dirty_canvas = true;
			this.dirty_bgcanvas = true;

			var node = this.graph.getNodeOnPos(e.canvasX, e.canvasY, this.visible_nodes);

			//node below mouse
			if(node)
			{
			
				if(this.connecting_output.type == 'node')
				{
					this.connecting_node.connect(this.connecting_slot, node, -1);
				}
				else
				{
					//slot below mouse? connect
					var slot = this.isOverNodeInput(node, e.canvasX, e.canvasY);
					if(slot != -1)
					{
						this.connecting_node.connect(this.connecting_slot, node, slot);
					}
				}
			}

			this.connecting_output = null;
			this.connecting_pos = null;
			this.connecting_node = null;
			this.connecting_slot = -1;

		}//not dragging connection
		else if(this.resizing_node)
		{
			this.dirty_canvas = true;
			this.dirty_bgcanvas = true;
			this.resizing_node = null;
		}
		else if(this.node_dragged) //node being dragged?
		{
			this.dirty_canvas = true;
			this.dirty_bgcanvas = true;

			if(this.graph.config.align_to_grid)
				this.node_dragged.alignToGrid();
			this.node_dragged = null;
		}
		else //no node being dragged
		{
			this.dirty_canvas = true;
			this.dragging_canvas = false;

			if( this.node_over && this.node_over.onMouseUp )
				this.node_over.onMouseUp(e);
			if( this.node_capturing_input && this.node_capturing_input.onMouseUp )
				this.node_capturing_input.onMouseUp(e);
		}
	}
	else if (e.which == 2) //middle button
	{
		//trace("middle");
		this.dirty_canvas = true;
		this.dragging_canvas = false;
	}
	else if (e.which == 3) //right button
	{
		//trace("right");
		this.dirty_canvas = true;
		this.dragging_canvas = false;
	}

	/*
	if((this.dirty_canvas || this.dirty_bgcanvas) && this.rendering_timer_id == null)
		this.draw();
	*/

	this.graph.change();

	e.stopPropagation();
	e.preventDefault();
	return false;
}

LGraphCanvas.prototype.isOverNodeInput = function(node, canvasx, canvasy, slot_pos)
{
	if(node.inputs)
		for(var i = 0, l = node.inputs.length; i < l; ++i)
		{
			var input = node.inputs[i];
			var link_pos = node.getConnectionPos(true,i);
			if( isInsideRectangle(canvasx, canvasy, link_pos[0] - 10, link_pos[1] - 5, 20,10) )
			{
				if(slot_pos) { slot_pos[0] = link_pos[0]; slot_pos[1] = link_pos[1] };
				return i;
			}
		}
	return -1;
}

LGraphCanvas.prototype.processKeyDown = function(e) 
{
	if(!this.graph) return;
	var block_default = false;

	//select all Control A
	if(e.keyCode == 65 && e.ctrlKey)
	{
		this.selectAllNodes();
		block_default = true;
	}

	//delete or backspace
	if(e.keyCode == 46 || e.keyCode == 8)
	{
		this.deleteSelectedNodes();
	}

	//collapse
	//...

	//TODO
	if(this.selected_nodes) 
		for (var i in this.selected_nodes)
			if(this.selected_nodes[i].onKeyDown)
				this.selected_nodes[i].onKeyDown(e);

	this.graph.change();

	if(block_default)
	{
		e.preventDefault();
		return false;
	}
}

LGraphCanvas.prototype.processKeyUp = function(e) 
{
	if(!this.graph) return;
	//TODO
	if(this.selected_nodes)
		for (var i in this.selected_nodes)
			if(this.selected_nodes[i].onKeyUp)
				this.selected_nodes[i].onKeyUp(e);

	this.graph.change();
}

LGraphCanvas.prototype.processMouseWheel = function(e) 
{
	if(!this.graph) return;
	if(!this.allow_dragcanvas) return;

	var delta = (e.wheelDeltaY != null ? e.wheelDeltaY : e.detail * -60);

	this.adjustMouseEvent(e);

	var zoom = this.graph.config.canvas_scale;

	if (delta > 0)
		zoom *= 1.1;
	else if (delta < 0)
		zoom *= 1/(1.1);

	this.setZoom( zoom, [ e.localX, e.localY ] );

	/*
	if(this.rendering_timer_id == null)
		this.draw();
	*/

	this.graph.change();

	e.preventDefault();
	return false; // prevent default
}

LGraphCanvas.prototype.processNodeSelected = function(n,e)
{
	n.selected = true;
	if (n.onSelected)
		n.onSelected();
		
	if(e && e.shiftKey) //add to selection
		this.selected_nodes[n.id] = n;
	else
	{
		this.selected_nodes = {};
		this.selected_nodes[ n.id ] = n;
	}
		
	this.dirty_canvas = true;

	if(this.onNodeSelected)
		this.onNodeSelected(n);

	//if(this.node_in_panel) this.showNodePanel(n);
}

LGraphCanvas.prototype.processNodeDeselected = function(n)
{
	n.selected = false;
	if(n.onDeselected)
		n.onDeselected();
		
	delete this.selected_nodes[n.id];

	if(this.onNodeDeselected)
		this.onNodeDeselected();

	this.dirty_canvas = true;

	//this.showNodePanel(null);
}

LGraphCanvas.prototype.processNodeDblClicked = function(n)
{
	if(this.onShowNodePanel)
		this.onShowNodePanel(n);

	if(this.onNodeDblClicked)
		this.onNodeDblClicked(n);

	this.setDirty(true);
}

LGraphCanvas.prototype.selectNode = function(node)
{
	this.deselectAllNodes();

	if(!node)
		return;

	if(!node.selected && node.onSelected)
		node.onSelected();
	node.selected = true;
	this.selected_nodes[ node.id ] = node;
	this.setDirty(true);
}

LGraphCanvas.prototype.selectAllNodes = function()
{
	for(var i in this.graph.nodes)
	{
		var n = this.graph.nodes[i];
		if(!n.selected && n.onSelected)
			n.onSelected();
		n.selected = true;
		this.selected_nodes[this.graph.nodes[i].id] = n;
	}

	this.setDirty(true);
}

LGraphCanvas.prototype.deselectAllNodes = function()
{
	for(var i in this.selected_nodes)
	{
		var n = this.selected_nodes;
		if(n.onDeselected)
			n.onDeselected();
		n.selected = false;
	}
	this.selected_nodes = {};
	this.setDirty(true);
}

LGraphCanvas.prototype.deleteSelectedNodes = function()
{
	for(var i in this.selected_nodes)
	{
		var m = this.selected_nodes[i];
		//if(m == this.node_in_panel) this.showNodePanel(null);
		this.graph.remove(m);
	}
	this.selected_nodes = {};
	this.setDirty(true);
}

LGraphCanvas.prototype.centerOnNode = function(node)
{
	this.graph.config.canvas_offset[0] = -node.pos[0] - node.size[0] * 0.5 + (this.canvas.width * 0.5 / this.graph.config.canvas_scale);
	this.graph.config.canvas_offset[1] = -node.pos[1] - node.size[1] * 0.5 + (this.canvas.height * 0.5 / this.graph.config.canvas_scale);
	this.setDirty(true,true);
}

LGraphCanvas.prototype.adjustMouseEvent = function(e)
{
	var b = this.canvas.getBoundingClientRect();
	e.localX = e.pageX - b.left;
	e.localY = e.pageY - b.top;

	e.canvasX = e.localX / this.graph.config.canvas_scale - this.graph.config.canvas_offset[0];
	e.canvasY = e.localY / this.graph.config.canvas_scale - this.graph.config.canvas_offset[1];
}

LGraphCanvas.prototype.setZoom = function(value, zooming_center)
{
	if(!zooming_center)
		zooming_center = [this.canvas.width * 0.5,this.canvas.height * 0.5];

	var center = this.convertOffsetToCanvas( zooming_center );

	this.graph.config.canvas_scale = value;

	if(this.graph.config.canvas_scale > 4)
		this.graph.config.canvas_scale = 4;
	else if(this.graph.config.canvas_scale < 0.1)
		this.graph.config.canvas_scale = 0.1;
	
	var new_center = this.convertOffsetToCanvas( zooming_center );
	var delta_offset = [new_center[0] - center[0], new_center[1] - center[1]];

	this.graph.config.canvas_offset[0] += delta_offset[0];
	this.graph.config.canvas_offset[1] += delta_offset[1];

	this.dirty_canvas = true;
	this.dirty_bgcanvas = true;
}

LGraphCanvas.prototype.convertOffsetToCanvas = function(pos)
{
	return [pos[0] / this.graph.config.canvas_scale - this.graph.config.canvas_offset[0], pos[1] / this.graph.config.canvas_scale - this.graph.config.canvas_offset[1]];
}

LGraphCanvas.prototype.convertCanvasToOffset = function(pos)
{
	return [(pos[0] + this.graph.config.canvas_offset[0]) * this.graph.config.canvas_scale, 
		(pos[1] + this.graph.config.canvas_offset[1]) * this.graph.config.canvas_scale ];
}

LGraphCanvas.prototype.convertEventToCanvas = function(e)
{
	var rect = this.canvas.getClientRects()[0];
	return this.convertOffsetToCanvas([e.pageX - rect.left,e.pageY - rect.top]);
}

LGraphCanvas.prototype.bringToFront = function(n)
{
	var i = this.graph.nodes.indexOf(n);
	if(i == -1) return;
	
	this.graph.nodes.splice(i,1);
	this.graph.nodes.push(n);
}

LGraphCanvas.prototype.sendToBack = function(n)
{
	var i = this.graph.nodes.indexOf(n);
	if(i == -1) return;
	
	this.graph.nodes.splice(i,1);
	this.graph.nodes.unshift(n);
}
	
/* Interaction */



/* LGraphCanvas render */

LGraphCanvas.prototype.computeVisibleNodes = function()
{
	var visible_nodes = [];
	for (var i in this.graph.nodes)
	{
		var n = this.graph.nodes[i];

		//skip rendering nodes in live mode
		if(this.live_mode && !n.onDrawBackground && !n.onDrawForeground)
			continue;

		if(!overlapBounding(this.visible_area, n.getBounding() ))
			continue; //out of the visible area

		visible_nodes.push(n);
	}
	return visible_nodes;
}

LGraphCanvas.prototype.draw = function(force_canvas, force_bgcanvas)
{
	//fps counting
	var now = new Date().getTime();
	this.render_time = (now - this.last_draw_time)*0.001;
	this.last_draw_time = now;

	if(this.graph)
	{
		var start = [-this.graph.config.canvas_offset[0], -this.graph.config.canvas_offset[1] ];
		var end = [start[0] + this.canvas.width / this.graph.config.canvas_scale, start[1] + this.canvas.height / this.graph.config.canvas_scale];
		this.visible_area = new Float32Array([start[0],start[1],end[0],end[1]]);
	}

	if(this.dirty_bgcanvas || force_bgcanvas)
		this.drawBgcanvas();

	if(this.dirty_canvas || force_canvas)
		this.drawFrontCanvas();

	this.fps = this.render_time ? (1.0 / this.render_time) : 0;
	this.frame += 1;
}

LGraphCanvas.prototype.drawFrontCanvas = function()
{
	var ctx = this.ctx;
	var canvas = this.canvas;

	//reset in case of error
	ctx.restore();
	ctx.setTransform(1, 0, 0, 1, 0, 0);

	//clip dirty area if there is one, otherwise work in full canvas
	if(this.dirty_area)
	{
		ctx.save();
		ctx.beginPath();
		ctx.rect(this.dirty_area[0],this.dirty_area[1],this.dirty_area[2],this.dirty_area[3]);
		ctx.clip();
	}

	//clear
	//canvas.width = canvas.width;
	ctx.clearRect(0,0,canvas.width, canvas.height);

	//draw bg canvas
	ctx.drawImage(this.bgcanvas,0,0);

	//info widget
	if(this.show_info)
	{
		ctx.font = "10px Arial";
		ctx.fillStyle = "#888";
		if(this.graph)
		{
			ctx.fillText( "T: " + this.graph.globaltime.toFixed(2)+"s",5,13*1 );
			ctx.fillText( "I: " + this.graph.iteration,5,13*2 );
			ctx.fillText( "F: " + this.frame,5,13*3 );
			ctx.fillText( "FPS:" + this.fps.toFixed(2),5,13*4 );
		}
		else
			ctx.fillText( "No graph selected",5,13*1 );
	}

	if(this.graph)
	{
		//apply transformations
		ctx.save();
		ctx.scale(this.graph.config.canvas_scale,this.graph.config.canvas_scale);
		ctx.translate(this.graph.config.canvas_offset[0],this.graph.config.canvas_offset[1]);

		//draw nodes
		var drawn_nodes = 0;
		var visible_nodes = this.computeVisibleNodes();
		this.visible_nodes = visible_nodes;

		for (var i in visible_nodes)
		{
			var n = visible_nodes[i];

			//transform coords system
			ctx.save();
			ctx.translate( n.pos[0], n.pos[1] );

			//Draw
			n.draw(ctx,this);
			drawn_nodes += 1;

			//Restore
			ctx.restore();
		}
		
		//connections ontop?
		if(this.graph.config.links_ontop)
			if(!this.live_mode)
				this.drawConnections(ctx);

		//current connection
		if(this.connecting_pos != null)
		{
			ctx.lineWidth = LGraphCanvas.link_width;
			ctx.fillStyle = this.connecting_output.type == 'node' ? "#F85" : "#AFA";
			ctx.strokeStyle = ctx.fillStyle;
			this.renderLink(ctx, this.connecting_pos, [this.canvas_mouse[0],this.canvas_mouse[1]] );

			ctx.beginPath();
			ctx.arc( this.connecting_pos[0], this.connecting_pos[1],4,0,Math.PI*2);
			/*
			if( this.connecting_output.round)
				ctx.arc( this.connecting_pos[0], this.connecting_pos[1],4,0,Math.PI*2);
			else
				ctx.rect( this.connecting_pos[0], this.connecting_pos[1],12,6);
			*/
			ctx.fill();

			ctx.fillStyle = "#ffcc00";
			if(this._highlight_input)
			{
				ctx.beginPath();
				ctx.arc( this._highlight_input[0], this._highlight_input[1],6,0,Math.PI*2);
				ctx.fill();
			}
		}
		ctx.restore();
	}

	if(this.dirty_area)
	{
		ctx.restore();
		//this.dirty_area = null;
	}

	this.dirty_canvas = false;
}

LGraphCanvas.prototype.drawBgcanvas = function()
{
	var canvas = this.bgcanvas;
	var ctx = this.bgctx;


	//clear
	canvas.width = canvas.width;

	//reset in case of error
	ctx.restore();
	ctx.setTransform(1, 0, 0, 1, 0, 0);

	if(this.graph)
	{
		//apply transformations
		ctx.save();
		ctx.scale(this.graph.config.canvas_scale,this.graph.config.canvas_scale);
		ctx.translate(this.graph.config.canvas_offset[0],this.graph.config.canvas_offset[1]);

		//render BG
		if(this.background_image && this.graph.config.canvas_scale > 0.5)
		{
			ctx.globalAlpha = 1.0 - 0.5 / this.graph.config.canvas_scale;
			ctx.webkitImageSmoothingEnabled = ctx.mozImageSmoothingEnabled = ctx.imageSmoothingEnabled = false
			if(!this._bg_img || this._bg_img.name != this.background_image)
			{
				this._bg_img = new Image();
				this._bg_img.name = this.background_image; 
				this._bg_img.src = this.background_image;
				var that = this;
				this._bg_img.onload = function() { 
					that.draw(true,true);
				}
			}

			var pattern = null;
			if(this._bg_img != this._pattern_img && this._bg_img.width > 0)
			{
				pattern = ctx.createPattern( this._bg_img, 'repeat' );
				this._pattern_img = this._bg_img;
				this._pattern = pattern;
			}
			else
				pattern = this._pattern;
			if(pattern)
			{
				ctx.fillStyle = pattern;
				ctx.fillRect(this.visible_area[0],this.visible_area[1],this.visible_area[2]-this.visible_area[0],this.visible_area[3]-this.visible_area[1]);
				ctx.fillStyle = "transparent";
			}

			ctx.globalAlpha = 1.0;
		}

		//DEBUG: show clipping area
		//ctx.fillStyle = "red";
		//ctx.fillRect( this.visible_area[0] + 10, this.visible_area[1] + 10, this.visible_area[2] - this.visible_area[0] - 20, this.visible_area[3] - this.visible_area[1] - 20);

		//bg
		ctx.strokeStyle = "#235";
		ctx.strokeRect(0,0,canvas.width,canvas.height);

		/*
		if(this.render_shadows)
		{
			ctx.shadowColor = "#000";
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.shadowBlur = 6;
		}
		else
			ctx.shadowColor = "rgba(0,0,0,0)";
		*/

		//draw connections
		if(!this.live_mode)
			this.drawConnections(ctx);

		//restore state
		ctx.restore();
	}

	this.dirty_bgcanvas = false;
	this.dirty_canvas = true; //to force to repaint the front canvas with the bgcanvas 
}

LGraphCanvas.link_colors = ["#AAC","#ACA","#CAA"];

LGraphCanvas.prototype.drawConnections = function(ctx)
{
	//draw connections
	ctx.lineWidth = LGraphCanvas.link_width;

	ctx.fillStyle = "#AAA";
	ctx.strokeStyle = "#AAA";
	//for every node
	for (var n in this.graph.nodes)
	{
		var node = this.graph.nodes[n];
		//for every input (we render just inputs because it is easier as every slot can only have one input)
		if(node.inputs && node.inputs.length)
			for(var i in node.inputs)
			{
				var input = node.inputs[i];
				if(!input || !input.link ) continue;
				var link = input.link;

				var start_node = this.graph.getNodeById( link[1] );
				if(start_node == null) continue;
				var start_node_slot = link[2];
				var start_node_slotpos = null;

				if(start_node_slot == -1)
					start_node_slotpos = [start_node.pos[0] + 10, start_node.pos[1] + 10];
				else
					start_node_slotpos = start_node.getConnectionPos(false, start_node_slot);

				var color = LGraphCanvas.link_type_colors[node.inputs[i].type];
				if(color == null)
					color = LGraphCanvas.link_colors[node.id % LGraphCanvas.link_colors.length];
				ctx.fillStyle = ctx.strokeStyle = color;
				this.renderLink(ctx, start_node_slotpos, node.getConnectionPos(true,i) );
			}
	}
}

LGraphCanvas.prototype.renderLink = function(ctx,a,b)
{
	var curved_lines = true;
	
	if(!this.highquality_render)
	{
		ctx.beginPath();
		ctx.moveTo(a[0],a[1]);
		ctx.lineTo(b[0],b[1]);
		ctx.stroke();
		return;
	}

	var dist = distance(a,b);

	ctx.beginPath();
	
	if(curved_lines)
	{
		ctx.moveTo(a[0],a[1]);
		ctx.bezierCurveTo(a[0] + dist*0.25, a[1],
							b[0] - dist*0.25 , b[1],
							b[0] ,b[1] );
	}
	else
	{
		ctx.moveTo(a[0]+10,a[1]);
		ctx.lineTo(((a[0]+10) + (b[0]-10))*0.5,a[1]);
		ctx.lineTo(((a[0]+10) + (b[0]-10))*0.5,b[1]);
		ctx.lineTo(b[0]-10,b[1]);
	}
	ctx.stroke();

	//render arrow
	if(this.graph.config.canvas_scale > 0.6)
	{
		//get two points in the bezier curve
		var pos = this.computeConnectionPoint(a,b,0.5);
		var pos2 = this.computeConnectionPoint(a,b,0.51);
		var angle = 0;
		if(curved_lines)
			angle = -Math.atan2( pos2[0] - pos[0], pos2[1] - pos[1]);
		else
			angle = b[1] > a[1] ? 0 : Math.PI;

		ctx.save();
		ctx.translate(pos[0],pos[1]);
		ctx.rotate(angle);
		ctx.beginPath();
		ctx.moveTo(-5,-5);
		ctx.lineTo(0,+5);
		ctx.lineTo(+5,-5);
		ctx.fill();
		ctx.restore();
	}
}

LGraphCanvas.prototype.computeConnectionPoint = function(a,b,t)
{
	var dist = distance(a,b);
	var p0 = a;
	var p1 = [ a[0] + dist*0.25, a[1] ];
	var p2 = [ b[0] - dist*0.25, b[1] ];
	var p3 = b;

	var c1 = (1-t)*(1-t)*(1-t);
	var c2 = 3*((1-t)*(1-t))*t;
	var c3 = 3*(1-t)*(t*t);
	var c4 = t*t*t;

	var x = c1*p0[0] + c2*p1[0] + c3*p2[0] + c4*p3[0];
	var y = c1*p0[1] + c2*p1[1] + c3*p2[1] + c4*p3[1];
	return [x,y];
}

LGraphCanvas.prototype.resizeCanvas = function(width,height)
{
	this.canvas.width = width;
	if(height)
		this.canvas.height = height;

	this.bgcanvas.width = this.canvas.width;
	this.bgcanvas.height = this.canvas.height;
	this.draw(true,true);
}

LGraphCanvas.prototype.switchLiveMode = function()
{
	this.live_mode = !this.live_mode;
	this.dirty_canvas = true;
	this.dirty_bgcanvas = true;
}

LGraphCanvas.prototype.onNodeSelectionChange = function(node)
{
	return; //disabled
	//if(this.node_in_panel) this.showNodePanel(node);
}

LGraphCanvas.prototype.touchHandler = function(event)
{
	//alert("foo");
    var touches = event.changedTouches,
        first = touches[0],
        type = "";

         switch(event.type)
    {
        case "touchstart": type = "mousedown"; break;
        case "touchmove":  type="mousemove"; break;        
        case "touchend":   type="mouseup"; break;
        default: return;
    }

             //initMouseEvent(type, canBubble, cancelable, view, clickCount,
    //           screenX, screenY, clientX, clientY, ctrlKey,
    //           altKey, shiftKey, metaKey, button, relatedTarget);
    
    var simulatedEvent = document.createEvent("MouseEvent");
    simulatedEvent.initMouseEvent(type, true, true, window, 1,
                              first.screenX, first.screenY,
                              first.clientX, first.clientY, false,
                              false, false, false, 0/*left*/, null);
	first.target.dispatchEvent(simulatedEvent);
    event.preventDefault();
}

/* CONTEXT MENU ********************/

LGraphCanvas.onMenuAdd = function(node, e, prev_menu, canvas, first_event )
{
	var values = LiteGraph.getNodeTypesCategories();
	var entries = {};
	for(var i in values)
		if(values[i])
			entries[ i ] = { value: values[i], content: values[i]  , is_menu: true };

	var menu = LiteGraph.createContextualMenu(entries, {event: e, callback: inner_clicked, from: prev_menu});

	function inner_clicked(v, e)
	{
		var category = v.value;
		var node_types = LiteGraph.getNodeTypesInCategory(category);
		var values = [];
		for(var i in node_types)
			values.push( { content: node_types[i].title, value: node_types[i].type });

		LiteGraph.createContextualMenu(values, {event: e, callback: inner_create, from: menu});
		return false;
	}

	function inner_create(v, e)
	{
		var node = LiteGraph.createNode( v.value );
		if(node)
		{
			node.pos = canvas.convertEventToCanvas(first_event);
			canvas.graph.add( node );
		}
	}

	return false;
}

LGraphCanvas.onMenuCollapseAll = function()
{

}


LGraphCanvas.onMenuNodeEdit = function()
{

}

LGraphCanvas.onMenuNodeInputs = function(node, e, prev_menu)
{
	if(!node) return;

	var options = node.optional_inputs;
	if(node.onGetInputs)
		options = node.onGetInputs();
	if(options)
	{
		var entries = [];
		for (var i in options)
		{
			var option = options[i];
			var label = option[0];
			if(option[2] && option[2].label)
				label = option[2].label;
			entries.push({content: label, value: option});
		}
		var menu = LiteGraph.createContextualMenu(entries, {event: e, callback: inner_clicked, from: prev_menu});
	}

	function inner_clicked(v)
	{
		if(!node) return;
		node.addInput(v.value[0],v.value[1], v.value[2]);
	}

	return false;
}

LGraphCanvas.onMenuNodeOutputs = function(node, e, prev_menu)
{
	if(!node) return;

	var options = node.optional_outputs;
	if(node.onGetOutputs)
		options = node.onGetOutputs();
	if(options)
	{
		var entries = [];
		for (var i in options)
		{
			if(node.findOutputSlot(options[i][0]) != -1)
				continue; //skip the ones already on
			entries.push({content: options[i][0], value: options[i]});
		}
		if(entries.length)
			var menu = LiteGraph.createContextualMenu(entries, {event: e, callback: inner_clicked, from: prev_menu});
	}

	function inner_clicked(v)
	{
		if(!node) return;
		node.addOutput(v.value[0],v.value[1]);
	}

	return false;
}

LGraphCanvas.onMenuNodeCollapse = function(node)
{
	node.flags.collapsed = !node.flags.collapsed;
	node.graph.canvas.setDirty(true,true);
}

LGraphCanvas.onMenuNodeColors = function(node, e, prev_menu)
{
	var values = [];
	for(var i in LGraphCanvas.node_colors)
	{
		var color = LGraphCanvas.node_colors[i];
		var value = {value:i, content:"<span style='display: block; color:"+color.color+"; background-color:"+color.bgcolor+"'>"+i+"</span>"};
		values.push(value);
	}
	LiteGraph.createContextualMenu(values, {event: e, callback: inner_clicked, from: prev_menu});

	function inner_clicked(v)
	{
		if(!node) return;
		var color = LGraphCanvas.node_colors[v.value];
		if(color)
		{
			node.color = color.color;
			node.bgcolor = color.bgcolor;
			node.graph.canvas.setDirty(true);
		}
	}

	return false;
}

LGraphCanvas.onMenuNodeShapes = function(node,e)
{
	LiteGraph.createContextualMenu(["box","round","circle"], {event: e, callback: inner_clicked});

	function inner_clicked(v)
	{
		if(!node) return;
		node.shape = v;
		node.graph.canvas.setDirty(true);
	}

	return false;
}

LGraphCanvas.onMenuNodeRemove = function(node)
{
	if(node.removable == false) return;
	node.graph.remove(node);
	node.graph.canvas.setDirty(true,true);
}

LGraphCanvas.onMenuNodeClone = function(node)
{
	if(node.clonable == false) return;
	var newnode = node.clone();
	if(!newnode) return;
	newnode.pos = [node.pos[0]+5,node.pos[1]+5];
	node.graph.add(newnode);
	node.graph.canvas.setDirty(true,true);
}

LGraphCanvas.node_colors = {
	"red": { color:"#FAA", bgcolor:"#A44" },
	"green": { color:"#AFA", bgcolor:"#4A4" },
	"blue": { color:"#AAF", bgcolor:"#44A" },
	"white": { color:"#FFF", bgcolor:"#AAA" }
};

LGraphCanvas.prototype.getCanvasMenuOptions = function()
{
	return [
		{content:"Add Node", is_menu: true, callback: LGraphCanvas.onMenuAdd }
		//{content:"Collapse All", callback: LGraphCanvas.onMenuCollapseAll }
	];
}

LGraphCanvas.prototype.getNodeMenuOptions = function(node)
{
	var options = [
		{content:"Inputs", is_menu: true, disabled:true, callback: LGraphCanvas.onMenuNodeInputs },
		{content:"Outputs", is_menu: true, disabled:true, callback: LGraphCanvas.onMenuNodeOutputs },
		null,
		{content:"Collapse", callback: LGraphCanvas.onMenuNodeCollapse },
		{content:"Colors", is_menu: true, callback: LGraphCanvas.onMenuNodeColors },
		{content:"Shapes", is_menu: true, callback: LGraphCanvas.onMenuNodeShapes },
		null,
		{content:"Clone", callback: LGraphCanvas.onMenuNodeClone },
		null,
		{content:"Remove", callback: LGraphCanvas.onMenuNodeRemove }
	];

	if( node.clonable == false )
		options[7].disabled = true;
	if( node.removable == false )
		options[9].disabled = true;

	if(node.onGetInputs && node.onGetInputs().length )
		options[0].disabled = false;
	if(node.onGetOutputs && node.onGetOutputs().length )
		options[1].disabled = false;

	return options;
}

LGraphCanvas.prototype.processContextualMenu = function(node,event)
{
	var that = this;
	var menu = LiteGraph.createContextualMenu(node ? this.getNodeMenuOptions(node) : this.getCanvasMenuOptions(), {event: event, callback: inner_option_clicked});

	function inner_option_clicked(v,e)
	{
		if(!v) return;

		if(v.callback)
			return v.callback(node, e, menu, that, event );
	}
}






//API *************************************************
//function roundRect(ctx, x, y, width, height, radius, radius_low) {
CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius, radius_low) {
  if ( radius === undefined ) {
    radius = 5;
  }

  if(radius_low === undefined)
	 radius_low  = radius;

  this.beginPath();
  this.moveTo(x + radius, y);
  this.lineTo(x + width - radius, y);
  this.quadraticCurveTo(x + width, y, x + width, y + radius);

  this.lineTo(x + width, y + height - radius_low);
  this.quadraticCurveTo(x + width, y + height, x + width - radius_low, y + height);
  this.lineTo(x + radius_low, y + height);
  this.quadraticCurveTo(x, y + height, x, y + height - radius_low);
  this.lineTo(x, y + radius);
  this.quadraticCurveTo(x, y, x + radius, y);
}

function compareObjects(a,b)
{
	for(var i in a)
		if(a[i] != b[i])
			return false;
	return true;
}

function distance(a,b)
{
	return Math.sqrt( (b[0] - a[0]) * (b[0] - a[0]) + (b[1] - a[1]) * (b[1] - a[1]) );
}

function colorToString(c)
{
	return "rgba(" + Math.round(c[0] * 255).toFixed() + "," + Math.round(c[1] * 255).toFixed() + "," + Math.round(c[2] * 255).toFixed() + "," + (c.length == 4 ? c[3].toFixed(2) : "1.0") + ")";
}

function isInsideRectangle(x,y, left, top, width, height)
{
	if (left < x && (left + width) > x &&
		top < y && (top + height) > y)
		return true;	
	return false;
}

//[minx,miny,maxx,maxy]
function growBounding(bounding, x,y)
{
	if(x < bounding[0])
		bounding[0] = x;
	else if(x > bounding[2])
		bounding[2] = x;

	if(y < bounding[1])
		bounding[1] = y;
	else if(y > bounding[3])
		bounding[3] = y;
}

//point inside boundin box
function isInsideBounding(p,bb)
{
	if (p[0] < bb[0][0] || 
		p[1] < bb[0][1] || 
		p[0] > bb[1][0] || 
		p[1] > bb[1][1])
		return false;
	return true;
}

//boundings overlap, format: [start,end]
function overlapBounding(a,b)
{
	if ( a[0] > b[2] ||
		a[1] > b[3] ||
		a[2] < b[0] ||
		a[3] < b[1])
		return false;
	return true;
}

//Convert a hex value to its decimal value - the inputted hex must be in the
//	format of a hex triplet - the kind we use for HTML colours. The function
//	will return an array with three values.
function hex2num(hex) {
	if(hex.charAt(0) == "#") hex = hex.slice(1); //Remove the '#' char - if there is one.
	hex = hex.toUpperCase();
	var hex_alphabets = "0123456789ABCDEF";
	var value = new Array(3);
	var k = 0;
	var int1,int2;
	for(var i=0;i<6;i+=2) {
		int1 = hex_alphabets.indexOf(hex.charAt(i));
		int2 = hex_alphabets.indexOf(hex.charAt(i+1)); 
		value[k] = (int1 * 16) + int2;
		k++;
	}
	return(value);
}
//Give a array with three values as the argument and the function will return
//	the corresponding hex triplet.
function num2hex(triplet) {
	var hex_alphabets = "0123456789ABCDEF";
	var hex = "#";
	var int1,int2;
	for(var i=0;i<3;i++) {
		int1 = triplet[i] / 16;
		int2 = triplet[i] % 16;

		hex += hex_alphabets.charAt(int1) + hex_alphabets.charAt(int2); 
	}
	return(hex);
}

/* LiteGraph GUI elements *************************************/

LiteGraph.createContextualMenu = function(values,options)
{
	options = options || {};
	this.options = options;

	if(!options.from)
		LiteGraph.closeAllContextualMenus();

	var root = document.createElement("div");
	root.className = "litecontextualmenu litemenubar-panel";
	this.root = root;
	var style = root.style;

	style.minWidth = "100px";
	style.minHeight = "20px";

	style.position = "fixed";
	style.top = "100px";
	style.left = "100px";
	style.color = "#AAF";
	style.padding = "2px";
	style.borderBottom = "2px solid #AAF";
	style.backgroundColor = "#444";

	//avoid a context menu in a context menu
	root.addEventListener("contextmenu", function(e) { e.preventDefault(); return false; });

	for(var i in values)
	{
		var item = values[i];
		var element = document.createElement("div");
		element.className = "litemenu-entry";

		if(item == null)
		{
			element.className = "litemenu-entry separator";
			root.appendChild(element);
			continue;
		}

		if(item.is_menu)
			element.className += " submenu";

		if(item.disabled)
			element.className += " disabled";

		element.style.cursor = "pointer";
		element.dataset["value"] = typeof(item) == "string" ? item : item.value;
		element.data = item;
		if(typeof(item) == "string")
			element.innerHTML = values.constructor == Array ? values[i] : i;
		else
			element.innerHTML = item.content ? item.content : i;

		element.addEventListener("click", on_click );
		root.appendChild(element);
	}

	root.addEventListener("mouseover", function(e) {
		this.mouse_inside = true;
	});

	root.addEventListener("mouseout", function(e) {
		//console.log("OUT!");
		var aux = e.toElement;
		while(aux != this && aux != document)
			aux = aux.parentNode;

		if(aux == this) return;
		this.mouse_inside = false;
		if(!this.block_close)
			this.closeMenu();
	});

	/* MS specific
	root.addEventListener("mouseleave", function(e) {
		
		this.mouse_inside = false;
		if(!this.block_close)
			this.closeMenu();
	});
	*/

	//insert before checking position
	document.body.appendChild(root);

	var root_rect = root.getClientRects()[0];

	//link menus
	if(options.from)
	{
		options.from.block_close = true;
	}

	var left = options.left || 0;
	var top = options.top || 0;
	if(options.event)
	{
		left = (options.event.pageX - 10);
		top = (options.event.pageY - 10);
		if(options.left)
			left = options.left;

		var rect = document.body.getClientRects()[0];

		if(options.from)
		{
			var parent_rect = options.from.getClientRects()[0];
			left = parent_rect.left + parent_rect.width;
		}

		
		if(left > (rect.width - root_rect.width - 10))
			left = (rect.width - root_rect.width - 10);
		if(top > (rect.height - root_rect.height - 10))
			top = (rect.height - root_rect.height - 10);
	}

	root.style.left = left + "px";
	root.style.top = top  + "px";

	function on_click(e) {
		var value = this.dataset["value"];
		var close = true;
		if(options.callback)
		{
			var ret = options.callback.call(root, this.data, e );
			if( ret != undefined ) close = ret;
		}

		if(close)
			LiteGraph.closeAllContextualMenus();
			//root.closeMenu();
	}

	root.closeMenu = function()
	{
		if(options.from)
		{
			options.from.block_close = false;
			if(!options.from.mouse_inside)
				options.from.closeMenu();
		}
		if(this.parentNode)
			document.body.removeChild(this);
	};

	return root;
}

LiteGraph.closeAllContextualMenus = function()
{
	var elements = document.querySelectorAll(".litecontextualmenu");
	if(!elements.length) return;

	var result = [];
	for(var i = 0; i < elements.length; i++)
		result.push(elements[i]);

	for(var i in result)
		if(result[i].parentNode)
			result[i].parentNode.removeChild( result[i] );
}

LiteGraph.extendClass = function(origin, target)
{
	for(var i in origin) //copy class properties
		target[i] = origin[i];
	if(origin.prototype) //copy prototype properties
		for(var i in origin.prototype)
			target.prototype[i] = origin.prototype[i];
}