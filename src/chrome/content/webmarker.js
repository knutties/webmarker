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

var webmarkerNS = {};

webmarkerNS.webmarker = {

    /* how many pixels should be between the top of the page and the
     *  focussed mark
     */
        
    scrollAmount: 40,
    markTitle: "",
    markForDeletion: "",

    /* given a range, processes (highlights) the range and returns the
     *  node next to the last processed node of the range
     */
    markRange: function(currentDoc, range, allowOverlap)
    {
        /* generate a unique mark title */
        var d = new Date();
        this.markTitle = d.getTime();

        var nextNode = null;

        if(!allowOverlap && webmarkerNS.utils.isOverlappedSelection(currentDoc, range)) {
            alert(webmarkerNS.utils.getLocalizedString('mark.overlap-message'));
            nextNode = null;
        } else {

            /* TRICK: We remove all ranges. We add the range to a
             * selection object as the selection's toString returns
             * nicely formatted text 
             */
            var selection = content.window.getSelection();
            if(selection.rangeCount > 0) {
                selection.removeAllRanges();
            }

            selection.addRange(range);
            var fragmentText = selection.toString();

            var returnInfo = 
                webmarkerNS.liveurls.processTextRange(currentDoc, range, true, false, true);
            var fragmentID =
                webmarkerNS.liveurls.getFragmentIdentifierForString(returnInfo.rangeString);

            if(fragmentID.length > 0) {
                this.addMark(currentDoc, fragmentID, this.markTitle, 
                             fragmentText);
            }
            nextNode = returnInfo.nextNode;

            /* we don't the selections */
            if(selection.rangeCount > 0) {
                selection.removeAllRanges();
            }
        }

        /* we've marked text on the page, so update menu options */
        this.handleOptionUpdation(false, currentDoc);
        return nextNode;
    },

    /* marks the selected content of a web-page */
    markSelection: function(currentDoc, selection)
    {
        if(selection.rangeCount > 0) {
            var range = selection.getRangeAt(0);
            this.markRange(currentDoc, range, false);
        }

        /* remove all selected ranges */
        var selection = content.window.getSelection();
        if(selection.rangeCount > 0) {
            selection.removeAllRanges();
        }
    },

    /* marks the selected content of a page if we are in mark mode */
    markSelectionMode: function(currentDoc)
    {
        var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);
        var selection = currentTab.contentWindow.getSelection();
        var marker =
            document.getElementById("webmarker-mark-button");
        
        if(marker.checked && webmarkerNS.utils.isTextSelected(currentDoc)) {
            this.markSelection(currentDoc, selection);
        }
    },

    /* get the co-ordinates of a mark on a webpage, we need it to do
     *  mark ordering
     */
    getCoOrdinatesOfMark: function(currentDoc, title)
    {
        var point = new Object();
        point.startX = 0;
        point.startY = 0;

        var liveNodes = 
            currentDoc.evaluate("//span[@class='livetext' and @title='" 
                                + title +"']",
                                currentDoc,
                                null,
                                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                                null);

        if(liveNodes.snapshotLength > 0) {
            point.startX = this.findPosX(liveNodes.snapshotItem(0));
            point.startY = this.findPosY(liveNodes.snapshotItem(0));
        }
        
        return point;
    },


    /* following functions lifted from
     *  http://www.quirksmode.org/js/findpos.html
     */
    findPosX: function(obj)
    {
        var curleft = 0;
        if (obj.offsetParent)
        {
            while (obj.offsetParent) {
                curleft += obj.offsetLeft;
                obj = obj.offsetParent;
            }
        }
        else if (obj.x) {
            curleft += obj.x;
        }
        return curleft;
    },

    findPosY: function(obj)
    {
        var curtop = 0;
        if (obj.offsetParent)
        {
            while (obj.offsetParent) {
                curtop += obj.offsetTop
                obj = obj.offsetParent;
            }
        }
        else if (obj.y) {
            curtop += obj.y;
        }
        return curtop;
    },

    /* creates a webmark object and adds it to the list of marks of the
     *  corresponding tab
     */
    addMark: function(currentDoc, fragmentID, title, fragmentText)
    {
        var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);

        var mark = new webmark;

        mark.fragmentID = fragmentID;
        mark.title = title;
        mark.fragmentText = fragmentText;

        /* get co-ordinates of mark */
        var point = this.getCoOrdinatesOfMark(currentDoc, title);
        mark.startX = point.startX;
        mark.startY = point.startY;

        var indexToInsert = 0;
        for(; indexToInsert < currentTab.marks.length; indexToInsert++) {
            if(indexToInsert in currentTab.marks) {
                if(this.greaterMark(currentTab.marks[indexToInsert], mark)) {
                    break;
                }
            }
        }

        currentTab.marks.splice(indexToInsert, 0, mark);

        /* repaint the previously focussed mark */
        if(currentTab.focussedMark != -1) {

            var previousFocussedMark = currentTab.focussedMark;
            if(indexToInsert <= currentTab.focussedMark) {
                previousFocussedMark = currentTab.focussedMark + 1;
            }

            this.repaintMark(currentDoc,
                             currentTab.marks[previousFocussedMark],
                             "rgb(255, 255, 0)");
        }

        currentTab.focussedMark = indexToInsert;
    },

    /* removes specified marks from the header div that we add 
     *  if title is *, remove all marks
     */
    removeMarks: function(currentDoc, title)
    {
        var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);
        if(title == "*") {
            this.initMarks(currentDoc);
        } else {
            for(var i = 0; i < currentTab.marks.length; i++) {
                var markTitle = currentTab.marks[i].title;
                if(markTitle == title) {
                    currentTab.marks.splice(i, 1);

                    /* do we have any marks at all ? */
                    if(currentTab.marks.length > 0) {
                        if(i < currentTab.focussedMark) {
                            /* reset focussed mark if needed  because we
                             * have deleted a mark before that 
                             */
                            currentTab.focussedMark -= 1;
                        } else if(i == currentTab.focussedMark) {
                            /* currently focussed mark deleted set the
                             * focussed mark to one previous to the
                             * deleted mark
                             */
                            if(i > 0) {
                                currentTab.focussedMark = i - 1;
                            } else if(i == 0) {
                                currentTab.focussedMark = i;
                            }

                            this.repaintMark(currentDoc, 
                                             currentTab.marks[currentTab.focussedMark],
                                             "rgb(0, 255, 0)");
                        }
                                
                        /* we've handled the clearing of the mark, get
                         * out 
                         */
                        break;
                    } else {
                        /* all marks deleted */
                        this.initMarks(currentDoc);
                    }
                }
            }
        }
    },

    /* initializes the webmarks of the document */
    initMarks: function(currentDoc)
    {
        var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);
        if(currentTab) {
            if(currentTab.marks) {
                delete currentTab.marks;
            }
            currentTab.marks = [];
            currentTab.focussedMark = -1;
        }

        /* we've initialized marks, so update menu options */
        this.handleOptionUpdation(false, currentDoc);
    },

    /* given a mark, turns the browser focus to the mark */
    focusMark: function(currentDoc, mark)
    {
        var liveNodes = 
            currentDoc.evaluate("//span[@class='livetext' and @title=\"" + 
                                mark.title + "\"]",
                                currentDoc,
                                null,
                                XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                                null);

        for(var i = 0; i < liveNodes.snapshotLength; i++) {
            var liveNode = liveNodes.snapshotItem(i);
            liveNode.setAttribute("style", 
                                  "background-color: rgb(0, 255, 0); color: rgb(0, 0, 0);");
        }

        if(liveNodes.snapshotLength > 0) {
            var scrollX = this.findPosX(liveNodes.snapshotItem(0));
            var scrollY = this.findPosY(liveNodes.snapshotItem(0));

            /* focus a bit above the highlighted text */
            scrollY -= this.scrollAmount;

            var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);
            currentTab.contentWindow.scroll(scrollX, scrollY);
        }

        if(webmarkerNS.utils.getCurrentTab() 
           == webmarkerNS.utils.getTabOfDocument(currentDoc)) {
               this.handleMarkBoundaries(currentDoc);
           }
    },

    /* focusses the next mark in the document */
    focusNextMark: function(event)
    {
        var currentDoc = content.document;
        var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);
        if(this.isMarkedPage(currentDoc)) {
            if(currentTab.focussedMark < currentTab.marks.length - 1) {
                var previousFocussedMark = currentTab.focussedMark;
                this.repaintMark(currentDoc, 
                                 currentTab.marks[previousFocussedMark], 
                                 "rgb(255, 255, 0)");
        
                currentTab.focussedMark = (currentTab.focussedMark + 1);
            }

            this.focusMark(currentDoc, 
                           currentTab.marks[currentTab.focussedMark]);
        }
    },

    /* focusses the previous mark in the document */
    focusPreviousMark: function(event)
    {
        var currentDoc = content.document;
        var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);
        if(this.isMarkedPage(currentDoc)) {
            if(currentTab.focussedMark > 0) {
                var previousFocussedMark = currentTab.focussedMark;
                this.repaintMark(currentDoc, 
                                 currentTab.marks[previousFocussedMark], 
                                 "rgb(255, 255, 0)");
                currentTab.focussedMark = currentTab.focussedMark - 1;
            }

            this.focusMark(currentDoc, 
                           currentTab.marks[currentTab.focussedMark]);
        }
    },

    /* checks if mark 'a' appears before mark 'b' in the document, based
     * on their co-ordinates
     */
    greaterMark: function(a, b)
    {
        if(a.startY > b.startY) {
            return true;
        } else if(a.startY < b.startY) {
            return false;
        } else if(a.startY == b.startY) {
            if(a.startX >= b.startX) {
                return true;
            } else {
                return false;
            }
        }
    },

    /* clears the mark with the given title, if title is '*' all the
     * marks of the page are cleared
     */
    clearMarks: function(currentDoc, title)
    {
        this.clearHighlight(currentDoc, title);
        this.removeMarks(currentDoc, title);

        /*
          if(webmarkerNS.utils.getCurrentTab() 
          == webmarkerNS.utils.getTabOfDocument(currentDoc)) {
          this.handleMarking(false, currentDoc);
          }
        */

        /* we've cleared marks on the page, so update menu options */
        this.handleOptionUpdation(false, currentDoc);
    },

    /* clears all highlighted nodes in the page */
    clearHighlight: function(currentDoc, title)
    {
        var xpath = "//span[@class='livetext'";

        if(title == "*") {
            xpath += "]";
        } else {
            xpath += " and @title=\"" + title + "\"]";
        }
            
        var liveNodes = currentDoc.evaluate(xpath,
                                            currentDoc,
                                            null,
                                            XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                                            null);
        
        var savedXOffset;
        var savedYOffset;
        
        if(liveNodes.snapshotLength > 0) {
            savedXOffset = content.window.pageXOffset;
            savedYOffset = content.window.pageYOffset;
        }

        for(var i = 0; i < liveNodes.snapshotLength; i++) {
            var liveNode = liveNodes.snapshotItem(i);
            var parent = liveNode.parentNode;
            parent.replaceChild(liveNode.childNodes[0], liveNode)
            parent.normalize();
        }

        if(liveNodes.snapshotLength > 0) {
            currentDoc.location.hash = "#";
            content.window.scroll(savedXOffset, savedYOffset);
        }

    },

    /* copies the marked fragments of the page the clip board.  Two new
     * lines are inserted between the marks.
     */
    copyFragmentTexts: function(event)
    {
        var fragments = "";
        var currentDoc = content.document;
        var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);
        for(var i = 0; i < currentTab.marks.length; i++) {
            var fragmentText = currentTab.marks[i].fragmentText;
            fragments += fragmentText;
            fragments += "\n\n\n";
        }
        
        webmarkerNS.utils.copyToClipboard(fragments);
    },

    /* repaints a given mark with the specified colour */
    repaintMark: function(currentDoc, mark, colour)
    {
        var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);
        if(mark) {
            var markedLiveNodes = currentDoc.evaluate(
                                                      "//span[@class='livetext' and @title=\"" + mark.title + "\"]",
                                                      currentDoc,
                                                      null,
                                                      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
                                                      null);

            for(var i = 0; i < markedLiveNodes.snapshotLength; i++) {
                var markedLiveNode = markedLiveNodes.snapshotItem(i);
                markedLiveNode.
                    setAttribute("style", "background-color: " + colour
                                 + "; color: rgb(0, 0, 0);");
            }
        }
    },

    /* returns true if any marks exist of the document */
    isMarkedPage: function(currentDoc)
    {
        var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);
        if(currentTab && currentTab.marks) {
            if(currentTab.marks.length > 0) {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    },

    /* takes care of enabling/disabling marks once we hit mark boundaries */
    handleMarkBoundaries: function(currentDoc)
    {
        var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);
        
        if((!currentTab.marks) || (currentTab.marks.length == 0)) {
            this.disableNextMarkNavigation();
            this.disablePreviousMarkNavigation();
            return;
        }

        if(currentTab.focussedMark == (currentTab.marks.length - 1)) {
            this.disableNextMarkNavigation();
        } else {
            this.enableNextMarkNavigation();
        }

        if(currentTab.focussedMark <= 0) {
            this.disablePreviousMarkNavigation();
        } else {
            this.enablePreviousMarkNavigation();
        }
    },

    /* enables the marker pen when text is selected a page */
    handleTextSelection: function(e, currentDoc)
    {
        if(webmarkerNS.utils.isTextSelected(currentDoc)) {
            this.showSelectionOptions("context");
            this.hideNoTextOption("context");
        } else {
            this.hideSelectionOptions("context");
            if(!this.isMarkedPage(currentDoc)) {
                this.showNoTextOption("context");
            }
        }
    },

    /* updates the options available to the user based on the user
     * action
     */
    handleOptionUpdation: function(e, currentDoc)
    {
        if(webmarkerNS.utils.getCurrentTab() == 
            webmarkerNS.utils.getTabOfDocument(currentDoc)) {
               this.handleTextSelection(e, currentDoc);
               this.handleMarking(e, currentDoc);
               this.handleClickOnMark(e, currentDoc);
           }
    },

    /* once a page is marked or cleared of all marks the mark related
     *  options are enabled or disabled respectively
     */
    handleMarking: function(e, currentDoc)
    {
        if(!this.isMarkedPage(currentDoc)) {
            this.hideMarkOptions(currentDoc, "context");
        } else {
            this.showMarkOptions(currentDoc, "context");
            this.hideNoTextOption("context");
        }

        this.handleMarkBoundaries(currentDoc);
    },

    /* we need to monitor clicks on marks to make deletion of specific
     *  marks possible
     */
    handleClickOnMark: function(e, currentDoc)
    {
        var popupNode = document.popupNode;
        if(popupNode) {
            if(popupNode.getAttribute("class") == "livetext") {
                this.showClearMarkOption("context");
                var title = popupNode.getAttribute("title");
                webmarkerNS.webmarker.markForDeletion = title;
            } else {
                this.hideClearMarkOption("context");
            }
        } else {
            this.hideClearMarkOption("context");
        }
    },

    /* on text selection, enable corresponding options */
    showSelectionOptions: function(place)
    {
        /* Enable the mark selection menuitem. */
        document.getElementById(place + "-webmarker-mark-selection").
        setAttribute("hidden", false);
        /* Enable the copy link to selected text menuitem. */
        document.getElementById(place + "-webmarker-selection").
        setAttribute("hidden", false);
        /*
          document.getElementById(place + "-webmarker-bookmark-selection").
          setAttribute("hidden", false);
        */

        /* quirk to handle the menu option, got to remove this */
        document.getElementById("menu-webmarker-mark-selection").
        setAttribute("hidden", false);

        /* Enable the corresponding commands for the menuitems
         *  enabled above.
         */
        //document.getElementById("cmd_webmarker_mark_selection").
        //setAttribute("disabled", false);
        document.getElementById("cmd_webmarker_copy_link_to_selection").
        setAttribute("disabled", false);

        /* document.getElementById("cmd_webmarker_bookmark_selection").
         * setAttribute("disabled", false);
         */
            
        /* handle images for marker */
        /*
        var marker = document.getElementById("webmarker-mark-button");
        marker.setAttribute("image", "chrome://webmarker/skin/marker.png");

        marker =
        document.getElementById("webmarker-mark-button-floating");
        if(marker) {
            marker.setAttribute("image", "chrome://webmarker/skin/marker.png");
        }
        */
    },

    /* on no text selection, disable corresponding options */
    hideSelectionOptions: function(place)
    {
        /* Disable the mark selection menuitem */
        document.getElementById(place + "-webmarker-mark-selection").
        setAttribute("hidden", true);
        /* Disable the copy link and bookmark selected text items  */
        document.getElementById(place + "-webmarker-selection").
        setAttribute("hidden", true);
        /*
          document.getElementById(place + "-webmarker-bookmark-selection").
          setAttribute("hidden", true);
        */

        /* quirk to handle the menu option, got to remove this */
        document.getElementById("menu-webmarker-mark-selection").
        setAttribute("hidden", true);

        /* Disable the corresponding commands. */
        //document.getElementById("cmd_webmarker_mark_selection").
        //setAttribute("disabled", true);
        document.getElementById("cmd_webmarker_copy_link_to_selection").
        setAttribute("disabled", true);
        /*
          document.getElementById("cmd_webmarker_bookmark_selection").
          setAttribute("disabled", true);
        */

        /* handle images for marker */
        /*
        var marker = document.getElementById("webmarker-mark-button");
        marker.setAttribute("image",
                            "chrome://webmarker/skin/marker_greyed.png");

        marker =
        document.getElementById("webmarker-mark-button-floating");
        if(marker) {
            marker.setAttribute("image",
                                "chrome://webmarker/skin/marker_greyed.png");
        }
        */
    },
    
    /* on the page being marked, enable relevant options */
    showMarkOptions: function(currentDoc, place)
    {
        document.getElementById(place + "-webmarker-search").
        setAttribute("hidden", false);
        document.getElementById(place + "-webmarker-clearhighlight").
        setAttribute("hidden", false);
        document.getElementById(place + "-webmarker-bookmark-document").
        setAttribute("hidden", false);
        document.getElementById(place + "-webmarker-navigation-menu").
        setAttribute("hidden", false);
        document.getElementById(place + "-webmarker-copy-fragments").
        setAttribute("hidden", false);
        
        document.getElementById("cmd_webmarker_copy_link_to_marked_document").
        setAttribute("disabled", false);
        document.getElementById("cmd_webmarker_clear_all_marks").
        setAttribute("disabled", false);
        document.getElementById("cmd_webmarker_bookmark_marked_document").
        setAttribute("disabled", false);
        document.getElementById("cmd_webmarker_copy_fragments").
        setAttribute("disabled", false);

        var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);
        if(currentTab.marks) {
            if(currentTab.marks.length > 1) {
                this.enableNavigation();
            } else {
                this.disableNavigation();
            }
        }

        /* handle images, we need to do it for the toolbar as well as
         * the floating buttons
         */
        var link = document.getElementById("webmarker-clipboard-document");
        link.setAttribute("image", "chrome://webmarker/skin/link.png");

        link = 
        document.getElementById("webmarker-clipboard-document-floating");
        if(link) {
            link.setAttribute("image", "chrome://webmarker/skin/link.png");
        }

        var bookmark =
        document.getElementById("webmarker-bookmark-document");
        bookmark.setAttribute("image", "chrome://webmarker/skin/bookmark.png");

        bookmark =
        document.getElementById("webmarker-bookmark-document-floating");
        if(bookmark) {
            bookmark.setAttribute("image", 
                                  "chrome://webmarker/skin/bookmark.png");
        }

        var eraser =
        document.getElementById("webmarker-clearall-button");
        eraser.setAttribute("image", "chrome://webmarker/skin/eraser.png");

        eraser =
        document.getElementById("webmarker-clearall-button-floating");
        if(eraser) {
            eraser.setAttribute("image", "chrome://webmarker/skin/eraser.png");
        }

        var copyFragments = 
        document.getElementById("webmarker-copy-fragments");
        copyFragments.
        setAttribute("image", "chrome://webmarker/skin/copy_fragments.png");

        copyFragments = 
        document.getElementById("webmarker-copy-fragments-floating");
        if(copyFragments) {
            copyFragments.
            setAttribute("image", "chrome://webmarker/skin/copy_fragments.png");
        }
    },

    /* on the page being cleared of all marks, disable relevant options */
    hideMarkOptions: function(currentDoc, place)
    {
        document.getElementById(place + "-webmarker-search").
        setAttribute("hidden", true);
        document.getElementById(place + "-webmarker-clearhighlight").
        setAttribute("hidden", true);
        document.getElementById(place + "-webmarker-bookmark-document").
        setAttribute("hidden", true);
        document.getElementById(place + "-webmarker-navigation-menu").
        setAttribute("hidden", true);
        document.getElementById(place + "-webmarker-copy-fragments").
        setAttribute("hidden", true);

        document.getElementById("cmd_webmarker_copy_link_to_marked_document").
        setAttribute("disabled", true);
        document.getElementById("cmd_webmarker_clear_all_marks").
        setAttribute("disabled", true);
        document.getElementById("cmd_webmarker_bookmark_marked_document").
        setAttribute("disabled", true);
        document.getElementById("cmd_webmarker_copy_fragments").
        setAttribute("disabled", true);

        var currentTab = webmarkerNS.utils.getTabOfDocument(currentDoc);
        if(currentTab.marks) {
            if(currentTab.marks.length <= 1) {
                this.disableNavigation();
            } else {
                this.enableNavigation();
            }
        }

        /* handle images */
        var link = document.getElementById("webmarker-clipboard-document");
        link.setAttribute("image", "chrome://webmarker/skin/link_greyed.png");
        link =
        document.getElementById("webmarker-clipboard-document-floating");
        if(link) {
            link.setAttribute("image", 
                              "chrome://webmarker/skin/link_greyed.png");
        }

        var bookmark =
        document.getElementById("webmarker-bookmark-document");
        bookmark.setAttribute("image",
                              "chrome://webmarker/skin/bookmark_greyed.png");
        bookmark =
        document.getElementById("webmarker-bookmark-document-floating");
        if(bookmark) {
            bookmark.
            setAttribute("image",
                         "chrome://webmarker/skin/bookmark_greyed.png");
        }

        var eraser =
        document.getElementById("webmarker-clearall-button");
        eraser.setAttribute("image",
                            "chrome://webmarker/skin/eraser_greyed.png");
        eraser =
        document.getElementById("webmarker-clearall-button-floating");
        if(eraser) {
            eraser.setAttribute("image",
                                "chrome://webmarker/skin/eraser_greyed.png");
        }

        var copyFragments = 
        document.getElementById("webmarker-copy-fragments");
        copyFragments.
        setAttribute("image", 
                     "chrome://webmarker/skin/copy_fragments_greyed.png");

        copyFragments = 
        document.getElementById("webmarker-copy-fragments-floating");
        if(copyFragments) {
            copyFragments.
            setAttribute("image", 
                         "chrome://webmarker/skin/copy_fragments_greyed.png");
        }
    },

    showClearMarkOption: function(place)
    {
        document.getElementById(place + "-webmarker-clearmark").
        setAttribute("hidden", false);
        document.getElementById("cmd_webmarker_clear_mark").
        setAttribute("disabled", false);
    },

    hideClearMarkOption: function(place)
    {
        document.getElementById(place + "-webmarker-clearmark").
        setAttribute("hidden", true);
        document.getElementById("cmd_webmarker_clear_mark").
        setAttribute("disabled", true);
    },

    hideNoTextOption: function(place)
    {
        document.getElementById(place + "-webmarker-notext").
        setAttribute("hidden", true);
    },
    
    showNoTextOption: function(place)
    {
        document.getElementById(place + "-webmarker-notext").
        setAttribute("hidden", false);
    },

    enableNavigation: function()
    {
        this.enableNextMarkNavigation();
        this.enablePreviousMarkNavigation();
    },

    disableNavigation: function()
    {
        this.disableNextMarkNavigation();
        this.disablePreviousMarkNavigation();
    },

    disableNextMarkNavigation: function()
    {
        var next = document.getElementById("webmarker-next-button");
        next.setAttribute("image",
                          "chrome://webmarker/skin/next_greyed.png");
        document.getElementById("cmd_webmarker_goto_next_mark").
        setAttribute("disabled", true);
    },
    
    disablePreviousMarkNavigation: function()
    {
        var previous = document.getElementById("webmarker-previous-button");
        previous.setAttribute("image",
                              "chrome://webmarker/skin/previous_greyed.png");
        document.getElementById("cmd_webmarker_goto_previous_mark").
        setAttribute("disabled", true);
    },
    
    enableNextMarkNavigation: function()
    {
        var next = document.getElementById("webmarker-next-button");
        next.setAttribute("image",
                          "chrome://webmarker/skin/next.png");
        document.getElementById("cmd_webmarker_goto_next_mark").
        setAttribute("disabled", false);
    },

    enablePreviousMarkNavigation: function()
    {
        var previous = document.getElementById("webmarker-previous-button");
        previous.setAttribute("image",
                              "chrome://webmarker/skin/previous.png");
        document.getElementById("cmd_webmarker_goto_previous_mark").
        setAttribute("disabled", false);
    }

};

/* a simple webmark object */
function webmark()
{
    /* setup fields of a webmark */
    this.fragmentID = "";
    this.startX = 0;
    this.startY = 0;
    this.title = "";
    this.fragmentText = "";
}
