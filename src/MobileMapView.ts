// TypeScript
// JScript functions for BasicList.Html.
// This calls TRC APIs and binds to specific HTML elements from the page.
/// <reference path="./trc.ts" />
/// <reference path="localStore.ts" />
/// <reference path="MapWrapper.ts" />

declare var moment: any;


var _sheetCache: SheetCache;
var noshowColumns = ["Lat", "Long", "RecId", "City", "Zip", "PrecinctName"];
var fixLabelsColumns = { FirstName: "First Name", LastName: "Last Name", ResultOfContact: "Result Of Contact", Birthday: "Age" };
var watchId;
var timer_started = false;
////take this out in production
$('#one').css('display', 'none');

// Which pins to use
// Lazy init based on schema
var _colorFactor: IHouseholdColorFactory = null;

var fixValuesColumns = {
    Birthday:
    function (val) {

        var d = new Date(Date.parse(val));
        return _calculateAge(d);
    }
};

// Startup function called by the plugin
function PluginMain(sheet) {
    // clear previous results

    $("#cache").hide();

    $('#one').css('display', 'block');
    $.mobile.loading('show', {
        text: 'Populating map',
        textVisible: true,
        theme: 'e',
        html: ""
    });

    trcGetSheetInfo(sheet, function (info) {
        find_altered_columns(info);
        if (info.CountRecords > 1000) {
            alert("Sheet has too many voters. Select a precinct or use geofencing to break into a smaller region. ");
        }

        trcGetSheetContents(sheet, function (data) {
            _xmap.mapInit();

            $(window).bind('beforeunload', function () {
                var count = _sheetCache.getTotalNotYetUploaded();
                if (count > 0) {
                    return "You have " + count + " local changes. If you exit now, please return to this map page when your device is back online to upload them.";
                } else {
                    return "Are you sure you want to exit the map page?";
                }
            });

            _sheetCache = new SheetCache(sheet, data);
            mapSheet(info, data);
        });
    });
}

// List of columns that if set, mean the door is already visited 
// (so  the  pin should display as hollow.) 
var _alteredNames: string[] = [];

function find_altered_columns(info: ISheetInfoResult): void {
    for (var i = 0; i < info.Columns.length; i++) {
        var q = info.Columns[i];
        if (!q.IsReadOnly) {
            var qn = q.Name.toLowerCase();
            // Ignore editable columns that we provided.
            if ((qn != "party") &&
                (qn != "cellphone") &&
                (qn != "comments") &&  // don't clear this when we reset
                (qn != "email") && 
                (qn != "xcolor")) {
                _alteredNames.push(q.Name);
            }
        }
    }
}



// Is this household "targeted"
function is_targeted(data: ISheetContents, iRow: number): boolean {
    var targets = data["XTargetPri"]; // could be missing
    if (!targets) { return true; } // If no targeted column present, then assume all voters are targetted
    var value = targets[iRow];
    return value == "1";
}

function should_visit(data: ISheetContents, iRow: number): boolean {
    return is_targeted(data, iRow) && !is_altered(data, iRow);
}

// $$$ NationBuilder questions are of the form 'Q12' where 12 is the question id. 
// True if the row has been altered (visited)
function is_altered(data: ISheetContents, iRow: number): boolean {
    // Switch to using a "Last modified" time stamp
    // Not all sheets will have a ResultOfContact column.
    for (var i = 0; i < _alteredNames.length; i++) {
        var columnName = _alteredNames[i];
        var values = data[columnName];

        if (values != undefined) {
            var altered: boolean = !(!values[iRow]);
            if (altered) {
                return true;
            }
        }
    }

    return false;
}

// Called when setting a house-hold wide option, set on all people in the household. 
function save_entry2(
    prefix: string,
    iRow: number,
    columnName: string,
    newValue: string): void {
    _sheetCache.updateValueByIndex(iRow, columnName, newValue);
    set_marker_grey(iRow);
}

// called on the single-person page, pull answer from question. 
function save_entry(
    prefix: string,
    iRow: number,
    data: ISheetContents,
    info: ISheetInfoResult): void {
    var change_was_made = false;
    for (var i = 0; i < info.Columns.length; i++) {
        if (!info.Columns[i].IsReadOnly) {
            var columnName = info.Columns[i].Name;
            if ($.inArray(columnName, noshowColumns) == -1) {
                var _newvalue = $("#" + prefix + columnName).val();
                if (columnName == 'Party') {

                    _newvalue = $("#details_Party :radio:checked").data('selected_value');

                } else if (columnName == 'Supporter') {

                    _newvalue = $("#details_Supporter :radio:checked").data('selected_value');
                } else if (columnName == 'ResultOfContact') {
                    _newvalue = $("#details_ResultOfContact").val();
                }

                if (_newvalue != undefined) {
                    var oldValue = data[columnName][iRow];
                    if (oldValue != _newvalue) {
                        change_was_made = true;
                    }
                    // updates data[], even if we're offline.
                    _sheetCache.updateValueByIndex(iRow, columnName, _newvalue);
                }
            }
        }
    }

    if (change_was_made) {
        set_marker_grey(iRow);
    }
    back_to_list();
}

function parse2(x: string): number {
    if (x == "") {
        return 0;
    }
    return parseFloat(x);
}

interface IHousehold {
    lat: number;
    long: number;
    address: string;
    irows: number[]; // indices into sheet that are at this address
    altered: boolean;
    partyX: IHouseholdColor;
}

// Correspond to images in the folder. 
class MarkerColors {
    public static Grey: string = 'marker_grey.png'; // Hollow 
    public static Unknown: string = "marker_Unknown.png"; // dark purple 

    public static Blue: string = "marker_Blue.png";
    public static Red: string = "marker_Red.png";
    public static Purple: string = "marker_Purple.png";
    public static Orange: string = "marker_Orange.png";
    public static Green: string = "marker_Green.png";
    public static Yellow: string = "marker_Yellow.png";
};


interface IHouseholdColor {
    // Rule for Merge colors together.
    merge(other: IHouseholdColor): IHouseholdColor;
    getImage(): string;
}

// Get a color from the raw sheet. 
interface IHouseholdColorFactory {
    getColor(data: ISheetContents, iRow: number): IHouseholdColor;
}

// Worker_Type__c
function getColor(data: ISheetContents, iRow: number): IHouseholdColor {
    if (_colorFactor == null) {
        if (data["XColor"] != undefined) {
            _colorFactor = new XColorFactory();
        } else if (data["Worker_Type__c"] != undefined) {
            _colorFactor = new GeneralColorFactory();
        } else {
            _colorFactor = new PartyHouseholdColorFactory();
        }
    }
    return _colorFactor.getColor(data, iRow);
}

// Color scheme for standard party 

// Represent combined party code at a household
enum HouseholdPartyCode {
    Unknown,
    AllGop,
    AllDem,
    Mixed
}

class PartyColor implements IHouseholdColor {
    private _party: HouseholdPartyCode;
    public constructor(party: HouseholdPartyCode) {
        this._party = party;
    }
    public merge(other: IHouseholdColor): IHouseholdColor {
        var a = this;
        var ax = a._party;
        var b = other;
        var bx = (<any>other)._party;

        if (ax == HouseholdPartyCode.Unknown) {
            return b;
        }
        if (bx == HouseholdPartyCode.Unknown) {
            return a;
        }
        if (ax == HouseholdPartyCode.Mixed) {
            return a;
        }
        if (bx == HouseholdPartyCode.Mixed) {
            return b;
        }

        if (ax == bx) { // same. Both R or both D.
            return a;
        }
        return new PartyColor(HouseholdPartyCode.Mixed);
    }

    public getImage(): string {
        if (this._party == HouseholdPartyCode.AllDem) {
            return MarkerColors.Blue;
        }
        if (this._party == HouseholdPartyCode.AllGop) {
            return MarkerColors.Red;
        }
        if (this._party == HouseholdPartyCode.Mixed) {
            return MarkerColors.Purple;
        }
        if (this._party == HouseholdPartyCode.Unknown) {
            return MarkerColors.Unknown;
        }
    }
}

class PartyHouseholdColorFactory implements IHouseholdColorFactory {
    public getColor(data: ISheetContents, iRow: number): IHouseholdColor {
        var party = data["Party"][iRow];
        if (party == '1' || party == '2') {
            return new PartyColor(HouseholdPartyCode.AllGop);
        }
        if (party == '4' || party == '5') {
            return new PartyColor(HouseholdPartyCode.AllDem);
        }
        return new PartyColor(HouseholdPartyCode.Unknown);
    }
}

// generic color scheme

class GeneralColor implements IHouseholdColor {
    private _marker: string;

    public constructor(marker: string) {
        this._marker = marker;
    }
    public merge(other: IHouseholdColor): IHouseholdColor {
        var a = this;
        var b: GeneralColor = <GeneralColor>(<any>other);
        if (a._marker != b._marker) {
            return new GeneralColor(MarkerColors.Unknown);
        }
        return a;
    }
    public getImage(): string {
        return this._marker;
    }
}

class XColorFactory  implements IHouseholdColorFactory {
    private static _map : any = {
        'r' : MarkerColors.Red,
        'g' : MarkerColors.Green,
        'b' : MarkerColors.Blue,
        'p' : MarkerColors.Purple,
        'o' : MarkerColors.Orange,
        'y' : MarkerColors.Yellow
    };
    getColor(data: ISheetContents, iRow: number): IHouseholdColor {
        var worker = data["XColor"][iRow];
        if (!!worker)
        {
            var x = worker.toLowerCase();
            var color = XColorFactory._map[x];
            if (color) {
                return new GeneralColor(color);
            }
        }

        return new GeneralColor(MarkerColors.Unknown);
    }
}

class GeneralColorFactory implements IHouseholdColorFactory {
    public getColor(data: ISheetContents, iRow: number): IHouseholdColor {
        /*
           Healthcare: SEIU: Purple
           Childcare: SEIU: Yellow
           Childcare: AFSCME: Green
           Teachers: OEA: Orange
        */

        var worker = data["Worker_Type__c"][iRow];
        if (!!worker) {
            var x = worker.toLowerCase();
            if (x.startsWith("childcare")) {  // Childcare - Exempt, Childcare - Licensed
                return new GeneralColor(MarkerColors.Green);
            } else if (x == "healthcare") {
                return new GeneralColor(MarkerColors.Purple);
            } else if (x == "teacher") {
                return new GeneralColor(MarkerColors.Orange);
            } else if (x == "state worker") {
                return new GeneralColor(MarkerColors.Blue);
            } else if (x == "language access provider") {
                return new GeneralColor(MarkerColors.Yellow);
            }
        }

        return new GeneralColor(MarkerColors.Unknown);

    }
}

function mapSheet(info: ISheetInfoResult, data: ISheetContents) {


    populate_info_screen(info);

    populate_local_storage_screen("");


    var numRows = info.CountRecords;

    {

        for (var i = 0; i < info.Columns.length; i++) {
            var columnInfo = info.Columns[i];
            if (columnInfo.Name == "Party") {
                // Touchup party possible values if missing. 
                if (columnInfo.PossibleValues == null) {
                    columnInfo.PossibleValues = ['0', '1', '2', '3', '4', '5'];
                }
            } else if (columnInfo.Name == "Supporter") {
            }
            else if (columnInfo.PossibleValues != null) {
                // Any multiple-choice question is optional.                 
                columnInfo.PossibleValues.unshift("");
            }
        }
    }
    var houseHolds: IHousehold[] = [];

    for (var iRow = 0; iRow < numRows; iRow++) {
        var party = data["Party"][iRow];

        var itm: IHousehold = {
            lat: parse2(data["Lat"][iRow]),
            long: parse2(data["Long"][iRow]),
            address: data["Address"][iRow],
            irows: [iRow],
            partyX: getColor(data, iRow),
            altered: false // is_altered(data, iRow) // 

        };
        var allready_in_idx = -1;
        var i = 0;

        // TODO - N^2 search, replace with hash
        houseHolds.forEach(function (entry) {
            if (entry.lat == itm.lat && entry.long == itm.long) {
                allready_in_idx = i;
                var existing = houseHolds[allready_in_idx];                
                if (itm.altered) {
                    existing.partyX = existing.partyX.merge(itm.partyX);
                }
                return;
            }
            i++;
        });

        if (allready_in_idx >= 0) {
            houseHolds[allready_in_idx].irows.push(iRow);
        } else {
            houseHolds.push(itm);
        }
    }
    calculateIsAltered(houseHolds, data);

    $("#set_in_search").html('');
    var nextId = 1;

    houseHolds.forEach(function (entry) {
        var x2: any = entry; // TODO ?x2
        var last_address = data["Address"][x2];
        entry.irows.forEach(function (entry) {
            var content = '';
            if (last_address != data["Address"][entry]) {
                last_address = data["Address"][entry];
                content += ' <li data-role="list-divider">Address: ' + last_address + '</li>';
            }
            var d = new Date(Date.parse(data["Birthday"][entry]));

            content += '<li id="' + entry + '"><a href="#">' + data["FirstName"][entry] + " " + data["LastName"][entry] + ', ' + _calculateAge(d) + data["Gender"][entry] + '</a></li>';

            $("#set_in_search").append(content);
            nextId++;
        });


    });
    $('#set_in_search').listview();
    $('#set_in_search').listview('refresh');


    $('#set_in_search').delegate('li', 'click', function () {


        if ($(this).prop('id') != 'NaN') {
            var id = $(this).prop('id');

            $("#the_search_list").hide();
            $("#the_details_search").show();
            $("#the_details_form_search").html("");



            $.each(info.Columns, function (key, ivalue) {
                $("#the_details_form_search").append(create_field("searchdetails_", ivalue.Name, ivalue.DisplayName, data[ivalue.Name][id], ivalue.IsReadOnly, ivalue.Type, ivalue.PossibleValues));
                initialize_field("searchdetails_", ivalue.Name, ivalue.Type, ivalue.PossibleValues);

            });
        }

    });

    houseHolds.forEach(function (entry : IHousehold) {

        if (entry.lat != 0 && entry.long != 0) {

            var loc = _xmap.mapLatLong(entry.lat, entry.long);
            _xmap.mapAddMarker(
                loc,
                (entry.altered ? MarkerColors.Grey : entry.partyX.getImage()),
                entry.irows, // custom data to pass to click func

                function (iRows: number[]) {
                    var nextId = 1;
                    $.mobile.loading('show');
                    $.mobile.navigate("#p");
                    $("#set").html('');

                    var thisHousehold = entry;
                    var x2: any = entry; // TODO ?x2
                    var last_address = data["Address"][x2];
                    iRows.forEach(function (entry: number) {
                        var content = '';
                        if (last_address != data["Address"][entry]) {
                            last_address = data["Address"][entry];
                            content += ' <li data-role="list-divider">Address: ' + last_address + '</li>';
                        }

                        var d = new Date(Date.parse(data["Birthday"][entry]));
                        content += '<li id="' + entry + '"><a href="#">' + data["FirstName"][entry] + " " + data["LastName"][entry] + ', ' + _calculateAge(d) + data["Gender"][entry] + '' +
                            '<img src="' + (!should_visit(data, entry) ? MarkerColors.Grey : getImgParty(data, entry)) + '"></a>' +
                            '</li>';


                        $("#set").append(content);
                        nextId++;
                    });


                    $('#household_fields').html('');

                    // Display househould wide quick shortcuts. 
                    $.each(info.Columns, function (key, ivalue) {
                        if (ivalue.Name == "ResultOfContact") {
                            var columnName = ivalue.Name;
                            var html = create_field("household_", columnName, ivalue.DisplayName, "", ivalue.IsReadOnly, ivalue.Type, ivalue.PossibleValues);

                            var route = $('<a>', {
                                text : "(Route to here)",
                                target : "_blank",
                                href: "https://maps.apple.com?daddr="+ entry.lat +"," + entry.long
                            });

                            $('#household_fields').append("<div><b>Household wide option:</b></div>").append(route).append(html);
                            var htmlId = "#household_" + columnName;
                            $(htmlId).change(function () {
                                var newValue = this.value;

                                // When changing household, apply choice to all voters, and then directly return to map 
                                for (var i in thisHousehold.irows) {
                                    var rowIdx = thisHousehold.irows[i];
                                    //alert('value is changed2:' + newValue  +'for row ' + rowIdx);
                                    save_entry2("details_", rowIdx, columnName, newValue);
                                }

                                $.mobile.back(); // Back to map page. 
                            })
                            initialize_field("household_", ivalue.Name, ivalue.Type, ivalue.PossibleValues);

                        }
                    });

                    $('#set').listview();
                    if (nextId < 10) {

                        $("#set").prev("form.ui-filterable").hide();

                    } else {

                        $("#set").prev("form.ui-filterable").show();

                    }
                    $('#set').listview('refresh');
                    $('#set').delegate('li', 'click',
                        function () {
                            if ($(this).prop('id') != 'NaN') {
                                ///var id=$(this).attr('id');
                                var id = $(this).prop('id');
                                $("#the_list").hide();
                                $("#the_details").show();

                                $("#the_details_form").html("");
                                $("#details_save_button").unbind();
                                $('#details_save_button').addClass('ui-disabled');

                                $("#details_save_button").click(function () {

                                    var iRow = parseInt(id);
                                    save_entry("details_", iRow, data, info);
                                });

                                $.each(info.Columns, function (key, ivalue) {
                                    $("#the_details_form").append(create_field("details_", ivalue.Name, ivalue.DisplayName, data[ivalue.Name][id], ivalue.IsReadOnly, ivalue.Type, ivalue.PossibleValues));
                                    initialize_field("details_", ivalue.Name, ivalue.Type, ivalue.PossibleValues);

                                });
                            }

                        });
                    back_to_list();
                    $("input[data-type='search']").val('').keyup();


                    $.mobile.loading('hide');


                }); // end on-click


        }
    });
    _xmap.mapFinishAddingPins();

    $.mobile.loading('hide');
    initGeolocation();
}

function calculateIsAltered(houseHolds: IHousehold[], data : ISheetContents) 
{
    for(var i in houseHolds)
    {
        var h = houseHolds[i];
                
        h.altered = true; // means we skip househould.

        // Look at each voter in this household 
        // If we've visited any voters in this household, then don't visit it again.
        // there must be at least one target in the household to visit it. 
        for(var j in h.irows) {
            var iRow = h.irows[j]; 

            var visted = is_altered(data, iRow);
            if (visted) { 
                // If we've already visited this household, then don't visit it again
                h.altered = true;
                break; 
            }
            var shouldVisit = should_visit(data, iRow);
            if (shouldVisit) {
                h.altered = false;
            }
        }
    }
}

function back_to_list() {
    $("#the_details").hide();
    $("#the_list").show();
}

function back_to_search_list() {
    $("#the_details_search").hide();
    $("#the_search_list").show();
}


function multiple_choise_widget(name, label, value, PossibleValues) {

    var ret = '<div class="field-contain">';

    ret += '      <label for="' + name + '">' + label + ':</label>';
    ret += '<select name="' + name + '" id="' + name + '" data-iconpos="left">';

    $.each(PossibleValues, function (key, ivalue) {
        ret += '  <option value="' + ivalue + '" ' + (ivalue == value ? 'selected="selected"' : '') + '>' + ivalue + ' </option>';

    });

    ret += '</select> </div>';
    return ret;
}

function multiple_choise_widget_horizontal(
    name: string,
    label: string,
    value: string, // current value 
    PossibleValues: string[],
    images // map of values --> Image name 
) {

    var ret = '<fieldset id="' + name + '" data-role="controlgroup" data-type="horizontal" >';

    ret += '        <legend>' + label + ':</legend>'

    $.each(PossibleValues, function (key, ivalue) {

        var imgHtml = "";
        var img = images[ivalue];
        if (img != undefined) {
            imgHtml = "<img src='" + img + "'/>";
        }

        ret += ' <input type="radio" ' +
            'data-selected_value="' + ivalue + '"' +
            'name="' + name + '-choice" id="' + name + key + '" ' + (ivalue == value ? 'value="on" checked="checked"' : '') + '>';
        ret += ' <label for="' + name + key + '">' + ivalue + imgHtml + '</label>';

    });

    ret += ' </fieldset>';

    return ret;
}


function initialize_field(prefix, name, type, PossibleValues) {
    if (name == 'Lat' || name == 'Long') {

    } else if (name == 'Party' || name == 'Supporter') {

        $("#" + prefix + name).controlgroup();
        $("#" + prefix + name).change(function () {

            $('#details_save_button').removeClass('ui-disabled');
        })

    } else if (type == 'Text') {
        // Changed is not fired until after the control loses focus.
        if (PossibleValues == null) {
            $("#" + prefix + name).textinput();
            $("#" + prefix + name).change(function () {
                $('#details_save_button').removeClass('ui-disabled');
            })
        } else {

            $("#" + prefix + name).selectmenu();
            $("#" + prefix + name).change(function () {

                $('#details_save_button').removeClass('ui-disabled');
            })
        }
    } else if (type == 'MultipleChoice') {
        $("#" + prefix + name).change(function () {
            $('#details_save_button').removeClass('ui-disabled');
        })
    }
}

// Logos for standard party Id. 
var _imgPartyMap =
    {
        '0': "PartyLabel-0.png",
        '1': "GopLogo.png",
        '2': "GopLogoSoft.png",
        '3': "PartyLabel-3.png",
        '4': "DemLogoSoft.png",
        '5': "DemLogo.png"
    };

function getImgParty(data: any, rowIndex: number) {
    var partyId = data["Party"][rowIndex];
    var num = parseInt(partyId);
    if (isNaN(num)) {
        num = 0;
    }
    return _imgPartyMap[num];
}


// Returns the HTML to create the field
function create_field(
    prefix: string,
    name: string,
    label: string,
    value: any,
    readonly: boolean,
    type,
    PossibleValues: string[]): string {

    if (fixValuesColumns[label] != null) {
        value = fixValuesColumns[label](value);
    }

    if (fixLabelsColumns[label] != null) {
        label = fixLabelsColumns[label];
    }

    if ($.inArray(name, noshowColumns) > -1) {
        var _return = '';
    }
    else if (name == 'Party' || name == 'Supporter') {
        var _return = multiple_choise_widget_horizontal(prefix + name, label, value, PossibleValues, _imgPartyMap);
    } else if (type == 'Text') {
        if (PossibleValues == null) {
            if (readonly) {
                var _return = ' <div data-role="fieldcontain">' + label + ': <strong>' + value + '    </strong></div>';


            } else {

                var _return = ' <div data-role="fieldcontain">    <label for="' + prefix + name + '">' + label + ': </label><input id="' + prefix + name + '" ' + (readonly ? 'readonly ' : '') + ' type="text" value="' + value + '"></div>';

            }

        } else {
            var _return = multiple_choise_widget(prefix + name, label, value, PossibleValues);
        }
    } else if (type == "Boolean") {

        var _return = multiple_choise_widget(prefix + name, label, value, PossibleValues);
    } else if (type == "MultipleChoice") {

        var _return = multiple_choise_widget(prefix + name, label, value, PossibleValues);
    }
    return _return;
}

function refresh_populate_local_storage_screen() {
    _sheetCache.flush((success) => {
        var msg = success ? "Successfully connected to server." : "Can't connect to server. Are you online?";
        populate_local_storage_screen(msg);
    });
}

function populate_local_storage_screen(msg: string): void {
    var x = _sheetCache.getTotalNotYetUploaded();
    var y = _sheetCache.getTotalUploaded();

    // var label = x + " results not yet uploaded. (" + y + " results uploaded)";
    $("#local_storage_sheet_form").html('');
    $("#local_storage_sheet_form").append(
        create_field("local_", "LocalChanges", "Number of changes not yet uploaded:", x, true, "Text", null));

    $("#local_storage_sheet_form").append(
        create_field("local_", "SavedChanges", "Number of changes uploaded:", y, true, "Text", null));

    $("#local_storage_sheet_form").append(
        create_field("local_", "LastStatus", "Last upload attempt:", msg, true, "Text", null));

}
function populate_info_screen(info) {

    $("#sheet_info_form").html('');
    $("#sheet_info_form").append(create_field("info_", "CountRecords", "Records Count", info.CountRecords, true, "Text", null));
    initialize_field("info_", "CountRecords", "Text", null);

    $("#sheet_info_form").append(create_field("info_", "Name", "Name", info.Name, true, "Text", null));
    initialize_field("info_", "Name", "Text", null);

    $("#sheet_info_form").append(create_field("info_", "ParentName", "Parent Name", info.ParentName, true, "Text", null));
    initialize_field("info_", "ParentName", "Text", null);
    var m = moment(info.LastModified);

    $("#sheet_info_form").append(create_field("info_", "LastModified", "Last Modfied", m.format('LLL'), true, "Text", null));
    initialize_field("info_", "LastModified", "Text", null);

}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function (txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); });
}
function _calculateAge(birthday) { // birthday is a date
    var ageDifMs = Date.now() - birthday.getTime();
    var ageDate = new Date(ageDifMs); // miliseconds from epoch
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}



// Geolocation functions 
$('#flip-location').click(function () {
    var curVal = $("#flip-location").val();
    if (curVal == "on") {
        initGeolocation();

    } else {
    }
});

function disableGeolocation() {
    if (navigator && navigator.geolocation) {
        if (watchId != null) {
            navigator.geolocation.clearWatch(watchId);

        }
    }
}

function initGeolocation() {
    if (navigator && navigator.geolocation) {
        watchId = navigator.geolocation.watchPosition(successCallback,
            errorCallback,
            { enableHighAccuracy: true, timeout: 60000, maximumAge: 60000 });

    } else {
        console.log('Geolocation is not supported');
    }
}

function errorCallback() { }

function successCallback(position) {
    _xmap.mapSetCurrentPos(position.coords.latitude, position.coords.longitude);
}

function set_marker_grey(iRow: number): void {
    _xmap.mapSetMarkerIcon(iRow, MarkerColors.Grey);
}
