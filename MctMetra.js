/**
 * Interface to Metra Servers
 */


// makeClass - By John Resig (MIT Licensed)
function makeClass(){
  return function(args){
    if ( this instanceof arguments.callee ) {
      if ( typeof this.init == "function" )
        this.init.apply( this, args.callee ? args : arguments );
    } else
      return new arguments.callee( arguments );
  };
}


/**
 * somethin here
 *
 * @return {[type]}
 */
var MctMetra = makeClass();
MctMetra.prototype.init = function() {
    var me = this;
    me.debug = true;
    me.refreshSecs = 30;

    me.debug && console.log('MctMetra init() done.');
    return me;
};


/**
 * Makes api call to get train data.
 * @param {object} [stationReq]
 * @param {function(object)} [cb] callback function, passed null on error, or object on success
 */
MctMetra.prototype.reqTrainData = function(stationReq, cb) {
    var me = this;
    me.reqUrl = 'http://12.205.200.243/AJAXTrainTracker.svc/GetAcquityTrainData';
    me.reqType = 'POST';
    // curl "http://12.205.200.243/AJAXTrainTracker.svc/GetAcquityTrainData" -H "Pragma: no-cache" -H "Content-Type: application/json; charset=UTF-8" -H "Accept: application/json, text/javascript, */*; q=0.01" -H "Cache-Control: no-cache" --data-binary '{"stationRequest":{"Corridor":"MD-N","Destination":"HEALY","Origin":"LAKECOOKRD","timestamp":"/Date(1405957630947-0000)/"}}' --compressed
    stationReq.timestamp = stationReq.timestamp || "/Date(" + new Date().getTime() + "-0000)/";
    try {
        me.reqJson = JSON.stringify({
            stationRequest: stationReq
        });
    } catch (e) {
        me.debug && console.log('reqTrainData() Trouble with JSON.stringify', e);
    }
    me.debug && console.log('MyCommuteTrain.reqTrainData ...');

    me.reqTrainJqxhr = $.ajax({
        url: me.reqUrl,
        type: 'POST',
        contentType: 'application/json; charset=UTF-8',
        dataType: 'json',
        data: me.reqJson,
        timeout: 1000 * (me.refreshSecs > 2 ? me.refreshSecs - 2 : 1),
        error: function(jqXHR, textStatus, errorThrown) {
            me.debug && console.log('reqTrainData() ajax error:', textStatus, jqXHR, errorThrown);
            cb(null);
        },
        success: function(data) {
            me.reqTrainJsonData = data;
            cb(data);
        }
    });
    return me;
};


/**
 * Makes api call to get train data.
 *
 * @param {object} [data]
 * @param {function(object)} [cb] callback function, passed null on error, or object on success
 * @return {object} traininfo object will have trainInfo.valid equal to true if parsed without issues
 */
MctMetra.prototype.aggregateTrainInfo = function(data, trainInfo) {
    var me = this;
    var json;
    trainInfo = trainInfo || {
        valid: true,
        parsedData: {},
        apiTrainData: []
    };
    try {
        trainInfo.apiJsonResponse = json = JSON.parse(data.d);
    } catch (e) {
        me.debug && console.log("MctMetra.aggregateTrainInfo() Trouble converting to JSON", data, e);
        trainInfo.valid = false;
        return trainInfo;
    }
    // iterate over train data from API to build parsedData
    $.each(['train1', 'train2', 'train3'], function(indx, train) {
        try {
            trainInfo.parsedData = me._aggregateTrainInfo(json[train], trainInfo.parsedData);
            me.debug && console.log("MctMetra.aggregateTrainInfo() train " + indx, train, trainInfo.parsedData);
            trainInfo.apiTrainData.push(json[train]);
        } catch(e){
            me.debug && console.log("MctMetra.aggregateTrainInfo() error" + indx, train, e);
            trainInfo.valid = false;
            return trainInfo;
        }
    });
    trainInfo.updated = me.metraDate2EpochMs(json.responseTime);
    me.debug && console.log("MctMetra.aggregateTrainInfo() done.", trainInfo);
    return trainInfo;
};

/**
 * [_aggregateTrainInfo description]
 * @param  {[type]} t          [description]
 * @param  {[type]} parsedData [description]
 * @return {[type]}            [description]
 */
MctMetra.prototype._aggregateTrainInfo = function(t, parsedData) {
    var me = this;
    var html;
    if (!t) {
        me.debug && console.log('MctMetra._aggregateTrainInfo() no train');
        return parsedData;
    }
    var station = {
        est:   me.metraDate2EpochMs(t.estimated_dpt_time),
        sched: me.metraDate2EpochMs(t.scheduled_dpt_time)
    };
    if (!(station.sched && station.est)) {
        me.debug && console.log('MctMetra._aggregateTrainInfo() skipping invalid train', t);
        return parsedData;
    }
    parsedData[t.train_num] = parsedData[t.train_num] || {};
    parsedData[t.train_num][t.dpt_station] = station;
    me.debug && console.log("MctMetra._aggregateTrainInfo() done.", parsedData, t);
    return parsedData;
};


/*
 * @param {String|Number} dateStr - date string from Metra, or if number, just return (already parsed)
 * @returns {Number|null} ms since epoch, or null if invalid date
 */
MctMetra.prototype.metraDate2EpochMs = function(dateStr) {
    var me = this;
    if ("number" === typeof dateStr) {
        return dateStr;
    }
    var d = null;
    try {
        var ms = dateStr.match(/Date\((\d+)\)/)[1];
        d = parseInt(ms, 10);
    } catch (e) {
        me.debug && console.log('metraDate2EpochMs() could not parse dateStr ' + dateStr);
    }
    return d;
};

