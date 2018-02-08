
// Wrapper for 
// new google.maps.LatLng(entry.lat, entry.long),
// return new Microsoft.Maps.Location(household.Lat, household.Long);
interface IMapLatLong
{

}

interface  IMapWrapper
 {
    mapInit();

    mapLatLong(lat: number, long: number): IMapLatLong;

    mapAddMarker(
        position: IMapLatLong,
        icon: string,
        iRows: number[], // custom data 
        onClick: (iRows: number[]) => void
    ): void;

    mapFinishAddingPins();

    mapSetMarkerIcon(iRow: number, icon: string): void;

     mapSetCurrentPos(lat: number, long: number): void;
 }


 declare var _xmap : IMapWrapper;