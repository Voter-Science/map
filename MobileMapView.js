// TypeScript
// JScript functions for BasicList.Html.
// This calls TRC APIs and binds to specific HTML elements from the page.
/// <reference path="..\..\trc.ts" />
// Global reference to the current sheet;
var _sheet,_saved_data,_saved_info;
var noshowColumns = ["Lat","Long", "RecId", "City","Zip","PrecinctName"];
var fixLabelsColumns = {FirstName:"First Name",LastName:"Last Name",ResultOfContact:"Result Of Contact",Birthday:"Age" };
var timer_started=false;

var fixValuesColumns = {Birthday:
function(val){

    var d=new Date(Date.parse(val));
    return _calculateAge(d);
}
};

// Startup function called by the plugin
function PluginMain(sheet) {
    // clear previous results

    console.log(sheet);

    $('#map_canvas').gmap();
    _sheet = sheet; // Save for when we do Post
    trcGetSheetInfo(sheet, function (info) {
        trcGetSheetContents(sheet, function (data) {
            mapSheet(info, data);
        });
    });
}

// Use localStorage.setObj(key, value) to save an array or object and localStorage.getObj(key) to retrieve it. The same methods work with the sessionStorage object.

Storage.prototype.setObj = function(key, obj) {
    return this.setItem(key, JSON.stringify(obj))
}
Storage.prototype.getObj = function(key) {
    if (this.getItem(key)!=null){
    return JSON.parse(this.getItem(key));
}else{
    return null;

}
}
////////

function try_to_save(){

    for (var i = 0; i < info.Columns.length; i++) {
        if (!info.Columns.IsReadOnly){
            if ($.inArray(name, noshowColumns)>-1) {
                data[info.Columns[i].Name][iRow] = $("#" + prefix + info.Columns[i].Name).val();
                _saved_data[info.Columns[i].Name][iRow] = data[info.Columns[i].Name][iRow];

                trcPostSheetUpdateCell(_sheet, recId, columnName, newValue, function () {
                    setColorClass(element, 'OkUpload');
                });

            }
        }
    }




}
function save_entry(prefix,iRow,data,info){

console.log("prefix"+prefix);
    console.log("iRow"+iRow);

    for (var i = 0; i < info.Columns.length; i++) {
            if (!info.Columns[i].IsReadOnly){
                if ($.inArray(info.Columns[i].Name, noshowColumns)==-1) {
                   var _newvalue=$("#" + prefix + info.Columns[i].Name).val();
if (info.Columns[i].Name=='Party'){

    _newvalue=$("#details_Party :radio:checked").data('selected_value');

}else if(info.Columns[i].Name=='Supporter'){

    _newvalue=$("#details_Supporter :radio:checked").data('selected_value');
}else if(info.Columns[i].Name=='ResultOfContact'
){
    _newvalue=$("#details_ResultOfContact").val();
}



                    if (_newvalue!= undefined){


                   if(  data[info.Columns[i].Name][iRow]!=_newvalue){



                    console.log(info.Columns[i].Name);
                    console.log(iRow);
                    console.log("NEW:"+_newvalue);
                       console.log("OLD:"+data[info.Columns[i].Name][iRow]);

                    data[info.Columns[i].Name][iRow] = _newvalue;
                    _saved_data[info.Columns[i].Name][iRow] = data[info.Columns[i].Name][iRow];

                       localStorage.setItem("_save:"+info.Columns[i].Name+":"+data["RecId"][iRow],_newvalue);

                   }
                    }


                }
                }
            }


    _saved_data["EDITED"][iRow]=true;






    $('#map_canvas').gmap('find', 'markers', { }, function(marker) {




       if($.inArray(parseInt(iRow), marker.iRow)>-1  ){
           marker.setIcon('marker_grey.png');

        }
    });



    save(_saved_data,info);

    back_to_list();
}

function create_timer(){
    timer_started=true;

    setInterval(
        function(){

   save_to_trc();

        },
        10000  /* 10000 ms = 10 sec */
    );
}

function save_to_trc(){
    console.log("trying to save these guys:");
    var local_storage_to_be_deleted=[];

    for (var i = 0; i <localStorage.length ; i++) {
        console.log(localStorage.key(i));
        if (localStorage.key(i).startsWith("_save"))
        {
            var key=localStorage.key(i);
            var column=key.split(":")[1];
            var row=key.split(":")[2];
            var newValue=localStorage[key];
            console.log( "row" +row +"for column"+column +" has value " + newValue);
            local_storage_to_be_deleted.push(key);


            trcPostSheetUpdateCell(_sheet, row, column, newValue, function () {

            });
        }
        //

    }
    for (var i = 0; i <local_storage_to_be_deleted.length ; i++) {
        var key=local_storage_to_be_deleted[i];
        localStorage.removeItem(key);
    }
}


function save(ldata,linfo){

    localStorage.setObj("data",ldata);
    localStorage.setObj("info",linfo);


    save_to_trc();
  //  if (!timer_started){
  //      create_timer();
  //  }

}
function clear(){

    console.log(ldata);

    localStorage.setObj("data",null);
    localStorage.setObj("info",null);
}
function load(data,info) {
    _saved_data=localStorage.getObj("data");
    _saved_info=localStorage.getObj("info");

    if (_saved_info==null){

        _saved_info = $.extend(true, [],info);


    }

    if (_saved_data==null){

        _saved_data = $.extend(true, [],data);


    }
    if (_saved_data.length==0){

        _saved_data = $.extend(true, [],data);


    }


if(_saved_info.LastModified==info.LastModified && _saved_info.Name==info.Name ){

    _saved_data = $.extend(true, [],data);

    _saved_info = $.extend(true, [],info);


}

if (_saved_data["EDITED"]==null){
        _saved_data["EDITED"]=[];


    }




return data;
}
function mapSheet(info, data) {
    data=load(data,info);

   populate_info_screen(info);



    var numRows = info.CountRecords;

    {
        var t = $('<thead>').append($('<tr>'));
        for (var i = 0; i < info.Columns.length; i++) {
            var columnInfo = info.Columns[i];
            var displayName = columnInfo.DisplayName;
            var tCell1 = $('<td>').text(displayName);
            t = t.append(tCell1);
        }

    }
var houseHolds=[];

    for (var iRow = 0; iRow < numRows; iRow++) {
        var itm={lat:data["Lat"][iRow],long:data["Long"][iRow],address:data["Address"][iRow],irows:[iRow],altered:false};
var allready_in_idx=-1;
        var i=0;
        houseHolds.forEach(function(entry) {
            if (entry.lat == itm.lat && entry.long == itm.long) {
                allready_in_idx = i;
                return;
            }
            i++;
        });

            if (allready_in_idx>=0){
                houseHolds[allready_in_idx].irows.push(iRow);
            }else{
                houseHolds.push(itm);
            }

    }
    $("#set_in_search").html('');
    var nextId = 1;

    houseHolds.forEach(function(entry) {




        var last_address=data["Address"][entry];
        entry.irows.forEach(function(entry) {
            var content='';
            if (last_address!=data["Address"][entry]){
                last_address=data["Address"][entry];
                content +=' <li data-role="list-divider">Address: '+last_address+'</li>';
            }
            var d=new Date(Date.parse(data["Birthday"][entry]));



            content +='<li id="'+entry+'"><a href="#">'+data["FirstName"][entry]+" "+data["LastName"][entry]+', '+_calculateAge(d)+data["Gender"][entry]+ '</a></li>';




            $("#set_in_search").append(content);
            nextId++;
        });


    });
    $('#set_in_search').listview();
    $('#set_in_search').listview('refresh');


    $('#set_in_search').delegate('li', 'click', function(){


        if ($(this).attr('id')!='NaN'){
            var id=$(this).attr('id');

            $("#the_search_list").hide();
            $("#the_details_search").show();
            $("#the_details_form_search").html("");



            $.each( info.Columns, function( key, ivalue ) {
                $("#the_details_form_search").append(create_field("searchdetails_",ivalue.Name,ivalue.DisplayName,data[ivalue.Name][id],ivalue.IsReadOnly,ivalue.Type,ivalue.PossibleValues));
                initialize_field("searchdetails_",ivalue.Name,ivalue.Type,ivalue.PossibleValues);

            });









        }

    });

    houseHolds.forEach(function(entry) {


        $('#map_canvas').gmap('addMarker', {
            'position': new google.maps.LatLng(entry.lat,entry.long),
            'bounds': true,
            'iRow':entry.irows
        }).click(function() {
            var nextId = 1;
            $.mobile.loading( 'show');
            $.mobile.navigate( "#p" );
            $("#set").html('');



var last_address=data["Address"][entry];
            this.iRow.forEach(function(entry) {
  var content='';
                if (last_address!=data["Address"][entry]){
                    last_address=data["Address"][entry];
                    content +=' <li data-role="list-divider">Address: '+last_address+'</li>';
                }
                var d=new Date(Date.parse(data["Birthday"][entry]));



                content +='<li id="'+entry+'"><a href="#">'+data["FirstName"][entry]+" "+data["LastName"][entry]+', '+_calculateAge(d)+data["Gender"][entry]+ '</a></li>';




                $("#set").append(content);
                nextId++;
            });


            $('#set').listview();
            if (nextId<10){

                $("#set").prev("form.ui-filterable").hide();

            }else{

                $("#set").prev("form.ui-filterable").show();

            }
            $('#set').listview('refresh');
            $('#set').delegate('li', 'click',
                function(){





                    if ($(this).attr('id')!='NaN'){
                        var id=$(this).attr('id');

                        $("#the_list").hide();
                        $("#the_details").show();
                        $("#the_details_form").html("");
                        $("#details_save_button").unbind();
                        $("#details_save_button").click(function(){
console.log("ID before save"+id);
                            save_entry("details_",id,data,info);
                        });



                        $.each( info.Columns, function( key, ivalue ) {
                            $("#the_details_form").append(create_field("details_",ivalue.Name,ivalue.DisplayName,data[ivalue.Name][id],ivalue.IsReadOnly,ivalue.Type,ivalue.PossibleValues));
                            initialize_field("details_",ivalue.Name,ivalue.Type,ivalue.PossibleValues);

                        });









                    }

                });
            back_to_list();
            $("input[data-type='search']").val('').keyup();


            $.mobile.loading( 'hide');


        });


    });

    for (var iRow = 0; iRow < numRows; iRow++) {
        var recId = data["RecId"][iRow];









    }

    $.mobile.loading( 'hide');
}

function back_to_list(){
    $("#the_details").hide();
    $("#the_list").show();


}
function back_to_search_list(){
    $("#the_details_search").hide();
    $("#the_search_list").show();


}


function multiple_choise_widget(name,label,value,PossibleValues){

    var ret='<div class="field-contain">';

    ret+='      <label for="'+name+'">'+label+':</label>';
    ret+='<select name="'+name+'" id="'+name+'" data-iconpos="left">';

    $.each( PossibleValues, function( key, ivalue ) {
        ret+='  <option value="'+ivalue+'" '+(ivalue==value?'selected="selected"':'')+'>'+ivalue+' </option>';

        });

    ret+='</select> </div>';






return ret;

}
function multiple_choise_widget_horizontal(name,label,value,PossibleValues){

    var ret='<fieldset id="'+name+'" data-role="controlgroup" data-type="horizontal" >';

    ret+='        <legend>'+label+':</legend>'

    $.each( PossibleValues, function( key, ivalue ) {


        ret+=' <input type="radio" ' +
            'data-selected_value="'+ivalue+'"' +
            'name="'+name+'-choice" id="'+name+key+'" '+(ivalue==value?'value="on" checked="checked"':'')+'>';
        ret+=' <label for="'+name+key+'">'+ivalue+'</label>';

    });

    ret+=' </fieldset>';

    return ret;
}


function initialize_field(prefix,name,type,PossibleValues){
    if (name== 'Lat' || name=='Long'){

    }else if( name=='Party' || name=='Supporter' ) {

        $("#"+prefix+name).controlgroup();


    }else if (type=='Text') {
        if(PossibleValues==null) {
            $("#"+prefix+name).textinput();

        }else{

            $("#"+prefix+name).selectmenu();
        }

    }








}
function create_field(prefix,name,label,value,readonly,type,PossibleValues){

    if(fixValuesColumns[label]!=null){
        value=fixValuesColumns[label](value);
    }

    if(fixLabelsColumns[label]!=null){
        label=fixLabelsColumns[label];
    }




    if ($.inArray(name, noshowColumns)>-1){
        var _return='';
    }else if( name=='Party' || name=='Supporter' ){
        var _return = multiple_choise_widget_horizontal(prefix+name,label,value,PossibleValues);
    }else if (type=='Text'){
        if(PossibleValues==null){
if(readonly){
    var _return =' <div data-role="fieldcontain">'+label+': <strong>'+value+'    </strong></div>';


}else{

    var _return =' <div data-role="fieldcontain">    <label for="'+prefix+name+'">'+label+': </label><input id="'+prefix+name+'" '+(readonly ?'readonly ':'')+' type="text" value="'+value+'"></div>';

}

        }else{
            var _return = multiple_choise_widget(prefix+name,label,value,PossibleValues);
        }
    } else if(type=="Boolean"){

        var _return = multiple_choise_widget(prefix+name,label,value,PossibleValues);
    }else if (type=="MultipleChoice"){

        var _return =  multiple_choise_widget(prefix+name,label,value,PossibleValues);
    }
return _return;
}
function populate_info_screen(info){

    $("#sheet_info_form").html('');
    $("#sheet_info_form").append(create_field("info_","CountRecords","Records Count",info.CountRecords,true,"Text",null));
    initialize_field("info_","CountRecords","Text",null);

    $("#sheet_info_form").append(create_field("info_","Name","Name",info.Name,true,"Text",null));
    initialize_field("info_","Name","Text",null);

    $("#sheet_info_form").append(create_field("info_","ParentName","Parent Name",info.ParentName,true,"Text",null));
    initialize_field("info_","ParentName","Text",null);

    $("#sheet_info_form").append(create_field("info_","LastModified","Last Modfied",info.LastModified,true,"Text",null));
    initialize_field("info_","LastModified","Text",null);

}

function toTitleCase(str)
{
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}
function _calculateAge(birthday) { // birthday is a date
    var ageDifMs = Date.now() - birthday.getTime();
    var ageDate = new Date(ageDifMs); // miliseconds from epoch
    return Math.abs(ageDate.getUTCFullYear() - 1970);
}