
/**
 * Interface to Metra Servers
 *
 * @returns javascript object of the app 
 */
var MctMetra = function () {
    if ( !(this instanceof arguments.callee) )
        return new MctMetra();
    return this.init(arguments);
};

MctMetra.prototype.init = function() {
    var me = this;
    me.reqUrl = 'http://12.205.200.243/AJAXTrainTracker.svc/GetAcquityTrainData';
    me.reqType = 'POST';
    me.refreshSecs = 30;

    return me;
};


/**
 * Makes api call to get train data.
 *
 * @param {object} [stationReq]
 * @param {function(object)} [cb] callback function, passed null on error, or object on success
 */
MctMetra.prototype.reqTrainData = function(stationReq, cb) {
    var me = this;
    // curl "http://12.205.200.243/AJAXTrainTracker.svc/GetAcquityTrainData" -H "Pragma: no-cache" -H "Content-Type: application/json; charset=UTF-8" -H "Accept: application/json, text/javascript, */*; q=0.01" -H "Cache-Control: no-cache" --data-binary '{"stationRequest":{"Corridor":"MD-N","Destination":"HEALY","Origin":"LAKECOOKRD","timestamp":"/Date(1405957630947-0000)/"}}' --compressed
    stationReq.timestamp = stationReq.timestamp || "/Date(" + new Date().getTime() + "-0000)/";
    try {
        me.reqJson = JSON.stringify({ stationRequest: stationReq });
    } catch (e) {
        me.debug && console.log('reqTrainData() Trouble with JSON.stringify', e);
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
