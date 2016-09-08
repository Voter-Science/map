// Wrappers to target maps 
var _elementId = '#map_canvas';
function mapInit() {
    $(_elementId).gmap();
    /*
        var map = new Microsoft.Maps.Map(document.getElementById(elementId), {
            credentials: "$$$"
            });
    */
}
function mapLatLong(lat, long) {
    var x = new google.maps.LatLng(lat, long);
    var x2 = (x);
    return x2;
}
function toGoogleLatLong(x) {
    var x2 = (x);
    return x2;
}
function mapAddMarker(position, icon, iRows, // custom data 
    onClick) {
    $(_elementId).gmap('addMarker', {
        'position': toGoogleLatLong(position),
        'bounds': true,
        'icon': icon,
        'iRow': iRows
    }).click(function () { return onClick(iRows); });
}
// gmap's ('bounds' : true) parameter takes care of this, so nothing to do here. 
function mapFinishAddingPins() { }
// Set the marker containing the voter to grey.  
function mapSetMarkerIcon(iRow, icon) {
    $(_elementId).gmap('find', 'markers', {}, function (marker) {
        if ($.inArray(iRow, marker.iRow) > -1) {
            marker.setIcon(icon);
        }
    });
}
// Maintain a single well-known marker to show the current location. 
function mapSetCurrentPos(lat, long) {
    var myLatlng = new google.maps.LatLng(lat, long);
    var position_not_found = true;
    $(_elementId).gmap('find', 'markers', {}, function (marker) {
        if (marker.iRow[0] == -1) {
            marker.setPosition(myLatlng);
            position_not_found = false;
        }
    });
    if (position_not_found) {
        $(_elementId).gmap('addMarker', { 'position': myLatlng,
            'bounds': false,
            'icon': 'me.png',
            'iRow': [-1] });
    }
}
