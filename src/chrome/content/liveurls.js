/*
  LiveURLs - a Firefox extension that lets you create links to
  specific content on web pages

  Copyright (C) <2006>  Infosys Technologies Ltd.
  Authors : Natarajan Kannan
  Toufeeq Hussain

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

webmarkerNS.liveurls = {

    /* holds the length of text each node contributes */
    nodeOffsetList: [],
    /* array of text nodes for a given DOM range */
    nodes: [],
    /* this sets the default processing of the identified range, this
     * should ideally be picked up from options.  Other ways of
     * processing a range be found in the utils.js file.
     */
    process: function(doc, i) { return webmarkerNS.webmarker.markRange(doc, i, true); },

    /* Creates a string representation of a given range and keeps track of
     * which node in the tree contributed to which portion of the string
     * based on the trackNodes parameter.
     */
    processTextRange: function(currentDoc, range, strings, 
                               trackNodes, highlight)
    {
        var startNode = range.startContainer;
        var startOffset = range.startOffset;
        var endNode = range.endContainer;
        var endOffset = range.endOffset;
        var rangeString = "";
        var returnInfo = new Object();
        var retNode = null;

        returnInfo.rangeString = null;
        returnInfo.nextNode = null;

        /* setup data structures to track nodes and their string
         * contributions
         */
        this.nodes = new Array();
        this.nodeOffsetList = new Array();
        var count = 0;

        var sameNode = (startNode == endNode);

        if(sameNode && webmarkerNS.utils.isTextNode(startNode)) {
            /* selected range is a within a single text node, we do not
             * have to walk the tree to accumulate the string
             * 
             * TODO: Need to check if we need to track nodes in this
             * case.  Currently it does not harm us.
             */
            if(strings) {
                rangeString += 
                    webmarkerNS.utils.cleanStrings(startNode.data.substr(startOffset, endOffset - startOffset));
            }
            if(highlight) {
                startNode = startNode.splitText(startOffset);
                startNode.splitText(endOffset - startOffset);
                startNode =  
                    this.wrapTextNodeWithSpan(currentDoc, startNode);
                retNode = startNode.parentNode.nextSibling;
            }
        } else {
            /* we need to walk through a range of nodes to accumulate
             * the string.  
             */
            var nodeWalker = 
            currentDoc.createTreeWalker(range.commonAncestorContainer,
                                        NodeFilter.SHOW_TEXT, null, false);

            /* Though we've created the nodeWalker, remember that it
             * contains more than what we want to chew, so we need to
             * set the start and end approriately.  The documentation of
             * what startNode, startOffset, endNode, endOffset indicate,
             * are documented excellently at
             * http://developer.mozilla.org/en/docs/DOM:range
             *
             * We've now found the starting and ending nodes of the
             * range.  Now we need to find the starting and ending text
             * nodes of the range.  These will be the boundaries of our
             * text selection. startTxtNode and endTxtNode are used to
             * maintain the starting and ending text nodes of the range
             * in question, they are initialized with the current
             * boundary nodes in hand
             *
             * The getFirstTextNodeOfRange and getLastTextNodeOfRange
             * functions do exactly that
             */
            var startTxtNode = 
            this.getFirstTextNodeOfRange(range, nodeWalker);
            var endTxtNode = 
            this.getLastTextNodeOfRange(range, nodeWalker);
            
            /* set the starting text node as the current node of the
             * node walker
             */
            nodeWalker.currentNode = startTxtNode;

            /* walk through the nodes, accumulating the strings and keep
             * track of nodes and their contributions based on
             * trackNodes
             */
            for(var txtNode = startTxtNode;
                txtNode;
                txtNode = nodeWalker.nextNode()) {
                
                if(webmarkerNS.utils.isTextNode(txtNode)) {

                    /* get a clean version of the text content, we
                     * remove un-necessary whitespace characters
                     */
                    var str;
                    if(strings) {
                        str = webmarkerNS.utils.cleanStrings(txtNode.data);
                        
                        if(str.length > 0) {
                            if(trackNodes) {
                                this.nodes[count] = txtNode;
                                this.nodeOffsetList[count] = str.length;
                                count++;
                            }
                            rangeString += str;
                        }
                    }
                        
                    if(highlight && str.length > 0) {
                        nodeWalker.currentNode = 
                            this.wrapTextNodeWithSpan(
                                                      currentDoc, txtNode);
                        retNode = 
                            nodeWalker.currentNode.parentNode.nextSibling;
                    }
                }
                /* we've reached the final node and also added it, we
                 * quit 
                 */
                if(txtNode == endTxtNode) {
                    break;
                }
            }
        }
        
        if(strings) {
            returnInfo.rangeString = rangeString;
        }

        if(highlight) {
            returnInfo.nextNode = retNode;
        }

        return returnInfo;
    },

    /* Wraps a given node with a highlight span node
     * The following function has been generously re-used from the
     * Scrapbook extension for Firefox
     * http://amb.vis.ne.jp/mozilla/scrapbook/
     */
    wrapTextNodeWithSpan: function(aDoc, aTextNode)
    {
        var clonedTextNode = aTextNode.cloneNode( false );
        var nodeParent   = aTextNode.parentNode;
        var spanNode = aDoc.createElement("span");
        spanNode.setAttribute("style", "background-color: rgb(0, 255, 0); color: rgb(0, 0, 0);");
        spanNode.setAttribute("class", 'livetext');

        spanNode.setAttribute("title", webmarkerNS.webmarker.markTitle);

        spanNode.appendChild( clonedTextNode );
        nodeParent.replaceChild(spanNode, aTextNode);
        return clonedTextNode;
    },

    /* returns the first text node of a given range, and sets the
     * associated nodeWalker's currentNode too
     */
    getFirstTextNodeOfRange: function(range, nodeWalker)
    {
        var startNode = range.startContainer;
        var startOffset = range.startOffset;

        /* get to the exact startNode */
        if(!webmarkerNS.utils.isTextTypeNode(startNode)) {
            startNode = startNode.childNodes[startOffset];
        } else {
            startNode = startNode.splitText(startOffset);
        }

        /* find the first text node of the walker */
        if(!webmarkerNS.utils.isTextNode(startNode)) {
            nodeWalker.currentNode = startNode;
            startNode = nodeWalker.nextNode();
        }

        return startNode;
    },

    /* returns the last text node of the given range, the nodeWalker
     * helps in tracing that backwards
     */
    getLastTextNodeOfRange: function(range, nodeWalker)
    {
        var endNode = range.endContainer;
        var endOffset = range.endOffset;

        if(!webmarkerNS.utils.isTextTypeNode(endNode)) {
            /* we do an [endOffset - 1] here because endOffset
             * indicates the number of children before the endNode
             * and so [endOffset - 1] indicates the last selected
             * node
             */
            endNode = endNode.childNodes[endOffset - 1];
        } else {
            endNode.splitText(endOffset);
        }

        /* set the last text node of the range */
        if(!webmarkerNS.utils.isTextNode(endNode)) {
            /* we find the last child of the endNode and work up our
             * way in the tree to find the last text node
             */
            var lastChild = endNode.lastChild;
            var tmp;
            while(lastChild) {
                tmp = lastChild;
                lastChild = lastChild.lastChild;
            }
            lastChild = tmp;

            if(!webmarkerNS.utils.isTextNode(lastChild)) {
                /* we use a small trick to find the text node that
                 * is closest to the endNode (or) the endNode itself
                 * (if endNode is a text node).
                 */
                var savedCurrentNode = nodeWalker.currentNode;
                nodeWalker.currentNode = lastChild;
                endNode = nodeWalker.previousNode();
                nodeWalker.currentNode = savedCurrentNode;
            } else {
                endNode = lastChild;
            }
        }
 
        return endNode;
    },
   
    /* Returns the node corresponding to the string offset in the
     * the accumulated documentString
     */
    nodeIndexer: function(index)
    {
        var covered = 0;
        var prevCovered = 0;

        for(var i = 0; (i < this.nodeOffsetList.length); i++) {
            prevCovered = covered;
            covered += this.nodeOffsetList[i];
            if(covered >= index) {
                break;
            }
        }
        
        var returnArray = new Array();
        returnArray[0] = (index - prevCovered);
        returnArray[1] = i;

        return returnArray;
    },

    /* Given a string range in accumulated documentString by
     * processTextRange, this function returns a DOM range 
     */ 
    getDOMRangeForStringRange: function(currentDoc, start, end)
    {
        var startNodeDetails = this.nodeIndexer(start);
        var endNodeDetails = this.nodeIndexer(end);
        var startNode = this.nodes[startNodeDetails[1]];
        var startOffset = startNodeDetails[0];
        var endNode = this.nodes[endNodeDetails[1]];
        var endOffset = endNodeDetails[0];

        startOffset = this.getUnCleanOffset(startNode, startOffset, 1);
        endOffset = this.getUnCleanOffset(endNode, endOffset, -1);

        /* create the range that corresponds to the string */
        var range = currentDoc.createRange();
        range.setStart(startNode, startOffset); 
        range.setEnd(endNode, endOffset);

        return range;
    },

    getUnCleanOffset: function(node, cleanOffset, dir)
    {
        var i;
        var ci = 0;
        var nodeStr = node.data;

        for(i = 0; (i < nodeStr.length); i++) {
            if(!(nodeStr.charAt(i).match(webmarkerNS.utils.unWantedChars))) {
                ci++;
                if(ci == cleanOffset + 1) {
                    break;
                }
            }
        }
        
        /* additional to skip whitespace at the end of the nodes */
        if(dir == -1) {
            while(nodeStr.charAt(i + dir).match(/[\n\t\r\ ]/)) {
                if(i <= 0) {
                    break;
                } 
                i = i + dir;
            }
        }
        return i;
    },
     
    /* Given a starting word (startStr), ending word (endStr) of a
     * string and the string's length, this function selects all
     * occurances of the string in the text content of the document
     */
    findStringsInDocument: function(currentDoc, startStr, length, checksum)
    {
        var position = 0;
        var selection = content.window.getSelection();
        if(selection.rangeCount > 0)
        selection.removeAllRanges();

        /* our first search string is the text content of the whole
         * document.  We don't use document.body directly, looks like it is
         * deprecated
         */
        var body = currentDoc.getElementsByTagName("body").item(0);
        var docRange = currentDoc.createRange();
        docRange.setStart(body, 0); 
        docRange.setEnd(body, body.childNodes.length); 
        var r = this.processTextRange(currentDoc, docRange, true, true, false);
        var documentString = r.rangeString;
        while(true) {
            var start = documentString.indexOf(startStr, position);
            var portion = documentString.substr(start, length);

            /* we have reached the end of the document, when the length
             * of the remaining string of the document is less than the
             * string we want to match
             */
            if(portion.length != length) {
                break;
            }

            var crc = webmarkerNS.crc32.crc(portion);
            if((crc == checksum)) {
                var end = start + length;
                var range = 
                    this.getDOMRangeForStringRange(currentDoc, start, end);
                
                /* we've found the range corresponding to the string
                 * match, process the range
                 */
                var next = this.process(currentDoc, range);

                /* create a string comprising of the portion from the
                 * end of the current match to the end of the document,
                 * because the highlight action could have possibly
                 * spoiled our node references
                 */
                docRange = currentDoc.createRange();
                docRange.setStart(next, 0);
                docRange.setEnd(body, body.childNodes.length);
                r = this.processTextRange(currentDoc, docRange, 
                                          true, true, false);
                documentString = r.rangeString;

                /* we continue our search from the beginning of the
                 * newly built string
                 */
                position = 0;
            } else {
                position = start + 1;
            }
        }

    },

    /* Given a DOM range, returns the search approach fragment
     * identifier for LiveURLs
     */
    getFragmentIdentifierForString: function(str)
    {
        var selectedString = str;
        var startStr;
        var fragmentID = "";

        /* startStrLen should be between 0x1 and 0xf */
        var startStrLen = 5;

        /* we remove all not text characters, people would most likely
         * not want to show punctuation to others 
         */
        selectedString =
        selectedString.replace(webmarkerNS.utils.unWantedChars, "");

        if(selectedString.length > 0) {
            if(selectedString.length < startStrLen) {
                /* selected string is small, update startStrLength */
                startStr = selectedString;
                startStrLen = selectedString.length;
            } else {
                startStr = selectedString.substr(0, startStrLen);
            }

            /* string is finalized, calculate checksum */
            var crc = webmarkerNS.crc32.crc(selectedString);

            /* we are not going to use delimiters between all fields, the
             * fragment ID consists of following fields
             * 1. startStringLength (l1)
             * 2. startString (ss)
             * 3. selectedString.length (l2)
             * 4. checksum (ck)
             * 
             * the fragment ID is going to look like
             * l1ssl2:ck
             *
             * Basically we use only one delimiter, the rest are
             * deduced from the lengths or assumed
             */

            fragmentID = startStrLen + startStr +
                (selectedString.length).toString(16) + webmarkerNS.utils.delim +
                (crc).toString(16);
        }

        return fragmentID;
    },
                
    /* Does initial handling/sanitization of the received fragment ID
     */
    processSearchFragmentID: function(currentDoc, fragmentID)
    {
        /* to understand how a search based fragmentID looks like,
         * please look at the getFragmentIdentifierForString function 
         */
        if(fragmentID.length > 0) {
            /* the first character is length of the start string */
            var startStrLen = parseInt(fragmentID.charAt(0), 16);
            /* the start string to look for */
            var startStr = fragmentID.substr(1, startStrLen);

            /* get rest of the string info */
            var strInfo =   
            fragmentID.substr(startStrLen + 1).split(webmarkerNS.utils.delim);
            /* extract the selected string length and the checksum */
            var selectedStrLength = parseInt(strInfo[0], 16);
            var checksum = parseInt(strInfo[1], 16);

            if(isNaN(startStrLen) || isNaN(selectedStrLength) ||
               isNaN(checksum)) {
                /* this fragmentID is one which we did not generate, do
                 * not process it
                 */
                return false;
            }

            this.findStringsInDocument(currentDoc, startStr, 
                                       selectedStrLength, checksum);

            return true;
        } else {
            /* no fragmentID */
            return false;
        }
    },

    /* Creates a liveurl based on the search approach */
    getLiveURL: function(currentDoc, all, instance)
    {
        var url = content.window.location.href;
        var urlComponents = url.split("#");
        url = urlComponents[0];
        var liveURL = url + "#";
        var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);

        if(all) {
            for(var i = 0; i < currentTab.marks.length; i++) {
                var alreadyPresent = false;

                if(currentTab.marks[i]) {
                    var fragment = currentTab.marks[i].fragmentID;

                    /* check if a similar fragmentID is already there,
                     *  we dont need duplicates 
                     */
                    for(var j = 0; j < i; j++) {
                        if(fragment == currentTab.marks[j].fragmentID) {
                            alreadyPresent = true;
                            break;
                        }
                    }

                    if(alreadyPresent) {
                        break;
                    }

                    var fragmentLen = fragment.length.toString(16);
                    if(fragmentLen.length < 2) {
                        fragmentLen = "0" + fragmentLen;
                    }

                    liveURL += fragmentLen + escape(fragment);
                }
            }
        } else {
            if(currentTab.marks.length > instance) {
                var fragment = currentTab.marks[instance].fragmentID;
                var fragmentLen = fragment.length.toString(16);
                if(fragmentLen.length < 2) {
                    fragmentLen = "0" + fragmentLen;
                }
                liveURL += fragmentLen + escape(fragment);
            }
        }

        return liveURL;
    }
};
