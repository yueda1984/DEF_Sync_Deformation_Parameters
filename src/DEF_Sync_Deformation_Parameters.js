/*
	Sync Deformation Parameters

	A Toon Boom Harmony shelf script for synchronizing (or linking) transformation parameters between nodes of various types.
	This script is still in its beta state.
	
	
	Author:

		Yu Ueda		
		Many more useful scripts hor Toon Boom Harmony are available. Please visit raindropmoment.com	
*/


var scriptVer = "1.01β";


function DEF_Sync_Deformation_Parameters()
{	
	// ------------------------------------------- Dialog definition Start ------------------------------------------->	

	
	this.ui = new QWidget(getParentWidget());
	this.ui.setWindowTitle("Synchronize Deformer Parameters v" + scriptVer);
	this.ui.setWindowFlags(Qt.Tool);
	this.ui.setAttribute(Qt.WA_DeleteOnClose);	
	
	this.ui.mainLayout = new QVBoxLayout(this.ui);	
	this.ui.comboLayout = new QFormLayout(this.ui);

	this.ui.CBBox = new QGroupBox("Parameters to Sync");
	this.ui.CBBox.setMinimumSize(250, 190);
	this.ui.CBBox.CBBoxLayout = new QVBoxLayout(this.ui);	
	this.ui.CBBox.setLayout(this.ui.CBBox.CBBoxLayout);
	this.ui.mainLayout.addWidget(this.ui.CBBox, 0, 0);
	
	this.ui.selectChildComboLabel = new QLabel("Sync this:");	
	this.ui.selectChildCombo = new QComboBox();
	this.ui.comboLayout.addRow(this.ui.selectChildComboLabel, this.ui.selectChildCombo);	

	this.ui.swapButtonLayout = new QHBoxLayout(this.ui);
	this.ui.swapButton = new QPushButton("Direction");	

	this.ui.swapButtonLayout.insertStretch(2, 2);
	this.ui.linkButton = new QPushButton("Sync");
	this.ui.swapButtonLayout.addWidget(this.ui.linkButton, 0,2);
	this.ui.swapButtonLayout.insertStretch(2, 2);
	this.ui.comboLayout.addRow(this.ui.swapButton, this.ui.swapButtonLayout);

	this.ui.selectParentComboLabel = new QLabel("To this:");
	this.ui.selectParentCombo = new QComboBox();	
	this.ui.comboLayout.addRow(this.ui.selectParentComboLabel, this.ui.selectParentCombo);
	
	this.ui.mainLayout.addLayout(this.ui.comboLayout);	
	
	this.ui.errorLabel = new QLabel("Ready to sync.");
	this.ui.errorLabel.alignment = Qt.AlignCenter;	
	this.ui.mainLayout.addWidget(this.ui.errorLabel, 3, 0);
	
	
	// ------------------------------------------- Dialog definition End ------------------------------------------->		
	
	

	var ctx = {		
		comboCallbackLock: "locked", // use this to grant comboIndexChanged callbacks only when user changes combo box selection.	
		nodeCount: 0,
		CBs: [],
		node: [],
		type: [],
		pointName: [],
		comboItem: [],
		chdIdx: 0,
		parIdx: 1,
		attrs: []
	};


	this.refreshSelection = function()
	{
		// set the lock to ignore comboIndexChanged called while refreshing.
		ctx.comboCallbackLock = "locked";	
	
		// initialize the combo box parameter check boxes, and ctx object
		this.ui.selectParentCombo.clear();
		this.ui.selectChildCombo.clear();
		clearCheckBoxes(this);

		ctx = {
			comboCallbackLock: "locked",
			nodeCount: 0,
			CBs: [],
			node: [],
			type: [],
			pointName: [],
			comboItem: [],
			chdIdx: 0,
			parIdx: 1,
			attrs: []
		};
		
		// Create sNode list with the current selection. If group nodes are selected, add its sub-nodes to the sNode list.
		var sNodes = getCompleteNodeList(selection.selectedNodes());
		// Filter supported nodes
		sNodes = sNodes.filter(function(item)
			{	return node.type(item) == "OffsetModule" || node.type(item) == "CurveModule" ||
				node.type(item) == "BendyBoneModule" || node.type(item) == "GameBoneModule" || node.type(item) == "FreeFormDeformation" ||
				node.type(item) == "READ" || node.type(item) == "PEG";});
		sNodes.sort();
		ctx.nodeCount = sNodes.length;

		// if FFD is selected, the node will include multiple points. Capture the index of the first point on each selected node.
		var pointCount = 0;
		var firstPtIdx = [];
		
		for (var sn = 0; sn < ctx.nodeCount; sn++)
		{
			var curNode = sNodes[sn];
			var curType = node.type(curNode);

			// FFD includes multiple points in one node.
			// Treat each point as separate nodes by storing the node type and name multiple times to match the point count.
			if (curType == "FreeFormDeformation")
			{
				firstPtIdx.push(pointCount);
				var pointNames = getFFDPointNames(curNode);
				ctx.pointName.push.apply(ctx.pointName, pointNames.name);
				ctx.comboItem.push.apply(ctx.comboItem, pointNames.comboName);
				
				for (var i = 0; i < pointNames.name.length; i++)
				{
					ctx.node.push(curNode);
					ctx.type.push(curType);				
				}
				pointCount += pointNames.name.length;
			}
			else
			{
				firstPtIdx.push(pointCount);
				ctx.pointName.push("");
				ctx.comboItem.push(curNode);			
				ctx.node.push(curNode);
				ctx.type.push(curType);
				pointCount++;			
			}
		}
		
		if (ctx.nodeCount < 2)
		{
			this.ui.linkButton.enabled = false;
			this.ui.swapButton.enabled = false;
			this.ui.errorLabel.setStyleSheet("QLabel{color: red}");
			this.ui.errorLabel.text = "Select least 2 from Drawing, Peg, Bone,\nCurve, Offset, and Free Form Deformer.";
			
			if (ctx.nodeCount == 0)
				return;
		}	

		ctx.chdIdx = firstPtIdx[0];	
		this.ui.selectChildCombo.addItems(ctx.comboItem);
		this.ui.selectChildCombo.setCurrentIndex(ctx.chdIdx);

		if (ctx.nodeCount >= 2)
		{
			ctx.parIdx = firstPtIdx[1];	
			this.ui.selectParentCombo.addItems(ctx.comboItem);
			this.ui.selectParentCombo.setCurrentIndex(ctx.parIdx);
			refreshCheckBoxes(this);
		}
		else
			this.ui.selectParentCombo.clear();
		ctx.comboCallbackLock = "unlocked";
		
		function getFFDPointNames(ffd)
		{
			var allAttrs = node.getAttrList(ffd, 1);
			var pointNames = {};
			pointNames.name = [], pointNames.comboName = [];
			for (var aa in allAttrs)
			{
				var curAttrKey = allAttrs[aa].keyword();			
				if (curAttrKey.indexOf("Point") !== -1)
				{
					 pointNames.name.push(curAttrKey);			
					 pointNames.comboName.push(ffd + " : " + curAttrKey);
				}
			}
			return pointNames;		
		}		
	}
	this.refreshSelection();	
	
	function clearCheckBoxes(_this)
	{
		if (ctx.CBs.length > 0)
		{
			for (var cb in ctx.CBs)
			{
				ctx.CBs[cb].hide();
				_this.ui.CBBox.CBBoxLayout.removeWidget(ctx.CBs[cb]);	
			}
			ctx.CBs.length = 0;
		}
	}

	function refreshCheckBoxes(_this)
	{		
		// add available parameters' check boxes to CBBox group based on the selected nodes.
		var chdType = ctx.type[ctx.chdIdx];
		var parType = ctx.type[ctx.parIdx];

		if ((chdType == "PEG" && parType == "PEG") || (chdType == "READ" && parType == "READ") ||
			(chdType == "PEG" && parType == "READ") || (chdType == "READ" && parType == "PEG"))
			var checkBoxPresets = "PEG";

		else if (chdType == "FreeFormDeformation" || parType == "FreeFormDeformation")
			var checkBoxPresets = "Mix";
		else if (chdType !== parType)
		{
			if ((chdType == "BendyBoneModule" && parType == "GameBoneModule") || (chdType == "GameBoneModule" && parType == "BendyBoneModule"))
				var checkBoxPresets = "GameBoneModule";
			else if ((chdType == "OffsetModule" && parType == "BendyBoneModule") || (chdType == "BendyBoneModule" && parType == "OffsetModule") ||
					 (chdType == "OffsetModule" && parType == "GameBoneModule") || (chdType == "GameBoneModule" && parType == "OffsetModule"))
				var checkBoxPresets = "OffsetModule";		
			else
				var checkBoxPresets = "Mix";
		}
		else
			var checkBoxPresets = chdType;		

		switch (checkBoxPresets)
		{
			case "OffsetModule" :
				var attrList = ["Position (x)", "Position (y)", "Orientation"]; break;
			case "CurveModule" :
				var attrList = ["Position (x)", "Position (y)", "Orientation 0", "Length 0", "Orientation 1", "Length 1"]; break;
			case "BendyBoneModule" :
				var attrList = ["Position (x)", "Position (y)", "Radius", "Orientation", "Bias", "Length"]; break;
			case "GameBoneModule" :
				var attrList = ["Position (x)", "Position (y)", "Radius", "Orientation", "Length"]; break;	
			case "PEG" :
				var attrList = ["Position (x)", "Position (y)", "Position (z)", "Scale (x)", "Scale (y)", "Rotation (z)", "Skew"]; break;						
			default : // "Mix"
				var attrList = ["Position (x)", "Position (y)"];	
		}
		
		
		for (var atr in attrList)
		{
			var newCB = new QCheckBox(attrList[atr]);
			_this.ui.CBBox.CBBoxLayout.addWidget(newCB, 0, 0);
			newCB.checked = true;
			ctx.CBs.push(newCB);				
		}
				
		// We can only sync "separate" attributes. If the parent node is in "2d path" mode, disable sync button
		var parSeparateAttr = "offset.separate";
		switch (parType)
		{
			case "FreeFormDeformation" : parSeparateAttr = ctx.pointName[ctx.parIdx] + ".position.separate"; break;
			case "PEG" : parSeparateAttr = "position.separate";
		}
		if (!node.getAttr(ctx.node[ctx.parIdx], 1, parSeparateAttr).boolValue())
		{
			_this.ui.linkButton.enabled = false;
			_this.ui.errorLabel.setStyleSheet("QLabel{color: red}");
			_this.ui.errorLabel.text = "You cannot sync to a \"2d Path\" parameter.\nPlease set its type to \"Separate\".";
		}
		else
		{
			_this.ui.linkButton.enabled = true;
			_this.ui.swapButton.enabled = true;
			_this.ui.errorLabel.setStyleSheet("");
			_this.ui.errorLabel.text = "Ready to sync.";
		}
	}		


	// ------------------------------------------- Signals and callback functions ------------------------------------------->	


	this.selectChildComboIndexChanged = function(value)
	{
		if (ctx.nodeCount >= 2 && ctx.comboCallbackLock == "unlocked")
		{	
			ctx.chdIdx = value;
				
			// avoid the same node selected for both child and parent.
			if (ctx.node[ctx.chdIdx] == ctx.node[ctx.parIdx])
			{	
				do
				{
					if (ctx.parIdx < ctx.node.length -1)
						ctx.parIdx++;
					else
						ctx.parIdx = 0;
				}				
				while (ctx.node[ctx.chdIdx] == ctx.node[ctx.parIdx])
				
				// set the lock to ignore selectParentComboIndexChanged called by setCurrentIndex().
				ctx.comboCallbackLock = "lock next";
				this.ui.selectParentCombo.setCurrentIndex(ctx.parIdx);
			}		
			clearCheckBoxes(this);
			refreshCheckBoxes(this);
		}
		else if (ctx.comboCallbackLock == "lock next")
			ctx.comboCallbackLock = "unlocked";		
	};
	this.selectParentComboIndexChanged = function(value)
	{
		if (ctx.nodeCount >= 2 && ctx.comboCallbackLock == "unlocked")
		{	
			ctx.parIdx = value;
				
			// avoid the same node selected for both child and parent.
			if (ctx.node[ctx.chdIdx] == ctx.node[ctx.parIdx])
			{	
				do
				{
					if (ctx.chdIdx < ctx.node.length -1)
						ctx.chdIdx++;
					else
						ctx.chdIdx = 0;
				}			
				while (ctx.node[ctx.chdIdx] == ctx.node[ctx.parIdx])
				
				// set the lock to ignore selectChildComboIndexChanged called by setCurrentIndex().
				ctx.comboCallbackLock = "lock next";
				this.ui.selectChildCombo.setCurrentIndex(ctx.chdIdx);
			}
			clearCheckBoxes(this);
			refreshCheckBoxes(this);
		}
		else if (ctx.comboCallbackLock == "lock next")
			ctx.comboCallbackLock = "unlocked";		
	};
	this.swapButtonReleased = function()
	{
		// set the lock to ignore comboIndexChanged called while swapping.
		ctx.comboCallbackLock = "locked";
		var OGchdIdx = ctx.chdIdx;
		ctx.chdIdx = ctx.parIdx;
		ctx.parIdx = OGchdIdx;
		this.ui.selectChildCombo.setCurrentIndex(ctx.chdIdx);
		this.ui.selectParentCombo.setCurrentIndex(ctx.parIdx);
		clearCheckBoxes(this);
		refreshCheckBoxes(this);		
		ctx.comboCallbackLock = "unlocked";
	};
	this.linkButtonReleased = function()
	{
		if (ctx.CBs.length > 0)
		{
			ctx.attrs = [];		
			for (var CBIdx = 0; CBIdx < ctx.CBs.length; CBIdx++)
				if (ctx.CBs[CBIdx].checked)
					ctx.attrs.push(ctx.CBs[CBIdx].text);
	
			linkParams(ctx);
		}
	};

	this.ui.selectChildCombo['currentIndexChanged(int)'].connect(this, this.selectChildComboIndexChanged);
	this.ui.selectParentCombo['currentIndexChanged(int)'].connect(this, this.selectParentComboIndexChanged);
	this.ui.swapButton.released.connect(this, this.swapButtonReleased);	
	this.ui.linkButton.released.connect(this, this.linkButtonReleased);

	
	/* if software version is 16 or higher, use SCN class to signal when selection is changed.
	else, use QWidget::changeEvent instead */	
	this.scn = {};
	var main = this;
	var softwareVer = getSoftwareVer();		
	if (softwareVer >= 16)
	{
		this.scn = new SceneChangeNotifier(this.ui);
		this.scn.selectionChanged.connect(this, this.refreshSelection);	
	}
	else
	{
		this.ui.changeEvent = function()
		{
			if (!main.ui.isActiveWindow)
			{
				main.ui.linkButton.enabled = false;
				main.ui.swapButton.enabled = false;				
			}
			else	
				main.refreshSelection();
		}
	}
	
	// when title bar "x" is clicked, terminate the SCN
	if (softwareVer >= 16)
		this.ui.closeEvent = function()
		{	
			main.scn.disconnectAll();
		}

	this.ui.show();
	
	
	// ------------------------------------------- Main function called after Link button is pressed ------------------------------------------->		
			

	function linkParams(_ctx)
	{	
		// Select parameters on parent node node to copy from and child node nodes to paste to.
		var parAttrs = [], chdAttrs = [], parRestAttrs = [], chdRestAttrs = [];	
		for (var path = 0; path < 2; path++)
		{
			// Choose node data depends on path. (path == 0) //source, (path == 1) //destination
			var nodeIdx		 = (path == 0) ? _ctx.parIdx	: _ctx.chdIdx;
			var nodeType	 = _ctx.type[nodeIdx];
			var attrs		 = (path == 0) ? parAttrs		: chdAttrs;
			var restAttrs	 = (path == 0) ? parRestAttrs	: chdRestAttrs;

			if (nodeType == "FreeFormDeformation")
			{
				if (_ctx.attrs.indexOf("Position (x)") !== -1)
				{
					attrs.push(_ctx.pointName[nodeIdx] + ".position.x");
					restAttrs.push(_ctx.pointName[nodeIdx] + ".restingPosition.x");		
				}
				if (_ctx.attrs.indexOf("Position (y)") !== -1)
				{
					attrs.push(_ctx.pointName[nodeIdx] + ".position.y");
					restAttrs.push(_ctx.pointName[nodeIdx] + ".restingPosition.y");		
				}
			}
			else if (nodeType == "PEG" || nodeType == "READ")
			{
				if (nodeType == "PEG")
				{
					if (_ctx.attrs.indexOf("Position (x)") !== -1)
					{
						attrs.push("position.x");
						restAttrs.push("");		
					}
					if (_ctx.attrs.indexOf("Position (y)") !== -1)
					{
						attrs.push("position.y");
						restAttrs.push("");		
					}
					if (_ctx.attrs.indexOf("Position (z)") !== -1)
					{
						attrs.push("position.z");
						restAttrs.push("");		
					}					
				}
				else if (nodeType == "READ")
				{
					if (_ctx.attrs.indexOf("Position (x)") !== -1)
					{
						attrs.push("offset.x");
						restAttrs.push("");		
					}
					if (_ctx.attrs.indexOf("Position (y)") !== -1)
					{
						attrs.push("offset.y");
						restAttrs.push("");		
					}
					if (_ctx.attrs.indexOf("Position (z)") !== -1)
					{
						attrs.push("offset.z");
						restAttrs.push("");		
					}
				}
				if (_ctx.attrs.indexOf("Scale (x)") !== -1)
				{
					attrs.push("scale.x");
					restAttrs.push("");		
				}				
				if (_ctx.attrs.indexOf("Scale (y)") !== -1)
				{
					attrs.push("scale.y");
					restAttrs.push("");		
				}					
				if (_ctx.attrs.indexOf("Rotation (z)") !== -1)
				{
					attrs.push("rotation.anglez");
					restAttrs.push("");		
				}				
				if (_ctx.attrs.indexOf("Skew") !== -1)
				{
					attrs.push("skew");
					restAttrs.push("");		
				}		
			}			
			else if (nodeType == "BendyBoneModule" || nodeType == "GameBoneModule")
			{
				if (_ctx.attrs.indexOf("Position (x)") !== -1)
				{
					attrs.push("offset.x");
					restAttrs.push("restoffset.x");		
				}
				if (_ctx.attrs.indexOf("Position (y)") !== -1)
				{
					attrs.push("offset.y");
					restAttrs.push("restoffset.y");		
				}
				if (_ctx.attrs.indexOf("Radius") !== -1)
				{
					attrs.push("radius");
					restAttrs.push("restradius");		
				}	
				if (_ctx.attrs.indexOf("Orientation") !== -1)
				{
					attrs.push("orientation");
					restAttrs.push("restorientation");		
				}
				if (_ctx.attrs.indexOf("Bias") !== -1)
				{
					attrs.push("bias");
					restAttrs.push("restbias");		
				}				
				if (_ctx.attrs.indexOf("Length") !== -1)
				{
					attrs.push("length");
					restAttrs.push("restlength");		
				}				
			}
			else // "OffsetModule" or "CurveModule"
			{
				if (_ctx.attrs.indexOf("Position (x)") !== -1)
				{
					attrs.push("offset.x");
					restAttrs.push("restingoffset.x");		
				}
				if (_ctx.attrs.indexOf("Position (y)") !== -1)
				{
					attrs.push("offset.y");
					restAttrs.push("restingoffset.y");		
				}

				if (nodeType == "OffsetModule")	
				{
					if (_ctx.attrs.indexOf("Orientation") !== -1)
					{
						attrs.push("orientation");
						restAttrs.push("restingorientation");		
					}
				}
				else if (nodeType == "CurveModule")	
				{
					if (_ctx.attrs.indexOf("Orientation 0") !== -1)
					{
						attrs.push("orientation0");
						restAttrs.push("restingorientation0");		
					}
					if (_ctx.attrs.indexOf("Length 0") !== -1)
					{
						attrs.push("length0");
						restAttrs.push("restlength0");		
					}
					if (_ctx.attrs.indexOf("Orientation 1") !== -1)
					{
						attrs.push("orientation1");
						restAttrs.push("restingorientation1");		
					}
					if (_ctx.attrs.indexOf("Length 1") !== -1)
					{
						attrs.push("length1");
						restAttrs.push("restlength1");		
					}
				}
			}		
		}

		scene.beginUndoRedoAccum("Synchronize Deformation Parameters");


		//--------------------------------------------------------- Actual Synchronization --------------------------------------------------------->


		var parNode = _ctx.node[_ctx.parIdx];
		var parType = _ctx.type[_ctx.parIdx];
		var chdNode = _ctx.node[_ctx.chdIdx];
		var chdType = _ctx.type[_ctx.chdIdx];		


		// We can only sync "separate" attributes. If the child uses "2d path" mode, switch it to separate mode.
		var chdSeparateAttr = "offset.separate";
		switch (chdType)
		{
			case "FreeFormDeformation" : chdSeparateAttr = _ctx.pointName[_ctx.chdIdx] + ".position.separate"; break;
			case "PEG" : chdSeparateAttr = "position.separate";
		}	
		if (!node.getAttr(chdNode, 1, chdSeparateAttr).boolValue())
			node.setTextAttr(chdNode, chdSeparateAttr, 1, "Y");


		var paramType = ["resting", "deform"];		
		for (var pm = 0; pm < paramType.length; pm++)
		{
			if (chdType !== "PEG" && chdType !== "READ" && paramType[pm] == "resting")
				for (var at = 0; at < parRestAttrs.length; at++)
				{
					var value = (parType == "PEG" || chdType == "READ") ? 0: node.getAttr(parNode, 1, parRestAttrs[at]).doubleValue();				
					node.setTextAttr(chdNode, chdRestAttrs[at], 1, value);
				}
			else if (paramType[pm] == "deform")
			{
				for (var at = 0; at < parAttrs.length; at++)
				{
					// if child node node's current attr is linked to a function column, unlink and remove the column.
					var chdCol = node.linkedColumn(chdNode, chdAttrs[at]);
					if (chdCol !== "")
					{
						node.unlinkAttr(chdNode, chdAttrs[at]);
						column.removeUnlinkedFunctionColumn(chdCol);
					}					
					
					// copy parent node's value to child node's local value.
					var value = node.getAttr(parNode, 1, parAttrs[at]).doubleValue();				
					node.setTextAttr(chdNode, chdAttrs[at], 1, value);
					
					// copy parent node's function column to child node.
					var parCol = node.linkedColumn(parNode, parAttrs[at]);
					if (parCol !== "")
						node.linkAttr(chdNode, chdAttrs[at], parCol);
					
					// if the parent attr doesn't have a function column, create one.
					else
					{	
						var newColName = getUniqueColName(parAttrs[at]);
						if (column.add(newColName, "BEZIER"))
						{
							node.linkAttr(parNode, parAttrs[at], newColName);
							node.linkAttr(chdNode, chdAttrs[at], newColName);
						}
					}
				}
			}
		}
		
		
		scene.endUndoRedoAccum("");	
	}
	
	function getCompleteNodeList(nodeList)
	{
		var completeNodeList = [];		
		for (var i = 0; i < nodeList.length; i++)
		{
			var sNode = nodeList[i];
			if (node.type(sNode) == "GROUP")
				completeNodeList.push.apply(completeNodeList, getCompleteNodeList(node.subNodes(sNode)));		
			else
				completeNodeList.push(sNode);
		}
		return completeNodeList;
	}	
	
	function getUniqueColName(argName)
	{
		var suffix = 0;
		var originalName = argName;

		while (column.getDisplayName(argName))
		{
			suffix ++;
			argName = originalName + "_" + suffix;	
		} 	
		return argName;
	}
	
	function getParentWidget()
	{
		var topWidgets = QApplication.topLevelWidgets();
		for (var i in topWidgets)
			if (topWidgets[i] instanceof QMainWindow && !topWidgets[i].parentWidget())
				return topWidgets[i];
		return "";
	}
	
	function getSoftwareVer()
	{
		var info = about.getVersionInfoStr();
		info = info.split(" ");
		return parseFloat(info[7]);
	}
}