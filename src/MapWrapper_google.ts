// Wrappers to target maps 

/// <reference path="./MapWrapper.ts" />

declare var $: any; // jquery
declare var google: any;

var _elementId = '#map_canvas';

class GoogleMapWrapper implements IMapWrapper {
    public mapInit(): void {
        $(_elementId).gmap();
    }


    public mapLatLong(lat: number, long: number): IMapLatLong {
        var x = new google.maps.LatLng(lat, long);
        var x2 = <IMapLatLong>(<any>(x));
        return x2;
    }

    public toGoogleLatLong(x: IMapLatLong): any {
        var x2 = <any>(x)
        return x2;
    }

    public mapAddMarker(
        position: IMapLatLong,
        icon: string,
        iRows: number[], // custom data 
        onClick: (iRows: number[]) => void
    ): void {
        $(_elementId).gmap('addMarker', {
            'position': this.toGoogleLatLong(position),
            'bounds': true,
            'icon': icon,
            'iRow': iRows
        }).click(
            () => onClick(iRows));
    }

    // gmap's ('bounds' : true) parameter takes care of this, so nothing to do here. 
    public mapFinishAddingPins() { }

    // Set the marker containing the voter to grey.  
    public mapSetMarkerIcon(iRow: number, icon: string): void {
        $(_elementId).gmap('find', 'markers', {}, function (marker) {
            if ($.inArray(iRow, marker.iRow) > -1) {
                marker.setIcon(icon);
            }
        });
    }

    // Maintain a single well-known marker to show the current location. 
    public mapSetCurrentPos(lat: number, long: number): void {
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
                {
                    'position': myLatlng,
                    'bounds': false,
                    'icon': 'me.png',
                    'iRow': [-1]
                });
        }
    }
}

var _xmap: IMapWrapper = new GoogleMapWrapper();

