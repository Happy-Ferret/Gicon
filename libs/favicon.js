var urlParser = require("url");

var $ = require("cheerio");
var async = require("async");

var request = require("./utils/request");
var error = require("./utils/errors");

/**
 * get favicon path or buffer
 * @param  {[type]}   domain   [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
exports.favicon = function(domain, callback) {
  if(typeof domain !== "string" || typeof callback !== "function") {
    return callback(error.MISSING_PARAMS());
  }
  if(domain.substring(0, 4) !== "http") {
    domain = "http://" + domain;
  }
  followRedirectUrl(domain, function(err, url) {
    if(err) { return callback(err); }
    if(url) {
      url = url.replace(/\/$/, "")
    }

    getFaviconLink(url, function(err, path, buffer) {
      if(err) { return callback(err); }

      if(path && buffer) {
        return callback(null, path, buffer); 
      }

      getFaviconPath(url, function(err, path, buffer) {
        if(err) { return callback(err); }

        if(path && buffer) { 
          return callback(null, path, buffer); 
        }
        
        callback();
        
      });

    });

  });
};

// 获取Favicon.ico
function getFaviconPath(domain, callback) {
  callback = callback || function() {};
  if(!domain) {
    return callback(error.DOMAIN_CANNOT_NULL());
  }

  domain = domain + "/favicon.ico";
  request({ url: domain, method: "GET", encoding: null }, 
    function(err, resp, body) {

    if(err) { return callback(error.REQUEST_ERROR()); }

    if(resp && resp.statusCode == 200 && body.length
      && /^image/.test(resp.headers["content-type"]) ) {
      return callback(null, [domain], body);
    }
    callback();
  });
}

// 获取Link rel=icon的地址
function getFaviconLink(domain, callback) {
  callback = callback || function() {};
  if(!domain) { return callback(error.DOMAIN_CANNOT_NULL()); }

  request.get(domain, function(err, result, body) {
    if(err) { return callback(error.REQUEST_ERROR(err)); }
    var links = $(body).find("link[rel*='icon']");
    var favicons = links.map(function(index, link) {
      return link.attribs ? link.attribs["href"] : null;
    }).filter(function(index, link) {
      return link != null && link.length > 0;
    });

    async.map(favicons, function(favicon, callback) {
      var path = /^http/.test(favicon) ? favicon : (domain + favicon);
      favicon ? request({ 
        url: path, 
        method: "GET", 
        encoding: null 
      }, function(err, resp, body) {
        if(err) { return callback(error.REQUEST_ERROR()); }

        if(resp && resp.statusCode == 200 && body.length
          && /^image/.test(resp.headers["content-type"]) ) {
          return callback(null, path);
        } else {
          callback(null);
        }
      }) : callback(null);
    }, function(err, result) {
      var favicons = result.filter(function(index, link) {
        return link && link.length;
      });
      return callback(null, favicons, body);
    });
  });
}

function getDefaultIcon(callback) { }

// 追踪30X的最终地址
function followRedirectUrl(url, callback) {
  if(!url) {
    return callback(error.CANNOT_GET_ICON());
  }
  request.get(url, {
    followRedirect: false
  }, function(err, resp, body) {
    if(err) {
      return callback(error.REQUEST_ERROR(err));
    }
    if(resp && resp.statusCode > 300 && resp.statusCode < 400 
        && resp.headers && resp.headers.location) {
      followRedirectUrl(resp.headers.location, callback);
    } else {
      var refreshUrl = $(body).find("meta[http-equiv='refresh']")
                              .attr("content")
                              .split(';')
                              .filter(path => path.indexOf('http') != -1);
      if (refreshUrl && refreshUrl.length) {
        followRedirectUrl(refreshUrl[0], callback);
      } else {
        var urlobj = urlParser.parse(url);
        var path = urlobj.protocol + "//" + urlobj.host + urlobj.pathname;
        callback(null, path);
      }
    }
  });
}