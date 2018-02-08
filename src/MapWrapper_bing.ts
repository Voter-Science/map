declare var $: any; // jquery
declare var Microsoft: any;

/// <reference path="./MapWrapper.ts" />

var _elementId = 'map_canvas';

class BingMapWrapper implements IMapWrapper {
    private _map: any = null;

    private _mapImageRoot: string = "https://trcanvasdata.blob.core.windows.net/publicimages/";


    public mapInit(): void {
        this._map = new Microsoft.Maps.Map(document.getElementById(_elementId), {
            credentials: "AkpKDWAFzo7Pep8YulOZ01GzBWcwKeAvORutiARpFvP5OUKL0aVSQ7qM3LY7xaes"            
        });
    }


    public mapLatLong(lat: number, long: number): IMapLatLong {
        var x = new Microsoft.Maps.Location(lat, long);
        var x2 = <IMapLatLong>(<any>(x));
        return x2;
    }


    private _mapx: { [iRow: number]: any; } = {}; // iRow --> Marker
    private _map_pin_locs: any[] = [];

    public mapAddMarker(
        position: IMapLatLong,
        icon: string,
        iRows: number[], // custom data 
        onClick: (iRows: number[]) => void
    ): void {
        // $$$ bounds 
        var pushpinOptions = {
            icon: this._mapImageRoot + icon
        };

        this._map_pin_locs.push(position);
        var pushpin = new Microsoft.Maps.Pushpin(position, pushpinOptions);

        for (var i = 0; i < iRows.length; i++) {
            var iRow = iRows[i];
            this._mapx[iRow] = pushpin;
        }

        var pushpinClick = Microsoft.Maps.Events.addHandler(pushpin, 'click', function (e) {
            onClick(iRows);
        });

        this._map.entities.push(pushpin);
    }

    // finished calls to mapAddMarker. Time to set view.  
    public mapFinishAddingPins() {
        this._map.setView({ bounds: Microsoft.Maps.LocationRect.fromLocations(this._map_pin_locs) });
    }

    // Set the marker containing the voter to grey.  
    public mapSetMarkerIcon(iRow: number, icon: string): void {
        var pushpin = this._mapx[iRow];
        pushpin.setOptions({ icon: this._mapImageRoot + icon });
    }

    private _map_current_loc: any = null;

    // Maintain a single well-known marker to show the current location. 
    public mapSetCurrentPos(lat: number, long: number): void {
        var loc = new Microsoft.Maps.Location(lat, long);
        if (this._map_current_loc != null) {
            this._map_current_loc.setLocation(loc);
        } else {
            var pushpinOptions = {
                icon: this._mapImageRoot + 'me.png'
            };
            this._map_current_loc = new Microsoft.Maps.Pushpin(loc, pushpinOptions);
            this._map.entities.push(this._map_current_loc);
        }
    }
}

var _xmap: IMapWrapper = new BingMapWrapper();
