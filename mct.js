

//  http://tripsweb.rtachicago.com/getNextTrainBusResults.htm?serviceBoard=METRA&route=Metra%20Milwaukee%20District%20North%20Line&metraRoute=Milwaukee%20District%20North&origStop=Lake%20Cook%20Rd&destStop=Healy

var MyCommuteTrain = function () {
    if ( !(this instanceof arguments.callee) )
        return new MyCommuteTrain();
    return this.init(arguments);
};

MyCommuteTrain.prototype.init = function() {
    var me = this;
    // defaults
    me.debug = false;
    me.selectorTrain = '.traindata';
    me.selectorStatus = '.status';
    me.refreshSecs = parseInt(getParameterByName('R'),10) || 30;
    me.reqUrl = 'http://12.205.200.243/AJAXTrainTracker.svc/GetAcquityTrainData';
    me.reqType = 'POST';
    me.cookieName = 'metra';
    me.recentCount = 6;
    me.query = {
        C : getParameterByName('C'),
        O : getParameterByName('O'),
        D : getParameterByName('D')
    };

    me.initStations();
    var h = me.stationsHash;
    // stationRequest contains only valid Corridor, Origin, and Dest from query args  
    me.stationRequest = {
        Corridor    : h[me.query.C] ? me.query.C : '',
        Origin      : h[me.query.C] && h[me.query.C][me.query.O] ? me.query.O : '',
        Destination : h[me.query.C] && h[me.query.C][me.query.D] ? me.query.D : ''
    };
    me.stationNames = {
        Origin      : h[me.query.C] ? h[me.query.C][me.query.O] : '',
        Destination : h[me.query.C] ? h[me.query.C][me.query.D] : ''
    }

    $('body').on('click', '.feedback-ask', function(e){
        e.preventDefault();
        $('.feedback').slideToggle();
    });
    $('.fback').on('click', me.feedback);

    $('.refresh-freq').html('every '+ me.refreshSecs +' secs.')
    $('.status').on('click', '.enable-refresh', function(e){
        e.preventDefault();
        me.autoRefresh(true);
        me.go();
    });
    $('.status').on('click', '.disable-refresh', function(e){
        e.preventDefault();
        me.autoRefresh(false);
    });
    me.autoRefresh(true);

    // may need to use HTML5 visibility API 
    // https://greensock.com/forums/topic/9059-cross-browser-to-detect-tab-or-window-is-active-so-animations-stay-in-sync-using-html5-visibility-api/
    $(window).on('focus', function(e){
        $('.enable-refresh').click();
    })

    ga('send', 'event', 'munt', 'init');

    me.debug && console.log('MyCommuteTrain init complete.');
    return this;
};

MyCommuteTrain.prototype.go = function() {
    var me = this;
    if (me.stationRequest.Origin && me.stationRequest.Destination) {

        // find time train departs Origin
        $('.loading').hide();
        $('.status').show();
        $('.feedback-ask').show();
        $('.refresh-freq').addClass('refresh-loading');
        ga('send', 'event', 'munt', 'reqTrainData', me._stationReqStr() );

        me.reqTrainData(me.stationRequest, function(data) {
            if (me.processTrainTimes(data)) {
                ga('send', 'event', 'munt', 'respTrainDataOK', me._stationReqStr() );
            } else {
                ga('send', 'event', 'munt', 'respTrainDataBad', me._stationReqStr() );
            }
            $('.refresh-freq').removeClass('refresh-loading');
        });

        // find time train arrives (departs Destination) (less important)
        var stationReq = {
            Corridor    : me.stationRequest.Corridor,
            Origin      : me.stationRequest.Destination,
            Destination : me.finalStation(me.stationRequest)
        }
        if (stationReq.Origin == stationReq.Destination) {
            // End station - skip getting times, since api won't have answers
            return;
        }
        me.reqTrainData(stationReq, function(data2) {
            me.processTrainTimes(data2);
            me.goAgain();
        });

        // Hoping that the following would show train times in future, but looks like no
        /*
        stationReq.timestamp = "/Date(" + (new Date().getTime() + 1000*60*60) + "-0000)/";
        me.reqTrainData(stationReq, function(data3) {
            me.processTrainTimes(data3);
        });
        */ 

    } else {
        me.showCookies();
        me.updateStatus('Choose Stations');
        me.showStations(me.stationRequest.Corridor, me.stationRequest.Origin);
        //me.showStations('MD-N','HEALY');
    }
    me.debug && console.log('MyCommuteTrain go complete. window.mrt = ', me);
    return this;
};

MyCommuteTrain.prototype.goAgain = function() {
    var me = this;
    if (me.refreshTimer) return; // already got a timer 
    if (!me.refreshEnabled) return;

    me.refreshTimer = setTimeout( function(){
        me.refreshTimer = null;
        if (me.refreshEnabled) {
            me.go();
        }
    }, me.refreshSecs * 1000);
};

MyCommuteTrain.prototype.aggregateTrainInfo = function(data) {
    var me = this;
    var json;
    try {
      json = JSON.parse(data.d);
    } catch (e) {
      me.debug && console.log("Trouble converting to JSON", data, e);
    }
    me.trainInfo = me.trainInfo || {
        valid: true,
        apiJsonResponse: json, 
        parsedData: {},
        apiTrainData: []
    }
    // iterate over train data from API to build parsedData
    $.each(['train1', 'train2', 'train3'], function(indx,train) {
        var t = json[train];
        if (!me._aggregateTrainInfo(t)) {
              me.trainInfo.valid = false;
              return;
        }
        me.trainInfo.apiTrainData.push(t);
    });
    me.trainInfo.updated = me.parseMetraDate(json.responseTime, true);
};

/* 
 *  @param t
 */
MyCommuteTrain.prototype._aggregateTrainInfo = function(t) {
    var me = this;
    if (!t) {
        me.debug && console.log('_aggregateTrainInfo() no train');
        return;
    }
    var parsedData = me.trainInfo.parsedData || {};
    var sTime = me.parseMetraDate(t.scheduled_dpt_time);
    var eTime = me.parseMetraDate(t.estimated_dpt_time);
    if (!sTime) {
        me.debug && console.log('_aggregateTrainInfo() skipping invalid train',t);
        return false;
    }
    var html = eTime +' ('+ (sTime==eTime ? 'same' : sTime) +')';
    html += '<br><span data-mins="'+ me.fromNow(t.estimated_dpt_time) +'">'
        + me.fromNow(t.estimated_dpt_time, 1) +'</span>';

    parsedData[t.train_num] = parsedData[t.train_num] || {};
    parsedData[t.train_num][t.dpt_station] = html;
    me.trainInfo.parsedData = parsedData;
    return true;
};

MyCommuteTrain.prototype.highlightNextTrain = function() {
    var me = this;

    var origin = 9999;
    var dest = 9999;
    $('.origin span').each(function(){
        var cur = parseInt($(this).data('mins'),10);
        if (cur >= 0 && cur < origin) origin = cur;
    });
    $('.destination span').each(function(){
        var cur = parseInt($(this).data('mins'),10);
        if (cur >= 0 && cur < dest) dest = cur;
    });
    $('.origin span').removeClass('bluebox');
    $('.origin span[data-mins='+ origin +']').addClass('bluebox nextOTrain');

    // should we highlight origin and destination? for now, yes.
    // use case: show train arrival time once already on the train
    // however, may want to show this a different color
    if (dest < origin) {
        $('.destination span[data-mins='+ dest +']').addClass('bluebox nextDTrain');
    }
    me.debug && console.log('highlightNextTrain() done. orig, dest', origin, dest);
};

MyCommuteTrain.prototype.showTrainInfo = function() {
    var me = this;

    var s = location.search;
    var rev = '<a title="Reverse route" href="'
    + '?C='+ getParameterByName('C', s)
    + '&O=' + getParameterByName('D', s)
    + '&D=' + getParameterByName('O', s)
    + (getParameterByName('R',s) ? '&R=' + getParameterByName('R',s) : '')
    + '">Reverse</a>';

    var html = '';
    html += '<table><thead><td>'+ me.directionChicago +'<br>Train<br>'+ rev +'</td>';
    html += '<td>Origin:<br>'+ me.stationNames.Origin      +'<br>Estimated (Sched)</td>'
    html += '<td>Destination:<br>'+ me.stationNames.Destination +'<br>Estimated (Sched)</td>'
    $.each(me.trainInfo.parsedData, function(train_num, trainObj) {
        if (!trainObj[me.stationRequest.Origin]) {
          return; // skip trains that don't stop at Origin
        }
        html += '<tr>';
        html += '<td>'+ train_num +'</td>';
        html += '<td class="origin">'+ (trainObj[me.stationRequest.Origin] || '-') +'</td>';
        html += '<td class="destination">'+ (trainObj[me.stationRequest.Destination] || '-') +'</td>';
        html += '</tr>';
    });
    if (me.trainInfo.apiTrainData.length == 0) {
        html += '<tr><td colspan=3>Invalid train data from API or bad args</td></tr>';
        me.trainInfo.valid = false;
    }
    html += '</table>'
    $(me.selectorTrain).html(html);
    $('.lastUpdated').html(me.trainInfo.updated);
};

MyCommuteTrain.prototype.updateStatus = function(status, e) {
    var me = this;
    $(this.selectorStatus).show().html(status);
    me.debug && console.log(status, e);
};

// used for google analytics
MyCommuteTrain.prototype._stationReqStr = function() {
    var sr = this.stationRequest;
    return sr.Corridor +'-'+ sr.Origin +'-'+ sr.Destination;
};

MyCommuteTrain.prototype.autoRefresh = function(enableRefresh) {
    var me = this;
    var html;
    if (typeof enableRefresh === 'boolean') {
        me.refreshEnabled = enableRefresh;
        if (enableRefresh === true) {
            $('.refresh-on').show();
            $('.enable-refresh').hide();
        } else {
            $('.refresh-on').hide();
            $('.enable-refresh').show();
        }
    }
};

// returns true if processed ok, false if not
MyCommuteTrain.prototype.processTrainTimes = function(data) {
    var me = this;
    var ret = false;
    if (!data) {
        me.debug && console.log("processTrainTimes: no data");
        return false;
    }
    try {
        me.aggregateTrainInfo(data);
        me.showTrainInfo();
        me.highlightNextTrain();
        me.updateCookies();
        me.showCookies();
        ret = true;
    } catch (e) {
        me.debug && console.log("processTrainTimes: Trouble parsing response", data, e);
        ret = false;
    }
    return ret;
};

/**
 * returns minutes from now for a given date
 * 
 * @param {String|Number} dateStr - if string, assumes date string from Metra. If number, assumes epoch ms.
 * @param {Boolean} [returnStr=false] - if false, returns number. If true, returns string: "3 mins", "1 min", "< 1 min"
 * @returns {null|Number|String} mins from now, or null if invalid date
 */
MyCommuteTrain.prototype.fromNow = function(dateStr, returnStr) {
    var me = this;

    var ms = me.metraDate2EpochMs(dateStr);
    if (!ms) return null;

    var diff = ms - new Date().getTime(); // difference in ms
    diff = Math.round(diff / (60*1000)); // now diff in mins

    if (!returnStr) {
        return diff;
    }
    var ret = '';

    if (diff >= 60) {
        ret = Math.round(diff/60) + 'hr ';
        diff = diff % 60;
    }
    if (diff > 1) {
        ret += diff + ' mins';
    } else if (diff == 1) {
        ret += '1 min';
    } else if (diff < 0) {
        // return nothing for trains in past
    } else if (!ret) {
        // only return mins if ret is empty (no hours)
        ret += '< 1 min';
    }
    return ret;
};


MyCommuteTrain.prototype.parseMetraDate = function(dateStr, inclSecs) {
    var me = this;
    var ms = me.metraDate2EpochMs(dateStr);
    if (ms === null) {
        me.debug && console.log(' === parseMetraDate could not parse dateStr '+ dateStr);
        return null;
    }
    var d = new Date(ms);
    var str = d.getHours() - (d.getHours() > 12 ? 12 : 0);
    str += ':' + (d.getMinutes() < 10 ? '0':'') + d.getMinutes();
    if (inclSecs) {
        str += ':' + (d.getSeconds() < 10 ? '0':'') + d.getSeconds();
    }
    return str;
};


/*
 * @param {String|Number} dateStr - date string from Metra, or if number, just return (already parsed)
 * @returns {Number|null} ms since epoch, or null if invalid date
 */
MyCommuteTrain.prototype.metraDate2EpochMs = function(dateStr) {
    var me = this;
    if ("number" === typeof dateStr) {
        return dateStr;
    }
    var d = null;
    try {
        var ms = dateStr.match(/Date\((\d+)\)/)[1];
        d = parseInt(ms,10);
    } catch (e) {
        me.debug && console.log('metraDate2EpochMs() could not parse dateStr '+ dateStr);
    }
    return d;
};


MyCommuteTrain.prototype.feedback = function(evt) {
    $(evt.target).addClass('fback-selected');
    ga('send', 'event', 'munt', 'fback-'+$(evt.target).attr('ga'), 1);
    setTimeout(function(){
        $(evt.target).removeClass('fback-selected');
        $('.feedback').slideToggle();
    },1500)
};


MyCommuteTrain.prototype.updateCookies = function() {
    var me = this;
    if (!(me.trainInfo.valid && $.cookie)) return;
    $.cookie.json = true;
    me.cookieJson = $.cookie(me.cookieName) || {};
    var s = location.search;
    var p = '?C='+ getParameterByName('C',s)
        + '&O=' + getParameterByName('O',s)
        + '&D=' + getParameterByName('D',s)
        + (getParameterByName('R',s) ? '&R=' + getParameterByName('R',s) : '');
    me.cookieJson[p] = new Date().getTime();
    $.cookie(me.cookieName, me.cookieJson);
    //me.debug && console.log("updateCookies: ", me.cookieJson);
};
MyCommuteTrain.prototype.showCookies = function() {
    var me = this;
    var remaining = me.recentCount;
    if (!$.cookie) return;
    $.cookie.json = true;
    me.cookieJson = $.cookie(me.cookieName) || {};
    var sortable = [];
    $.each(me.cookieJson, function(str, secs){
        sortable.push([str, secs]);
    });
    if (sortable.length == 0) {
        me.debug && console.log('showCookies: No cookies found, returning');
        return;
    }
    $('.cookies').html('<p>Recent Valid Requests:</p>');
    sortable.sort(function(a, b) {return b[1] - a[1]})

    $.each(sortable, function(i, v){
        if (--remaining < 0) return;
        var t = new Date(v[1]);
        var str = getParameterByName('C',v[0]) + ' '
            + getParameterByName('O',v[0]) + ' to '
            + getParameterByName('D',v[0])
            + (getParameterByName('R',v[0]) ? ', R=' + getParameterByName('R',v[0]) : '');
        var html = '<span>';
        html += '<a title="'+ t +'" href="'+ v[0] +'">'+ str +'</a>';
        html += '</span>';
        $('.cookies').append(html);
    });
    //me.debug && console.log("showCookies: ", me.cookieJson);
};


/**
 * Makes api call to get train data.
 *
 * @param {object} [stationReq]
 * @param {function(object)} [cb] callback function, passed null on error, or object on success
 */
MyCommuteTrain.prototype.reqTrainData = function(stationReq, cb) {
    var me = this;
    // curl "http://12.205.200.243/AJAXTrainTracker.svc/GetAcquityTrainData" -H "Pragma: no-cache" -H "Content-Type: application/json; charset=UTF-8" -H "Accept: application/json, text/javascript, */*; q=0.01" -H "Cache-Control: no-cache" --data-binary '{"stationRequest":{"Corridor":"MD-N","Destination":"HEALY","Origin":"LAKECOOKRD","timestamp":"/Date(1405957630947-0000)/"}}' --compressed
    stationReq.timestamp = stationReq.timestamp || "/Date(" + new Date().getTime() + "-0000)/";
    try {
        me.reqJson = JSON.stringify({ stationRequest: stationReq });
    } catch (e) {
        me.updateStatus('Trouble with JSON.stringify', e);
    }
    me.debug && console.log('MyCommuteTrain.reqTrainData ...');

    var jqxhr = $.ajax({
        url: me.reqUrl,
        type: me.reqType,
        contentType: 'application/json; charset=UTF-8',
        dataType: 'json',
        data: me.reqJson,
        timeout: 1000 * (me.refreshSecs > 2 ? me.refreshSecs - 2 : 1),
        error: function(jqXHR, textStatus, errorThrown) {
            me.debug && console.log('reqTrainData() ajax error:', textStatus, jqXHR, errorThrown);
            cb(null);
        },
        success: cb
    });
    return me;
};

// C = Corridor
// O = Origin
// D = Destination
MyCommuteTrain.prototype.showStations = function(C,O) {
    var me = this;
    var html = '';
    me.debug && console.log('showStations('+ C +','+ O +')');
    if (!me.stationsHash[C]) {
        // choice 1: show options for Corridor
        html += '<p>Choose Valid Corridor:</p>';
    }
    $.each(me.stationsRaw, function(i,co){
        me.debug && console.log('showStations'+i+' corridor obj:', co);
        if (!me.stationsHash[C]) {
            // choice 1: show options for Corridor
            html += '<a href="?C='+ co.C +'">'+ co.name +'</a>';
            return;
        }
        // choice 2 and 3: given Corridor, show options for Stations

        if (co.C != C) return;
        html += '<p>'+ co.name +' Stations</p>';
        me.debug && console.log('showStations-2');
        if (me.stationsHash[C][O]) {
            // choice 3
            html += '<p> Origin: '+ me.stationsHash[C][O] +'<br>Choose Destination</p>';
        } else {
            // choice 2
            html += '<p>Choose Valid Origin:</p>';
        }
        // list stations in train stop order, aka stationsRaw
        $.each(co.stations, function(i,so){
            me.debug && console.log('showStations'+i+' station obj:', so);
            if (me.stationsHash[C][O]) {
                if (so.id == O) {
                    html += '<a>'+ so.name +'</a>';
                } else {
                    html += '<a href="?C='+ co.C +'&O='+O+'&D='+ so.id +'">'+ so.name +'</a>'
                }
            } else {
                html += '<a href="?C='+ co.C +'&O='+ so.id +'">'+ so.name +'</a>';
            }
        });
    });
    $('.stations').html(html);
};


MyCommuteTrain.prototype.finalStation = function(stationReq) {
    var me = this;
    var finalStationNum = -1; // -1 means not known yet
    var stations;
    $.each(me.stationsRaw, function(i,co){
        if (co.C != stationReq.Corridor) return;
        stations = co.stations;
    });
    // Note stationsRaw lists statsion in order towards downtown chicago
    $.each(stations, function(i,so){
        if ((so.id == stationReq.Origin) && (-1 == finalStationNum)) {
            me.directionChicago = "Inbound";
            finalStationNum = i;
        } else if ((so.id == stationReq.Destination) && (-1 == finalStationNum)) {
            me.directionChicago = "Outbound";  // heading away from chicago
            finalStationNum = 0;
        }
        if (finalStationNum > 0) {
          // heading towards Chicago, last number i is last stop
          finalStationNum = i;
        }
    });
    $.each(stations, function(i,so){
        if (finalStationNum == i) {
          me.finalStationId = so.id;
        }
    });
    me.debug && console.log('finalStation '+ stationReq +' heading '+ me.directionChicago +' Chicago: '+ me.finalStationId);
    return me.finalStationId;
};


MyCommuteTrain.prototype.initStations = function() {
    var me = this;
    // metrarail.com does not support CORS, so must use curl to get json data and paste here
    // curl http://metrarail.com/content/metra/en/home/jcr:content/trainTracker.get_stations_from_line.json?trackerNumber=0&trainLineId=MD-N
    me.stationsRaw = [
        { C:'UP-N', name:'Union Pacific / North Line',
          "stations":{"0":{"id":"KENOSHA","name":"Kenosha"},"1":{"id":"WINTHROP","name":"Winthrop Harbor "},"2":{"id":"ZION","name":"Zion "},"3":{"id":"WAUKEGAN","name":"Waukegan"},"4":{"id":"NCHICAGO","name":"North Chicago"},"5":{"id":"GRTLAKES","name":"Great Lakes"},"6":{"id":"LAKEBLUFF","name":"Lake Bluff "},"7":{"id":"LKFOREST","name":"Lake Forest"},"8":{"id":"FTSHERIDAN","name":"Fort Sheridan"},"9":{"id":"HIGHWOOD","name":"Highwood"},"10":{"id":"HIGHLANDPK","name":"Highland Park "},"11":{"id":"RAVINIA","name":"Ravinia"},"12":{"id":"RAVINIAPK","name":"Ravinia Park"},"13":{"id":"BRAESIDE","name":"Braeside"},"14":{"id":"GLENCOE","name":"Glencoe"},"15":{"id":"HUBARDWOOD","name":"Hubbard Woods"},"16":{"id":"WINNETKA","name":"Winnetka"},"17":{"id":"INDIANHILL","name":"Indian Hill "},"18":{"id":"KENILWORTH","name":"Kenilworth"},"19":{"id":"WILMETTE","name":"Wilmette"},"20":{"id":"CENTRALST","name":"Evanston Central Street"},"21":{"id":"EVANSTON","name":"Evanston Davis Street "},"22":{"id":"MAINST","name":"Evanston Main Street"},"23":{"id":"ROGERPK","name":"Rogers Park"},"24":{"id":"RAVENSWOOD","name":"Ravenswood"},"25":{"id":"CLYBOURN","name":"Clybourn"},"26":{"id":"OTC","name":"Ogilvie Transportation Center"}}
        },
        { C:'MD-N', name:'Milwaukee District / North Line',
          "stations":{"0":{"id":"FOXLAKE","name":"Fox Lake"},"1":{"id":"INGLESIDE","name":"Ingleside"},"2":{"id":"LONGLAKE","name":"Long Lake"},"3":{"id":"ROUNDLAKE","name":"Round Lake"},"4":{"id":"GRAYSLAKE","name":"Grayslake"},"5":{"id":"PRAIRIEXNG","name":"Prairie Crossing/Libertyville"},"6":{"id":"LIBERTYVIL","name":"Libertyville"},"7":{"id":"LAKEFRST","name":"Lake Forest"},"8":{"id":"DEERFIELD","name":"Deerfield"},"9":{"id":"LAKECOOKRD","name":"Lake Cook Road"},"10":{"id":"NBROOK","name":"Northbrook"},"11":{"id":"NGLENVIEW","name":"Glen of North Glenview"},"12":{"id":"GLENVIEW","name":"Glenview"},"13":{"id":"GOLF","name":"Golf"},"14":{"id":"MORTONGRV","name":"Morton Grove"},"15":{"id":"EDGEBROOK","name":"Edgebrook"},"16":{"id":"FORESTGLEN","name":"Forest Glen"},"17":{"id":"MAYFAIR","name":"Mayfair"},"18":{"id":"GRAYLAND","name":"Grayland"},"19":{"id":"HEALY","name":"Healy"},"20":{"id":"WESTERNAVE","name":"Western Avenue"},"21":{"id":"CUS","name":"Union Station"}}
        },
        { C:'NCS', name:'North Central Service',
        "stations":{"0":{"id":"ANTIOCH","name":"Antioch"},"1":{"id":"LAKEVILLA","name":"Lake Villa "},"2":{"id":"ROUNDLKBCH","name":"Round Lake Beach"},"3":{"id":"GRAYSLK-WASH","name":"Washington St. / Grayslake"},"4":{"id":"PRAIRCROSS","name":"Prairie Crossing / Libertyville"},"5":{"id":"MUNDELEIN","name":"Mundelein"},"6":{"id":"VERNON","name":"Vernon Hills "},"7":{"id":"PRAIRIEVW","name":"Prairie View"},"8":{"id":"BUFFGROVE","name":"Buffalo Grove"},"9":{"id":"WHEELING","name":"Wheeling"},"10":{"id":"PROSPECTHG","name":"Prospect Heights"},"11":{"id":"OHARE","name":"O'Hare Transfer"},"12":{"id":"ROSEMONT","name":"Rosemont"},"13":{"id":"SCHILLERPK","name":"Schiller Park"},"14":{"id":"FRANKLINPK","name":"Belmont Ave / Franklin Park"},"15":{"id":"RIVERGROVE","name":"River Grove"},"16":{"id":"WESTERNAVE","name":"Western Avenue"},"17":{"id":"CUS","name":"Union Station"}}
        },
        { C:'UP-NW', name:'Union Pacific / Northwest Line',
          "stations":{"0":{"id":"HARVARD","name":"Harvard "},"1":{"id":"MCHENRY","name":"McHenry "},"2":{"id":"WOODSTOCK","name":"Woodstock "},"3":{"id":"CRYSTAL","name":"Crystal Lake"},"4":{"id":"PINGREE","name":"Pingree Road"},"5":{"id":"CARY","name":"Cary "},"6":{"id":"FOXRG","name":"Fox River Grove "},"7":{"id":"BARRINGTON","name":"Barrington"},"8":{"id":"PALATINE","name":"Palatine"},"9":{"id":"ARLINGTNPK","name":"Arlington Park (Race Track)"},"10":{"id":"ARLINGTNHT","name":"Arlington Heights"},"11":{"id":"MTPROSPECT","name":"Mount Prospect"},"12":{"id":"CUMBERLAND","name":"Cumberland "},"13":{"id":"DESPLAINES","name":"Des Plaines"},"14":{"id":"DEEROAD","name":"Dee Road"},"15":{"id":"PARKRIDGE","name":"Park Ridge"},"16":{"id":"EDISONPK","name":"Edison Park"},"17":{"id":"NORWOODP","name":"Norwood Park"},"18":{"id":"GLADSTONEP","name":"Gladstone Park"},"19":{"id":"JEFFERSONP","name":"Jefferson Park"},"20":{"id":"IRVINGPK","name":"Irving Park"},"21":{"id":"CLYBOURN","name":"Clybourn"},"22":{"id":"OTC","name":"Ogilvie Transportation Center"}}
        },
        { C:'MD-W', name:'Milwaukee District / West Line',
        "stations":{"0":{"id":"BIGTIMBER","name":"Big Timber Road"},"1":{"id":"ELGIN","name":"Elgin"},"2":{"id":"NATIONALS","name":"National Street"},"3":{"id":"BARTLETT","name":"Bartlett"},"4":{"id":"HANOVERP","name":"Hanover Park "},"5":{"id":"SCHAUM","name":"Schaumburg"},"6":{"id":"ROSELLE","name":"Roselle"},"7":{"id":"MEDINAH","name":"Medinah "},"8":{"id":"ITASCA","name":"Itasca"},"9":{"id":"WOODDALE","name":"Wood Dale "},"10":{"id":"BENSENVIL","name":"Bensenville"},"11":{"id":"MANNHEIM","name":"Mannheim"},"12":{"id":"FRANKLIN","name":"Franklin Park"},"13":{"id":"RIVERGROVE","name":"River Grove"},"14":{"id":"ELMWOODPK","name":"Elmwood Park"},"15":{"id":"MONTCLARE","name":"Mont Clare"},"16":{"id":"MARS","name":"Mars "},"17":{"id":"GALEWOOD","name":"Galewood "},"18":{"id":"HANSONPK","name":"Hanson Park"},"19":{"id":"GRAND-CIC","name":"Grand / Cicero"},"20":{"id":"WESTERNAVE","name":"Western Avenue"},"21":{"id":"CUS","name":"Union Station"}}
        },
        { C:'UP-W', name:'Union Pacific / West Line',
        "stations":{"0":{"id":"ELBURN","name":"Elburn"},"1":{"id":"LAFOX","name":"La Fox"},"2":{"id":"GENEVA","name":"Geneva"},"3":{"id":"WCHICAGO","name":"West Chicago"},"4":{"id":"WINFIELD","name":"Winfield"},"5":{"id":"WHEATON","name":"Wheaton"},"6":{"id":"COLLEGEAVE","name":"College Avenue"},"7":{"id":"GLENELLYN","name":"Glen Ellyn"},"8":{"id":"LOMBARD","name":"Lombard"},"9":{"id":"VILLAPARK","name":"Villa Park"},"10":{"id":"ELMHURST","name":"Elmhurst"},"11":{"id":"BERKELEY","name":"Berkeley "},"12":{"id":"BELLWOOD","name":"Bellwood "},"13":{"id":"MELROSEPK","name":"Melrose Park"},"14":{"id":"MAYWOOD","name":"Maywood"},"15":{"id":"RIVRFOREST","name":"River Forest"},"16":{"id":"OAKPARK","name":"Oak Park "},"17":{"id":"KEDZIE","name":"Kedzie "},"18":{"id":"OTC","name":"Ogilvie Transportation Center"}}
        },
        { C:'BNSF', name:'BNSF Railway',
          "stations":{"0":{"id":"AURORA","name":"Aurora"},"1":{"id":"ROUTE59","name":"Route 59"},"2":{"id":"NAPERVILLE","name":"Naperville"},"3":{"id":"LISLE","name":"Lisle "},"4":{"id":"BELMONT","name":"Belmont"},"5":{"id":"MAINST-DG","name":"Downers Grove Main Street"},"6":{"id":"FAIRVIEWDG","name":"Fairview Avenue"},"7":{"id":"WESTMONT","name":"Westmont"},"8":{"id":"CLARNDNHIL","name":"Clarendon Hills"},"9":{"id":"WHINSDALE","name":"West Hinsdale "},"10":{"id":"HINSDALE","name":"Hinsdale"},"11":{"id":"HIGHLANDS","name":"Highlands "},"12":{"id":"WESTSPRING","name":"Western Springs"},"13":{"id":"STONEAVE","name":"LaGrange Stone Avenue"},"14":{"id":"LAGRANGE","name":"LaGrange Road"},"15":{"id":"CONGRESSPK","name":"Congress Park "},"16":{"id":"BROOKFIELD","name":"Brookfield"},"17":{"id":"HOLLYWOOD","name":"Hollywood"},"18":{"id":"RIVERSIDE","name":"Riverside"},"19":{"id":"HARLEM","name":"Harlem Ave."},"20":{"id":"BERWYN","name":"Berwyn "},"21":{"id":"LAVERGNE","name":"LaVergne"},"22":{"id":"CICERO","name":"Cicero"},"23":{"id":"BNWESTERN","name":"Western Avenue"},"24":{"id":"HALSTED","name":"Halsted "},"25":{"id":"CUS","name":"Union Station"}}
        },
        { C:'HC', name:'Heritage Corridor',
        "stations":{"0":{"id":"JOLIET","name":"Joliet"},"1":{"id":"LOCKPORT","name":"Lockport"},"2":{"id":"LEMONT","name":"Lemont"},"3":{"id":"WILLOWSPRN","name":"Willow Springs"},"4":{"id":"SUMMIT","name":"Summit"},"5":{"id":"CUS","name":"Union Station"}}
        },
        { C:'SWS', name:'SouthWest Service',
        "stations":{"0":{"id":"MANHATTAN","name":"Manhattan "},"1":{"id":"LARAWAY","name":"New Lenox Laraway Road"},"2":{"id":"179TH-SWS","name":"Orland Park 179th Street"},"3":{"id":"153RD-SWS","name":"Orland Park 153rd Street"},"4":{"id":"143RD-SWS","name":"Orland Park 143rd Street"},"5":{"id":"PALOSPARK","name":"Palos Park "},"6":{"id":"PALOSHTS","name":"Palos Heights"},"7":{"id":"WORTH","name":"Worth"},"8":{"id":"CHICRIDGE","name":"Chicago Ridge"},"9":{"id":"OAKLAWN","name":"Oak Lawn"},"10":{"id":"ASHBURN","name":"Ashburn "},"11":{"id":"WRIGHTWOOD","name":"Wrightwood "},"12":{"id":"CUS","name":"Union Station"}}
        },
        { C:'RI', name:'Rock Island District',
        "stations":{"0":{"id":"JOLIET","name":"Joliet"},"1":{"id":"NEWLENOX","name":"New Lenox "},"2":{"id":"MOKENA","name":"Mokena"},"3":{"id":"HICKORYCRK","name":"Hickory Creek"},"4":{"id":"TINLEY80TH","name":"Tinley Park - 80th Ave."},"5":{"id":"TINLEYPARK","name":"Tinley Park"},"6":{"id":"OAKFOREST","name":"Oak Forest"},"7":{"id":"MIDLOTHIAN","name":"Midlothian "},"8":{"id":"ROBBINS","name":"Robbins"},"9":{"id":"VERMONT","name":"Blue Island - Vermont St."},"10":{"id":"PRAIRIEST","name":"Prairie St."},"11":{"id":"123RD-BEV","name":"123rd St."},"12":{"id":"119TH-BEV","name":"119th Street"},"13":{"id":"115TH-BEV","name":"Morgan Park - 115th Street"},"14":{"id":"111TH-BEV","name":"Morgan Park - 111th Street"},"15":{"id":"107TH-BEV","name":"Beverly Hills - 107th Street"},"16":{"id":"103RD-BEV","name":"Beverly Hills - 103rd Street"},"17":{"id":"99TH-BEV","name":"Beverly Hills - 99th Street"},"18":{"id":"95TH-BEV","name":"Beverly Hills - 95th Street"},"19":{"id":"91ST-BEV","name":"Beverly Hills - 91st Street "},"20":{"id":"BRAINERD","name":"Brainerd "},"21":{"id":"WASHHGTS","name":"103rd St., Washington Hts "},"22":{"id":"LONGWOOD","name":"95th St. - Longwood"},"23":{"id":"GRESHAM","name":"Gresham "},"24":{"id":"35TH","name":"35th Street / 'Lou' Jones / Bronzeville"},"25":{"id":"LSS","name":"LaSalle Street Station"}}
        },
        { C:'ME', name:'Metra Electric District',
        "stations":{"0":{"id":"BLUEISLAND","name":"Blue Island"},"1":{"id":"BURROAK","name":"Burr Oak"},"2":{"id":"ASHLAND","name":"Ashland"},"3":{"id":"RACINE","name":"Racine"},"4":{"id":"WPULLMAN","name":"West Pullman "},"5":{"id":"STEWARTRID","name":"Stewart Ridge "},"6":{"id":"STATEST","name":"State Street"},"7":{"id":"93RD-SC","name":" 93rd St. (South Chicago)"},"8":{"id":"87TH-SC","name":"87th St. (South Chicago)"},"9":{"id":"83RD-SC","name":"83rd St. (South Chicago)"},"10":{"id":"79TH-SC","name":"79th Street (Cheltenham)"},"11":{"id":"WINDSORPK","name":"Windsor Park "},"12":{"id":"SOUTHSHORE","name":"South Shore"},"13":{"id":"BRYNMAWR","name":"Bryn Mawr "},"14":{"id":"STONYISLND","name":"Stony Island "},"15":{"id":"UNIVERSITY","name":"University Park"},"16":{"id":"RICHTON","name":"Richton Park "},"17":{"id":"MATTESON","name":"Matteson"},"18":{"id":"211TH-UP","name":"211th Street (Lincoln Highway)"},"19":{"id":"OLYMPIA","name":"Olympia Fields"},"20":{"id":"FLOSSMOOR","name":"Flossmoor"},"21":{"id":"HOMEWOOD","name":"Homewood"},"22":{"id":"CALUMET","name":"Calumet"},"23":{"id":"HAZELCREST","name":"Hazel Crest"},"24":{"id":"HARVEY","name":"Harvey"},"25":{"id":"147TH-UP","name":"147th Street (Sibley Boulevard)"},"26":{"id":"IVANHOE","name":"Ivanhoe "},"27":{"id":"RIVERDALE","name":"Riverdale"},"28":{"id":"KENSINGTN","name":"Kensington / 115th Street"},"29":{"id":"111TH-UP","name":"111th Street (Pullman)"},"30":{"id":"107TH-UP","name":"107th Street"},"31":{"id":"103RD-UP","name":"103rd Street (Rosemoor)"},"32":{"id":"95TH-UP","name":"95th St., Chicago State Univ."},"33":{"id":"91ST-UP","name":"91st Street (Chesterfield)"},"34":{"id":"87TH-UP","name":"87th Street (Woodruff)"},"35":{"id":"83RD-UP","name":"83rd Street (Avalon Park)"},"36":{"id":"79TH-UP","name":"79th St., Chatham"},"37":{"id":"75TH-UP","name":"75th Street (Grand Crossing)"},"38":{"id":"63RD-UP","name":"63rd Street"},"39":{"id":"59TH-UP","name":"59th St., Univ. of Chicago"},"40":{"id":"55-56-57TH","name":"55th - 56th - 57th Street"},"41":{"id":"51ST-53RD","name":"51st / 53rd Street (Hyde Park)"},"42":{"id":"47TH-UP","name":"47th Street (Kenwood)  "},"43":{"id":"27TH-UP","name":"27th Street"},"44":{"id":"MCCORMICK","name":"McCormick Place"},"45":{"id":"18TH-UP","name":"18th Street"},"46":{"id":"MUSEUM","name":"Museum Campus / 11th Street"},"47":{"id":"VANBUREN","name":"Van Buren Street"},"48":{"id":"RANDOLPH","name":"Millennium Station"}}
        }
    ];
    me.stationsHash = {}
    $.each(me.stationsRaw, function(i,so){
        me.stationsHash[so.C] = {};
        $.each(so.stations, function(n,s){
            me.stationsHash[so.C][s.id] = s.name;
        });
    });
};


function getParameterByName(name, str) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        str = str || location.search,
        results = regex.exec(str);
    return results == null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
};
