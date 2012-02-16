/*
    LiveURLs - a Firefox extension that lets you create links to
    specific content on web pages

    Copyright (C) <2006>  Infosys Technologies Ltd.
    Authors : Natarajan Kannan (Natarajan_Kannan@infosys.com)
              Toufeeq Hussain (Toufeeq_Hussain@infosys.com)

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 59 Temple Place, Suite 330, Boston, MA  02111-1307  USA
*/


/* The domURLProcessor borrows from the Ahoy! method to identify and locate
   portions of web pages. http://dev.lophty.com/ahoy/article.htm 
 */

webmarkerNS.domURLProcessor = {

    /* this sets the default processing of the identified range, this
       should ideally be picked up from options.  Other ways of
       processing a range be found in the utils.js file.
     */
    process: function(i) { return commonUtils.highlightRange(i); },

    getNodeIdentifier: function(node)
    {
        var parent = node.parentNode;
        var parentIndex = null;
        var parentID = null;
        var nodeIndex;
        var nodeLocator;
        
        /* For a node-id based URL get the node index. */
        if(parent.hasAttribute("ID")) {
            parentID = parent.getAttribute("ID");
            for(var i = 0; i < parent.childNodes.length; i++) {
                if(parent.childNodes[i] == node) {
                    nodeIndex = i;
                }       
            }
        } else {
            /*
               Generate node index where the URL is generated 
               based on node-tag.
             */ 
            var allParentNodeTypes =
            content.document.getElementsByTagName(parent.nodeName);
            elementsloop:
            for(var i = 0; i < allParentNodeTypes.length; i++) {
                childrenloop:
                for(var j = 0; j <
                allParentNodeTypes[i].childNodes.length; j++) {
                    if(allParentNodeTypes[i].childNodes[j] == node) {
                        parentIndex = i;
                        nodeIndex = j;
                        break elementsloop;
                    }
                }
            }
        }
        
        /* Generate URL parameters based on the above processing. */
        if(parentID) {
            nodeLocator = new Array(3);
            nodeLocator[0] = "id";
            nodeLocator[1] = parentID;
            nodeLocator[2] = nodeIndex;
        } else if(parentIndex != null) {
            nodeLocator = new Array(4);
            nodeLocator[0] = "ndx";
            nodeLocator[1] = parent.nodeName;
            nodeLocator[2] = parentIndex;
            nodeLocator[3] = nodeIndex;
        }

        /* Return array of URL parameters. */
        return nodeLocator;
    },

    /* Given an array of node-identifiers this function splits them
       into the required parameters useful for processing the content.
       It returns the node which lies within the range.
     */
    getNode: function(nodeIdentifier)
    {
        var parent;
        var nodeOffset;
        var node;
        var offset;
        var parentTag;
        var parentID;
        var parentIndex = null;
        var parentLocator;
        
        /* Process the parameters for a DOM/node-index based URL. */
        if(nodeIdentifier[0].match("ndx")) {
            parentTag = nodeIdentifier[1];
            parentIndex = nodeIdentifier[2];
            nodeOffset = nodeIdentifier[3];
            parent = content.document.
                getElementsByTagName(parentTag).item(parentIndex);
            node = parent.childNodes[nodeOffset];
        } else if(nodeIdentifier[0].match("id")) {
            /* Process the parameters for a DOM/node-index based URL. */
            parentID = nodeIdentifier[1];
            nodeOffset = nodeIdentifier[2];
            parent = content.document.evaluate("//[@id='" + parentID + "']",
                        content.document,
                        null,
                        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                        null);
            node = parent.childNodes[nodeOffset];
        }

        return node;
    },

    /* This function handles the core processing of the DOM-based liveURL 
     */
    processDOMFragmentID: function(fragmentID)
    {
        fragmentID = unescape(fragmentID);
        if(fragmentID != null) {
            if(fragmentID.length > 0) {
                /* Get the start and end parameter details */
                var fragmentIDComponents = fragmentID.split("-");
                var startDetails = fragmentIDComponents[0];
                var endDetails = fragmentIDComponents[1];
                var len;

                var startNode;
                var endNode;
                var startOffset;
                var endOffset;
                
                /* Get start node and offset from the start details */
                var startDetailsComponents =
                    startDetails.split(commonUtils.delim);
                len = startDetailsComponents.length;
                startNode = this.getNode(
                    startDetailsComponents.slice(0, len - 1));
                startOffset = startDetailsComponents[len - 1];

                var endDetailsComponents =  
                    endDetails.split(commonUtils.delim);
                len = endDetailsComponents.length;
                endNode = this.getNode(
                    endDetailsComponents.slice(0, len - 1));
                endOffset = endDetailsComponents[len - 1];
        
                var range = content.document.createRange();
                range.setStart(startNode, startOffset);
                range.setEnd(endNode, endOffset);

                /* process live range */
                this.process(range);

                commonUtils.focusLiveText(0);
            }
        }
    },

    /* This function creates a DOM based LiveURL based on the selected
       content. 
     */
    getDOMLiveURL: function() 
    {
        var url = content.window.location.href;
        var urlComponents = url.split("#");
        url = urlComponents[0];
        var selection = content.window.getSelection();
        var liveURL = url;
        if(selection.toString().length > 0) {
            var range = selection.getRangeAt(0);
            var startOffset = range.startOffset;
            var startContainer = range.startContainer;
            var endOffset = range.endOffset;
            var endContainer = range.endContainer;

            startParentLocator = this.getNodeIdentifier(startContainer);
            endParentLocator = this.getNodeIdentifier(endContainer);

            liveURL = url + "#" + escape("dom" + commonUtils.delim + 
                startParentLocator.join(commonUtils.delim) + 
                commonUtils.delim + startOffset + "-" +
                endParentLocator.join(commonUtils.delim) +
                commonUtils.delim + endOffset);
        }

        return liveURL;
    },

    /* copies LiveURL to the clip-board */
    copyDOMLiveURL: function()
    {
        commonUtils.copyToClipboard(this.getDOMLiveURL());
    }
};
