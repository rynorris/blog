"use strict";

/*
 * UI Code.
 */

// Object representing one article on the page.
var article = function article(id) {
  var panel = $("<div/>", {
    "class": "panel",
    "id": id,
  });

  // Add the right class depending on if this article has been read or not.
  if (userHistory.hasBeenRead(id)) {
    panel.addClass("panel-default");
  } else {
    panel.addClass("panel-primary");
  }

  // Heading part of panel.
  var heading = $("<div/>", {
    "class": "panel-heading",
    "role": "tab",
  });
  heading.appendTo(panel);

  var title = $("<h3/>", { "class": "panel-title" });
  title.appendTo(heading);

  var button = $("<a/>", {
    "class": "collapsed",
    "role": "button",
    "data-toggle": "collapse",
    "data-parent": "#articles",
    "href": "#article-" + id,
    "aria-expanded": "false",
    "aria-controls": "article-" + id,
  });
  button.appendTo(title);

  var icon = $("<span/>", { "class": "glyphicon glyphicon-menu-left article-dropdown-icon" });
  icon.appendTo(button);

  button.append("<span/>");

  // Body part of panel.
  var articleDiv = $("<div/>", {
    "class": "panel-collapse collapse",
    "id": "article-" + id,
    "role": "tabpane",
    "aria-labelledby": "heading-" + id,
  });
  articleDiv.appendTo(panel);

  articleDiv.on("show.bs.collapse", function articleShow() {
    var glyphicon = button.find(".article-dropdown-icon");
    glyphicon.removeClass("glyphicon-menu-left");
    glyphicon.addClass("glyphicon-menu-down");
    requestArticle(id);
  });

  articleDiv.on("shown.bs.collapse", function articleShown() {
    userHistory.markAsRead(id);
  });

  articleDiv.on("hide.bs.collapse", function articleHide() {
    var glyphicon = button.find(".article-dropdown-icon");
    glyphicon.removeClass("glyphicon-menu-down");
    glyphicon.addClass("glyphicon-menu-left");

    // When hiding, update class to reflect read state.
    panel.removeClass("panel-primary");
    panel.addClass("panel-default");
  });

  var body = $("<div/>", { "class": "panel-body" });
  body.appendTo(articleDiv);

  var setTitle = function setTitle(text) {
    button.find("span").last().text(text);
  };
  panel.setTitle = setTitle;

  var setBody = function setBody(html) {
    body.html(html);
  };
  panel.setBody = setBody;

  return panel;
};

// Creates a new article panel and attaches it to the articles list.
// Does not make it visible.  The caller must make it visible.
var newArticle = function newArticle(id, title) {
  var thisArticle = article(id);
  thisArticle.setTitle(title);
  thisArticle.setBody("<div class=\"throbber-loader\"></div>");
  thisArticle.hide();
  $("#articles").prepend(thisArticle);
  return thisArticle;
};

var createArticleBodies = function createArticleBodies(id, bodies) {
  var body = $("#" + id).find(".panel-body");
  body.html("");

  var tablist = $("<ul/>", { "class": "nav nav-tabs", "role": "tablist" });
  var tabcontent = $("<div/>", { "class": "tab-content" });
  $.each(bodies, function createBody(lang, html) {
    var li = $("<li/>", { "role": "presentation" });
    var langId = id + "-" + lang;
    li.append($("<a/>", {
      "href": "#" + langId,
      "aria-controls": langId,
      "role": "tab",
      "data-toggle": "tab",
    }).text(lang));

    var div = $("<div/>", {
      "role": "tabpanel",
      "class": "tab-pane",
      "id": langId,
    }).html(html);

    tablist.append(li);
    tabcontent.append(div);
  });

  tablist.find("li").first().addClass("active");
  tabcontent.find("div").first().addClass("active");

  body.append(tablist);
  body.append(tabcontent);

  // Add Permalink.
  var permalink = $("<a/>", {
    "href": "?permalink=" + id,
    "class": "permalink",
  });
  permalink.text("Link to this article.");
  permalink.on("click", function permalinkClick(event) {
    // Use our own click handler so we can do smooth insta-loads if supported.
    event.preventDefault();
    doPermalink(id);
  });

  var linkIcon = $("<span/>", {
    "class": "glyphicon glyphicon-link",
  });
  permalink.prepend(linkIcon);

  body.append(permalink);
};

var openArticle = function openArticle(id) {
  userHistory.markAsRead(id);
  $("#" + id).find(".collapse").collapse("show");
};


/*
 * Generic message handling code.
 */
var handleMessage = function handleMessage(msg) {
  console.log("Received: " + msg);
  var data = JSON.parse(msg);
  $.each(data, function handleOneArticle(index, articleData) {
    console.log("Data for articleData " + articleData.id);
    if ($("#" + articleData.id).length === 0) {
      console.log("articleData doesn't exist.  Create.");
      var titles = $.map(articleData.title, function identity(val) { return val; });

      // Fade new articleDatas in from the top down.
      var fadeDelay = Math.min(20, (data.length - (index + 1))) * 50;
      newArticle(articleData.id, titles.join(" | ")).delay(fadeDelay).fadeIn();
    }

    if (articleData.body) {
      console.log("Body present.  Fill articleData contents.");
      createArticleBodies(articleData.id, articleData.body);
    }
  });
};

var requestArticle = function requestArticle(id, doAfter) {
  /*eslint-disable*/
  if (false) {
    // Use websockets.

    var query = {
      "id": id,
      "includeBody": true,
    };

    var msg = JSON.stringify(query);
    console.log("Sending: " + msg);
    connection.send(msg);
  /*eslint-enable*/
  } else {
    // Use Ajax
    $.get("/article/" + id, {}, function getArticleCb(resp) {
      handleMessage(resp);
      if (typeof doAfter === "function") {
        doAfter();
      }
    });
  }
};


/*
 * Websocket Code.
 */
var connect = function connect(addr) {
  var ws = new WebSocket(addr);
  ws.onopen = function wsOpen() {
    console.log("Data connection open.");
  };

  ws.onmessage = function wsMessage(msg) {
    handleMessage(msg.data);
  };

  return ws;
};


/*
 * Article history handling module.
 */
var articleHistory = function articleHistory() {
  var obj = {};
  var myHistory = [];

  var loadArticleHistory = function loadArticleHistory() {
    // Requires HTML 5 Web Storage.
    if (typeof Storage !== "undefined") {
      myHistory = JSON.parse(localStorage.getItem("article-history"));
      if (history) {
        console.log("Loaded article history from localStorage");
      }
    } else {
      console.log("HTML5 Web Storage not supported, article history will not persist across sessions");
    }
  };

  var saveArticleHistory = function saveArticleHistory() {
    // Requires HTML 5 Web Storage.
    if (typeof Storage !== "undefined") {
      localStorage.setItem("article-history", JSON.stringify(myHistory));
    }
  };

  var clearHistory = function clearHistory() {
    myHistory = [];
    saveArticleHistory();
  }
  obj.clear = clearHistory;

  var hasBeenRead = function hasBeenRead(id) {
    return (myHistory.indexOf(id) !== -1);
  };
  obj.hasBeenRead = hasBeenRead;

  var markAsRead = function markAsRead(id) {
    myHistory.push(id);
    saveArticleHistory();
  };
  obj.markAsRead = markAsRead;

  loadArticleHistory();
  return obj;
};


/*
 * Browser History Handler.
 */
var browserHistory = function browserHistory() {
  var obj = {};

  var replaceHistory = function replaceHistory(state, name, url) {
    if (history.pushState) {
      state.popstate = true;
      console.log("Replacing current history state: ", state);
      history.replaceState(state, name, url);
    } else {
      console.log("History manipulation not supported.");
    }
  };
  obj.replace = replaceHistory;

  var pushHistory = function pushHistory(state, name, url) {
    if (history.pushState) {
      state.popstate = true;
      console.log("Pushing history state: ", state);
      history.pushState(state, name, url);
    } else {
      console.log("History manipulation not supported.");
    }
  };
  obj.push = pushHistory;

  var loadHistory = function loadHistory(state) {
    console.log("Loading previous page with state: ", state);

    // If this state wasn't created by us, ignore it.
    // Sometimes chrome throws random blank popstate events for no reason.
    if ((state === null) ||
        (typeof state.popstate === "undefined")) {
      console.log("Not defined by us. Ignore.");
      return;
    }

    if (state.article) {
      // Indicates a permalink.
      console.log("Permalink: " + state.article);
      resetPage();
      loadPermalink(state.article);
    } else {
      // Must be home.
      console.log("Home");
      resetPage();
      loadMainPage();
    }
  };
  obj.load = loadHistory;

  return obj;
};


/*
 * Page entry points
 */
var mainPageBegin = function mainPageBegin() {
  var match = location.search.match(/permalink=[a-zA-Z0-9-_]+/);
  if (match) {
    var id = match[0].split("=")[1];
    historyHandler.replace({ "article": id }, "Permalink: " + id, "?permalink=" + id);
    loadPermalink(id);
  } else {
    historyHandler.replace({}, "Home", "/");
    loadMainPage();
  }
};

// These are to be used directly for initial page load.
var loadMainPage = function loadMainPage() {
  if (window.WebSocket && false) {
    console.log("Websocket supported, opening connection...");
    if (typeof connection === "undefined") {
      /*eslint-disable*/
      connection = connect("ws://localhost:8080/ws");
      /*eslint-enable*/
    }

    var query = {
      "from": 0,
      "to": 0,
      "includeBody": false,
    };

    var msg = JSON.stringify(query);
    console.log("Sending: " + msg);
    /*eslint-disable*/
    connection.send(msg);
    /*eslint-enable*/
  } else {
    console.log("Websocket not supported, make Ajax request for all articles");
    $.get("/article/", {}, function getArticleCb(resp) {
      handleMessage(resp);
    });
  }
};

var loadPermalink = function loadPermalink(id) {
  requestArticle(id, function permalinkCb() {
    // Since this is a permalink, expand the panel and lock it open.
    openArticle(id);
    var link = $("#" + id).find("a").first();
    var text = link.text();
    $("<span/>").text(text).insertBefore(link);
    link.remove();
  });
};

// These are to be used after initial load for navigation.
var doMainPage = function doMainPage() {
  $("#articles").fadeOut("fast", function mainPostFade() {
    if (history.pushState) {
      // If we support history manipulation, load new content without reloading the page.
      resetPage();
      historyHandler.push({}, "Home", "/");
      loadMainPage();
    } else {
      // We don"t support history manipulation, so just load the homepage again.
      // This is a shame, but otherwise we would mess up the browser history.
      window.location = "/";
    }
  });
};

var doPermalink = function doPermalink(id) {
  $("#articles").fadeOut("fast", function permaPostFade() {
    if (history.pushState) {
      // If we support history manipulation, load new content without reloading the page.
      resetPage();
      historyHandler.push({ "article": id }, "Permalink: " + id, "?permalink=" + id);
      loadPermalink(id);
    } else {
      // We don"t support history manipulation, so just load the homepage again.
      // This is a shame, but otherwise we would mess up the browser history.
      window.location = "?permalink=" + id;
    }
  });
};

// Clears everything off the page.
var resetPage = function resetPage() {
  $("#articles").empty().show();
  $(".navbar").find(".collapse").collapse("hide");
};


/*
 * Code that actually runs on pageload is kept here.
 */
$(document).ready(function documentReady() {
  // Override click handler on home nav button.
  $("#nav-home").on("click", function navHomeClick(event) {
    // Use our own click handler so we can do smooth insta-loads if supported.
    event.preventDefault();
    doMainPage();
  });

  mainPageBegin();
});

var historyHandler = browserHistory();
window.onpopstate = function historyPopState(event) {
  if (event.state) {
    historyHandler.load(event.state);
  }
};

var userHistory = articleHistory();
