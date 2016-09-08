// Wrappers to target maps 

declare var $ : any; // jquery
declare var Microsoft : any; 
declare var google : any;

var _elementId = '#map_canvas';

function mapInit() : void {
    $(_elementId).gmap();
}

// Wrapper for 
// new google.maps.LatLng(entry.lat, entry.long),
// return new Microsoft.Maps.Location(household.Lat, household.Long);
interface IMapLatLong
{}

function mapLatLong(lat :number, long : number) : IMapLatLong {
    var x=  new google.maps.LatLng(lat, long);
    var x2 = <IMapLatLong>(<any>(x));
    return x2;
}

 function toGoogleLatLong(x : IMapLatLong) : any {
     var x2 = <any>(x)
     return x2;
 }  

function mapAddMarker(
    position : IMapLatLong,
    icon: string,
    iRows : number[], // custom data 
    onClick : (iRows : number[]) => void 
     ) : void 
{
    $(_elementId).gmap('addMarker', {
                'position': toGoogleLatLong(position),
                'bounds': true,
                'icon': icon,
                'iRow': iRows
            }).click(
                () => onClick(iRows));
}

// gmap's ('bounds' : true) parameter takes care of this, so nothing to do here. 
function mapFinishAddingPins() {}

// Set the marker containing the voter to grey.  
function mapSetMarkerIcon(iRow: number, icon : string): void {
    $(_elementId).gmap('find', 'markers', {}, function (marker) {
        if ($.inArray(iRow, marker.iRow) > -1) {
            marker.setIcon(icon);
        }
    });
}

// Maintain a single well-known marker to show the current location. 
function mapSetCurrentPos(lat : number, long : number) : void 
{
    var myLatlng = new google.maps.LatLng(lat, long);
    
    var position_not_found = true;
    $(_elementId).gmap('find', 'markers', {}, function (marker) {
        if (marker.iRow[0] == -1) {
            marker.setPosition(myLatlng);
            position_not_found = false;

        }
    });

    if (position_not_found) {

        $(_elementId).gmap('addMarker', 
            { 'position': myLatlng, 
            'bounds': false, 
            'icon': 'me.png', 
            'iRow': [-1] });
    }
}

 
