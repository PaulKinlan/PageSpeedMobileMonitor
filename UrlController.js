(function(w) {
  var urlToId = function(url) {
    return btoa(url).replace(/=/g, "").replace(/\+/g, "");
  };


  var PageSpeedInsightsAPI = function(apiKey) {
    function serialize(obj) {
      var str = [];
      for(var p in obj) {
        var k = p;
        var v = obj[p];
        str.push(
          v instanceof Array ?
            k + "=" + v.join("&" + k +"=") :
              typeof v == "object" ? 
                serialize(v) : 
              encodeURIComponent(k) + "=" + encodeURIComponent(v));
      }
      return str.join("&");
    }

    function buildUrl(url) {
      var fetchUrl = "https://www.googleapis.com/pagespeedonline/v1/runPagespeed";
      var parameters = {
        key: "AIzaSyBdyrTIOcz9X5KHj5utziotD0W_2SCoroU",
        strategy: "mobile",
        screenshot: "true",
        rule: ["AvoidLandingPageRedirects", "ServerResponseTime" , "MinimizeRenderBlockingResources", "PrioritizeVisibleContent", "EnableGzipCompression", "InlineRenderBlockingCss", "PreferAsyncResources"],
        url: encodeURI(url),
      };
   
      var options = {};
  
      return fetchUrl + "?" + serialize(parameters);
    }
 
    this.fetch = function(url, callback, errorCallback) {
      errorCallback = errorCallback || function() {};
      var xhr = new XMLHttpRequest();
      xhr.onload = function() {
        var response = JSON.parse(xhr.responseText);
        if(!!response.error === true) {
          errorCallback(response);
        }
        else {
          callback({
            "response": response,
            "screenshot": "data:" + response.screenshot.mime_type  + ";base64," + response.screenshot.data.replace(/_/g, "/").replace(/-/g, "+")
          });
        }
      }

      xhr.open("GET", buildUrl(url));
      xhr.send();
    };
  };
  
  var UrlView = function(root) {
    var rootElement = document.getElementById(root);
    var addElement = rootElement.querySelector("#add");
    var newUrlElement = rootElement.querySelector("#newUrl");
    var urlList = rootElement.querySelector("#urllist");

    var evtAddUrl = function(e) {
      if(this.onAddUrl) {
        this.onAddUrl(newUrlElement.value);
      }
    }.bind(this);
 
    var evtRemoveUrl = function(e) {
      if(this.onRemoveUrl) {
        this.onRemoveUrl(e.target.dataset["url"])
      }
    }.bind(this);

    addElement.onclick = evtAddUrl;

    this.addUrl = function(url) {
      var row = urlList.insertRow(-1);
      var urlCell = row.insertCell(0);
      var scoreCell = row.insertCell(1);
      var controlsCell = row.insertCell(2);
      var lastChecked = document.createElement("span"); 
      var score = document.createElement("span");
      row.id = urlToId(url);

      score.className = "score";
      scoreCell.className = "scorecell";
      urlCell.className = "url";
      controlsCell.className = "controls";
      lastChecked.className = "lastChecked";

      scoreCell.appendChild(score)
 
      var urlAnchor = document.createElement("a");
      urlAnchor.href = "https://developers.google.com/speed/pagespeed/insights/?url=" + encodeURIComponent(url);
      urlAnchor.target = "_blank";
      urlAnchor.textContent = url;
      urlCell.appendChild(urlAnchor);
      urlCell.appendChild(lastChecked)

      var removeButton = document.createElement("a");
      removeButton.textContent = "x"
      removeButton.dataset["url"] = url;
      removeButton.onclick = evtRemoveUrl;
      controlsCell.appendChild(removeButton);
    };

    this.removeUrl = function(url) {
      var row = urlList.querySelector("#" + urlToId(url));
      row.parentElement.removeChild(row);
    }

    this.updateUrl = function(url, score) {
      var row = urlList.querySelector("#" + urlToId(url));
      var scoreCell = row.querySelector(".score");
      var lastCheckedCell = row.querySelector(".lastChecked");
      var scoreType = (score > 85) ? "good" : (score > 50) ? "warning" : "poor"; 
 
      scoreCell.dataset["score"] = score; 
      scoreCell.classList.add(scoreType);
      scoreCell.textContent = score;
      lastCheckedCell.textContent = new Date();
    };
 
    this.showError = function(error) {
      
    };
  };
  
  var UrlController = function(view, storage) {

    var onPeriod = function(alarm) {
      var url = alarm.name;
      var api = new PageSpeedInsightsAPI();
      
      var successCallback = function(response) {
        view.updateUrl(url, response.response.score);
      };

      var errorCallback = function(response) {
        view.showError("Error fetching results for " + url);
      };

      api.fetch(url, successCallback, errorCallback);
    };
 
    var init = function() {
      view.onAddUrl = function(url) {
        // The user wants to add a URL
        addUrl(url);
      };

      view.onRemoveUrl = function(url) {
        // The user wants to remove a url
        removeUrl(url);
      };

      storage.getAllUrls(function(urls) {
        for(var url in urls) {
          view.addUrl(url);
        }
      });

      // this ties this controller to Chrome.
      chrome.alarms.onAlarm.addListener(onPeriod);
    };

    var addUrl = function(url) {
      var callback = function() {
        chrome.alarms.create(url, {periodInMinutes: 60})
        view.addUrl(url);
      };
    
      var errorCallback = function() {
        view.showError("There was an error adding Url");
      };

      storage.addUrl(url, callback, errorCallback); 
    };

    var removeUrl = function(url) {  
      var callback = function() {
        chrome.alarms.clear(url);
        view.removeUrl(url);
      };

      var errorCallback = function() {
        view.showError("There was an error removing Url");
      };
  
      storage.removeUrl(url, callback, errorCallback);
    };

    init();
  };
 
  var ChromeAppStorage = function() {
    this.setApiKey = function(apiKey, callback) {};
 
    this.getAllUrls = function(callback) {
      chrome.storage.sync.get("urls", function(keys) {
        callback(keys.urls);
      });
    };

    this.addUrl = function(url, callback, errorCallback) {
      errorCallback = errorCallback || function() {};
      chrome.storage.sync.get("urls", function(keys) {
        keys.urls = keys.urls || {};
        if(url in keys.urls == false) {
          keys.urls[url] = 1;
          chrome.storage.sync.set({urls:keys.urls}, function() {
            callback(url); 
          });
          if(chrome.runtime.lastError) errorCallback();
        } 
      });

      if(chrome.runtime.lastError) errorCallback();
    };

    this.removeUrl = function(url, callback, errorCallback) {
      errorCallback = errorCallback || function() {};
      chrome.storage.sync.get("urls", function(keys) {
        if(url in keys.urls) {
          delete keys.urls[url];
          chrome.storage.sync.set({urls:keys.urls}, function() {
            callback(url); 
          });
          if(chrome.runtime.lastError) errorCallback();
        } 
      });

      if(chrome.runtime.lastError) errorCallback();
    
    };
  };
  
  var init = function() {
    w.UrlController = UrlController(new UrlView("urls"), new ChromeAppStorage);
  };  

  if(w.document.readyState == "complete") {  
    init();
  }
  else {
    w.onload = function() { init() };
  }
})(window);

