(function(window) {
  'use strict';

  var getDayInCurrentYear = function() {
    var now = new Date();
    var start = new Date(now.getFullYear(), 0, 0);
    var diff = now - start;
    var oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  }

  var getDaysInCurrentYear = function() {
    var year = new Date().getFullYear();
    if(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) {
        // Leap year
        return 366;
    } else {
        // Not a leap year
        return 365;
    }
  }

  // MITE Library (https://github.com/yolk/mite.js/blob/master/mite.js)

  var _defaults      = {
        protocol : 'https',
        domain   : 'mite.yo.lk',
        async    : true,
        timeout  : 60, // 1 minute
        error  : function(xhr, msg) {alert('Error: mite.gyver could not connect with your mite.account!');}
      },
      _nada         = function() {},
      _parseJson    = function(string) { return ( /^\s*$/.test(string) ) ? {} : JSON.parse(string); },
      _buildQuery   = function(params) {
        if(!params || typeof params == 'String') { return params || ''; }

        var queries = [];
        for(var key in params) {
          if(key == '_queryString') {
            queries.push(params[key]);
          } else {
            queries.push([encodeURIComponent(key),encodeURIComponent(params[key])].join('='));
          }
        }
        return queries.join('&');
      },
      _parseOptions = function(options) {
        if(typeof options == 'function') { options = {success: options}; }
        return options || {};
      },
      _extend       = function(obj) {
        for(var i = 1, len = arguments.length; i < len; i++ ) {
          for (var prop in arguments[i]) { obj[prop] = arguments[i][prop]; }
        }
        return obj;
      };

  window.Mite = function(options) {
    if (!options || !options.account || !options.api_key) {
      throw 'account & api_key need to be set';
    }

    ////
    //  Private
    var config = _extend({}, _defaults, options),

    _loading = {},

    _cache = {},

    // build URL for API request
    _buildUrl = function(path) {
      return config.protocol + '://' + 'corsapi.' + config.domain + '/' + path + '.json';
    },

    // ajax call wrapper
    _request = function(method, path, options) {
      var xhr         = new XMLHttpRequest(),
          data        = options.data      || null,
          async       = (typeof options.async == 'boolean') ? options.async : config.async,
          timeout     = options.timeout   || config.timeout,
          timeout_handler, user_input;

      var handle_complete = function(options) {
        var success     = options.success   || _nada,
            error       = options.error     || config.error,
            complete    = options.complete  || _nada,
            response    = {success: null, error: null, complete: null};

        if (/2\d\d/.test(xhr.status)) {
          if(xhr.responseText) {
            response.success = [_parseJson(xhr.responseText)];
            success( response.success[0] );
          } else {
            response.error = [xhr, 'error'];
            error(xhr, 'error');
          }
        } else {
          response.error = [xhr, xhr.responseText || 'error'];
          error(xhr, xhr.responseText || 'error');
        }

        response.complete = xhr;
        complete(xhr);

        return response;
      };

      xhr.onreadystatechange = function(){
        var _resp = null;

        if (xhr.readyState == 4) {
          if (method == 'GET') {

            // make sure to call the callbacks from all GET requests to the same path
            // that have been started while the response was vacant
            for (var i=0; i < _loading[path].length; i++) _cache[path] = handle_complete(_loading[path][i]);

            delete _loading[path];
          } else {
            handle_complete(options);
          }

          clearTimeout(timeout_handler);
        }
      };

      if (options.error) {
        timeout_handler = setTimeout(function() {
          error(xhr, 'timeout');
        }, timeout * 1000);
      }

      xhr.open(method, path, async);
      if (data instanceof Object) {
        data = JSON.stringify(data);
        xhr.setRequestHeader('Content-Type','application/json');
      }

      xhr.setRequestHeader('X-Requested-With','XMLHttpRequest');
      xhr.setRequestHeader('X-MiteApiKey',  config.api_key);
      xhr.setRequestHeader('X-MiteAccount', config.account);
      xhr.send(data);

      if (!config.async) {
        return _parseJson(xhr.responseText);
      }
    },

    // POST request
    _post = function(path, params, options) {
      var parsed_options  = _parseOptions(options);
      parsed_options.data = params;
      return _request('POST', _buildUrl(path), parsed_options);
    },

    // PUT request
    _put = function(path, params, options) {
      var parsed_options  = _parseOptions(options);
      parsed_options.data = params;
      return _request('PUT', _buildUrl(path), parsed_options);
    },

    // DELETE request
    _destroy = function(path, options) {
      return _request('DELETE', _buildUrl(path), _parseOptions(options));
    },

    _interface = function(cached_get_requests) {

      // GET request
      var _get = function(path, params, options) {
        var parsed_options,
            separator = /\?/.test(path) ? '&' : '?';

        if (typeof options == 'undefined') {
          parsed_options = _parseOptions(params);
        } else {
          parsed_options = _parseOptions(options);
          parsed_options.data = params;
        }

        path = _buildUrl(path);
        if (parsed_options.data) {
          path += separator + _buildQuery(parsed_options.data);
          delete(parsed_options.data);
        }

        // let's avoid to send the same requests twice
        if (! _loading[path]) {
          // shall we read from cache?
          if (cached_get_requests && _cache[path]) {
            if (parsed_options.success  && _cache[path].success)  parsed_options.success.apply( null, _cache[path].success );
            if (parsed_options.error    && _cache[path].error)    parsed_options.error.apply(   null, _cache[path].error );
            if (parsed_options.complete && _cache[path].complete) parsed_options.complete.apply(null, _cache[path].complete );
          } else {
            _loading[path] = [parsed_options];
            return _request('GET', path, parsed_options);
          }
        } else {
          _loading[path].push(parsed_options);
        }
      },

      Base = {
        _name             : function()                     { return this._url.replace(/s$/, '').replace(/ie$/, 'y'); },
        _wrapParams       : function(params)               { var p = {}; p[this._name()] = params; return p; },
        all               : function(params, options)      { return    _get(this._url,                              params, options); },
        find              : function(id, options)          { return    _get(this._url + '/' + id,                           options); },
        create            : function(params, options)      { return    _post(this._url,           this._wrapParams(params), options); },
        update            : function(id, params, options)  { return    _put(this._url + '/' + id, this._wrapParams(params), options); },
        destroy           : function(id, options)          { return    _destroy(this._url + '/' + id,                       options); }
      },

      ActiveArchivedBase = _extend({
        all               : undefined,
        active            : Base.all,
        archived          : function(params, options)      { return    _get(this._url + '/archived',      params, options); }
      }, Base),

      OnlyReadable = {
        create            : undefined,
        update            : undefined,
        destroy           : undefined
      };


      ////
      //  Public
      return {
        // http://mite.yo.lk/en/api/account.html
        account     : function(options)                     { return    _get('account',                            options); },
        myself      : function(options)                     { return    _get('myself',                             options); },
        // http://mite.yo.lk/en/api/time-entries.html & http://mite.yo.lk/en/api/grouped-time-entries.html
        TimeEntry   : _extend({
          _url      : 'time_entries'
        }, Base),
        // http://mite.yo.lk/en/api/tracker.html
        Tracker     : {
          find              : function(options)              { return    _get('tracker',                                options); },
          start             : function(id, options)          { return    _put('tracker/'+id,                        {}, options); },
          stop              : function(id, options)          { return    _destroy('tracker/'+id,                        options); }
        },
        // http://mite.yo.lk/en/api/bookmarks.html
        Bookmark    : _extend({
          _url              : 'time_entries/bookmarks',
          // TODO fix me (I guess it relates to the redirect)
          time_entries_for  : function(id, options)          { return    _get(this._url + '/' + id + '/follow',   options); }
        }, Base, OnlyReadable),
        // http://mite.yo.lk/en/api/customers.html
        Customer    : _extend({
          _url              : 'customers',
          projects_for      : function(ids, options)         { return    _get('projects?customer_id='+ids,              options); },
          time_entries_for  : function(ids, options)         { return    _get('time_entries?customer_id='+ids,          options); }
        }, ActiveArchivedBase),
        // http://mite.yo.lk/en/api/projects.html
        Project     : _extend({
          _url              : 'projects',
          time_entries_for  : function(ids, options)         { return    _get('time_entries?project_id='+ids,           options); }
        }, ActiveArchivedBase),
        // http://mite.yo.lk/en/api/services.html
        Service     : _extend({
          _url              : 'services',
          time_entries_for  : function(ids, options)         { return    _get('time_entries?service_id='+ids,           options); }
        }, ActiveArchivedBase),
        // http://mite.yo.lk/en/api/users.html
        User        : _extend({
          _url              : 'users',
          time_entries_for  : function(ids, options)         { return    _get('time_entries?user_id='+ids,              options); }
        }, ActiveArchivedBase, OnlyReadable),
        config      : config,
        clearCache  : function(kind) {
          if(!this._url) { return; }
          if(kind) {
            _cache[kind] = undefined;
          } else {
            _cache = {};
          }
        }
      };
    };

    return _extend(_interface(), { cache: _interface(true) } );
  };

  // resultCallback: function(projection_per_year, projection_per_last_4_weeks, projection_per_last_7_days)
  window.getFinancialMetrics = function(mite_account, mite_api_key, resultCallback) {
    var mite = new Mite({account: mite_account, api_key: mite_api_key});
    mite.TimeEntry.all({"year": 2014}, function(time_entry_wrappers) {
      var days_remaining_this_year = getDaysInCurrentYear() - getDayInCurrentYear();
      var fourWeeksAgo = new Date();
      fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      var oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      var entries = _.map(time_entry_wrappers, function(time_entry_wrapper) { return time_entry_wrapper.time_entry; });
      var entries_this_year = _.filter(entries, function(time_entry) { return time_entry.date_at.indexOf("2014") == 0; });
      var entries_last_4_weeks = _.filter(entries_this_year, function(time_entry) { 
        return new Date(time_entry.created_at) > fourWeeksAgo;
      });
      var entries_last_week = _.filter(entries_last_4_weeks, function(time_entry) { 
        return new Date(time_entry.created_at) > oneWeekAgo;
      });
      var rev_this_year = _.reduce(entries_this_year, function(memo, time_entry) {
        return memo + time_entry.hourly_rate * (time_entry.minutes / 60.0); 
      }, 0);
      var rev_last_4_weeks = _.reduce(entries_last_4_weeks, function(memo, time_entry) {
        return memo + time_entry.hourly_rate * (time_entry.minutes / 60.0); 
      }, 0);
      var rev_per_day_in_last_4_weeks = rev_last_4_weeks / 28;
      var rev_last_week = _.reduce(entries_last_week, function(memo, time_entry) {
        return memo + time_entry.hourly_rate * (time_entry.minutes / 60.0); 
      }, 0);
      var rev_per_day_in_last_week = rev_last_week / 7;

      var projection_per_year = Math.round(rev_this_year * (getDaysInCurrentYear() / getDayInCurrentYear() / 100.0));
      var projection_per_last_4_weeks = Math.round((rev_this_year + rev_per_day_in_last_4_weeks * days_remaining_this_year) / 100.0);
      var projection_per_last_7_days = Math.round((rev_this_year + rev_per_day_in_last_week * days_remaining_this_year) / 100.0);
      
      resultCallback(projection_per_year, projection_per_last_4_weeks, projection_per_last_7_days);
    });
  };
}(window));

(function($) {
  $.fn.prettynumber = function(options) {
    var opts = $.extend({}, $.fn.prettynumber.defaults, options);
    return this.each(function() {
      $this = $(this);
      var o = $.meta ? $.extend({}, opts, $this.data()) : opts;
      var str = $this.html();
      $this.html($this.html().toString().replace(new RegExp("(^\\d{"+($this.html().toString().length%3||-1)+"})(?=\\d{3})"),"$1"+o.delimiter).replace(/(\d{3})(?=\d)/g,"$1"+o.delimiter));
    });
  };
  $.fn.prettynumber.defaults = {
    delimiter       : '.' 
  };
})(jQuery);