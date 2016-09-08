declare var $: any; // jquery
declare var Microsoft: any;

var _elementId = 'map_canvas';

var _map: any = null;

var _mapImageRoot : string = "https://trcanvasdata.blob.core.windows.net/publicimages/";

function mapInit(): void {
    _map = new Microsoft.Maps.Map(document.getElementById(_elementId), {
        credentials: ""
    });
}

// Wrapper for 
// new google.maps.LatLng(entry.lat, entry.long),
// return new Microsoft.Maps.Location(household.Lat, household.Long);
interface IMapLatLong
{ }

function mapLatLong(lat: number, long: number): IMapLatLong {
    var x = new Microsoft.Maps.Location(lat, long);
    var x2 = <IMapLatLong>(<any>(x));
    return x2;
}

var _mapx: { [iRow: number]: any; } = {}; // iRow --> Marker
var _map_pin_locs: any[] = [];

function mapAddMarker(
    position: IMapLatLong,
    icon: string,
    iRows: number[], // custom data 
    onClick: (iRows: number[]) => void
): void {
    // $$$ bounds 
    var pushpinOptions = {
        icon: _mapImageRoot + icon
    };

    _map_pin_locs.push(position);
    var pushpin = new Microsoft.Maps.Pushpin(position, pushpinOptions);

    for (var i = 0; i < iRows.length; i++) {
        var iRow = iRows[i];
        _mapx[iRow] = pushpin;
    }

    var pushpinClick = Microsoft.Maps.Events.addHandler(pushpin, 'click', function (e) {
        onClick(iRows);
    });

    _map.entities.push(pushpin);
}

// finished calls to mapAddMarker. Time to set view.  
function mapFinishAddingPins() {
    _map.setView({ bounds: Microsoft.Maps.LocationRect.fromLocations(_map_pin_locs) });
}

// Set the marker containing the voter to grey.  
function mapSetMarkerIcon(iRow: number, icon: string): void {
    var pushpin = _mapx[iRow];
    pushpin.setOptions({ icon: _mapImageRoot + icon });
}

var _map_current_loc : any = null; 

// Maintain a single well-known marker to show the current location. 
function mapSetCurrentPos(lat: number, long: number): void {
    var loc = new Microsoft.Maps.Location(lat, long);
    if (_map_current_loc != null)
    {
        _map_current_loc.setLocation(loc);
    } else {
        var pushpinOptions =  {
            icon : _mapImageRoot + 'me.png'
        };
        _map_current_loc = new Microsoft.Maps.Pushpin(loc, pushpinOptions); 
        _map.entities.push(_map_current_loc);
    }    
}


