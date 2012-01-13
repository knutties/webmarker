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

/* The main webmarker GUI handling functions */
var webmarkerOverlay = {
    /* Function called when a tab is selected. */
    onTabFocus: function(e)
    {
        var currentDoc = commonUtils.getCurrentTab().contentDocument;
        webmarker.handleOptionUpdation(e, currentDoc);
    },

    /* Function called when a portion of a web-page is marked. */
    onMarkSelection: function(e)
    {
        var currentTab = commonUtils.getCurrentTab();
        var currentDoc = currentTab.contentDocument;
        var marker = document.getElementById("webmarker-mark-button");
        var checked =  !(marker.checked);

        if(commonUtils.isTextSelected(currentDoc)) {
            var selection = currentTab.contentWindow.getSelection();
            var range = selection.getRangeAt(0);

            if(commonUtils.isOverlappedSelection(currentDoc, range)) {
                alert(commonUtils.getLocalizedString('mark.overlap-message'));
            } else {
                if(checked) {
                    webmarker.markRange(currentDoc, range);
                }
            }
            return;
        } else {
            marker.checked = checked;
            marker = document.getElementById("webmarker-mark-button-floating");

            /* the floating button exists only if the user has added it to
             * the navigation bar
             */
            if(marker) {
                marker.checked = checked;
            }
        }
    },

    /* Function called when content on a web-page is selected
     * and an LiveURL is generated.
     */
    onCopySelectionLiveURL: function(e)
    {
        this.onMarkSelection();
        var currentTab = commonUtils.getCurrentTab();
        var currentDoc = currentTab.contentDocument;
        commonUtils.copyToClipboard(
            liveurls.getLiveURL(currentDoc, false, currentTab.focussedMark));
    },

    /* Function to copy the LiveURL of a marked web-page. */
    onCopyDocumentLiveURL: function(e)
    {
        var currentDoc = commonUtils.getCurrentTab().contentDocument;
        commonUtils.copyToClipboard(liveurls.getLiveURL(currentDoc, true));
    },

    /* Function called to bookmark a marked web-page. */
    onBookmarkLiveURL: function(e)
    {
        var currentDoc = commonUtils.getCurrentTab().contentDocument;
        commonUtils.bookmarkURL(liveurls.getLiveURL(currentDoc, true));
    },

    /* Function called to bookmark a selection on a web-page. */
    onBookmarkSelection: function(e)
    {
        this.onMarkSelection(e);
        var currentDoc = commonUtils.getCurrentTab().contentDocument;
        var currentTab = commonUtils.getTabOfDocument(currentDoc);
        var liveURL = 
            liveurls.getLiveURL(false, currentTab.focussedMark);
        commonUtils.bookmarkURL(liveURL);
    },

    /* Function which handles the processing of a LiveURL. */
    processURL: function(event)
    {
        var currentDoc = commonUtils.getDocumentOfEvent(event);
        
        if(!currentDoc) {
            return;
        }

        var fragmentIDs = currentDoc.location.hash.substr(1);
        /* initialize web marks */
        webmarker.initMarks(currentDoc);

        /* unescape and get original info */
        fragmentIDs = unescape(fragmentIDs);
        
        while(fragmentIDs.length > 0) {
            var lenOfFragmentID = parseInt(fragmentIDs.substr(0, 2), 16);
            var fragmentID = fragmentIDs.substr(2, lenOfFragmentID); 
            if(fragmentID) {
                // fragmentID = unescape(fragmentID);
                if(liveurls.processSearchFragmentID(currentDoc, fragmentID)) {
                    this.handleFailure(currentDoc, fragmentID);
                }
            } else {
                break;
            }
            fragmentIDs = fragmentIDs.substr(2 + lenOfFragmentID);
        }

        /* focus first mark of the page if it is there */
        if(webmarker.isMarkedPage(currentDoc)) {
            var currentTab = commonUtils.getTabOfDocument(currentDoc);

            var previousFocussedMark = currentTab.focussedMark;
            webmarker.repaintMark(currentDoc, 
                currentTab.marks[previousFocussedMark], 
                "rgb(255, 255, 0)");

            currentTab.focussedMark = 0;
            webmarker.focusMark(currentDoc, 
                currentTab.marks[currentTab.focussedMark]);
        }
    },

    /* Function to clear all the marks present on a marked web-page */
    onClearAllMarks: function()
    {
        var currentDoc = commonUtils.getCurrentTab().contentDocument;
        webmarker.clearMarks(currentDoc, "*");
    },

    /* Clears a particular mark on a marked web-page. */
    onClearMark: function()
    {
        var currentDoc = commonUtils.getCurrentTab().contentDocument;
        webmarker.clearMarks(currentDoc, webmarker.markForDeletion);
    },

    /* This function handles the failure of processing of a LiveURL.
     * It displays a message saying the LiveURL failed and clears the URL bar.
     */
    handleFailure: function(currentDoc, fragmentID)
    {
        if(!commonUtils.isLivePage(currentDoc)) {
            alert("LiveURL processing failed for " + fragmentID + 
            ".  The indicated content might have changed.  If you still \
            feel this is a bug, please report the bug at \
            http://liveurls.mozdev.org");

            /* reset the fragment ID,  the live fragment ID isn't valid
             * any more
             */
            currentDoc.location.hash = "#";
        }
    }
};

/* events and their event-handlers */

/* Page Load */
window.addEventListener("load", function(e) {
    var container = gBrowser.mPanelContainer;
    container.addEventListener("select", function(e) { 
        webmarkerOverlay.onTabFocus(e); 
    }, false);
    webmarkerOverlay.processURL(e); 
}, false);

/* Page Show. is important to handle back/forward buttons */
window.addEventListener("pageshow", function(e) {
    webmarkerOverlay.processURL(e); 
}, false);

/* Click event of the mouse on the web-page */
/*
window.addEventListener("click", function(e) {
    var currentDoc = content.document;
    webmarker.handleTextSelection(e, currentDoc);
    webmarker.markSelectionMode(currentDoc);
}, false);
*/

/* Mouseup event on the web-page */
window.addEventListener("mouseup", function(e) {
    var currentDoc = content.document;
    webmarker.handleTextSelection(e, currentDoc); 
    webmarker.markSelectionMode(currentDoc);
}, false);

/* Keyup event on the web-page */
window.addEventListener("keyup", function(e) {
    var currentDoc = content.document;
    webmarker.handleTextSelection(e, currentDoc); 
    webmarker.markSelectionMode(currentDoc);
}, false);
