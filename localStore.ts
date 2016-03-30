// TypeScript

/// <reference path="typings\trc\trc.ts" />

// Describe information in a LocalStorage key
interface IKeyValue
{
    key : string; // remember for removing later
    recId : string; 
    columnName : string;
    newValue : string;
} 


// Provides a caching wrapper over an ISheetContents.
// Exposes get/set calls which will push updates to the server, but also maintain a cachin in LocalStore 
class SheetCache {
    private _sheetRef: ISheetReference;
    private _data: ISheetContents;
    private _counter: number; // Outstanding local changes
    private _timerStarted: boolean; // true if the background flusher is started
    private _modified: boolean[]; // track which row indices are modified since last load.

    // For diagnostics, track successful upload count
    private _totalUploaded: number; 

    public constructor(
        sheetRef: ISheetReference,
        data: ISheetContents) {
        this._sheetRef = sheetRef;
        this._data = data;
        this._counter = 0;
        this._modified = new Array(data["RecId"].length);
        this._totalUploaded = 0;

        // Initial from previous offline 
        for (var i = 0; i < localStorage.length; i++) {
            var x = SheetCache.fromLocalStorageKey(i);
            if (x != null) {
                this._counter++;
            }
        }
    }

    public getTotalUploaded(): number {
        return this._totalUploaded;
    }

    public getTotalNotYetUploaded(): number {
        return this._counter;
    }

    public hasUnsavedChanges(): boolean {
        return this._counter > 0;
    }

    // Local keys have format:
    // {prefix}:{version}:{recId}:{columnName} = {newValue}
    private static toKey(recId : string, columnName: string)  :string {
      var key = "_xsave:1:" + recId + ":" + columnName;
      return key;
    }

    // inverse of toKey()
    // null if no match 
    private static fromLocalStorageKey(i : number) : IKeyValue {
        if (!SheetCache.startsWith(localStorage.key(i), "_xsave:1")) {
            return null;
        }

        var key = localStorage.key(i);
        var parts = key.split(':'); // _prefix:ver:recId:columnName                

        var x : IKeyValue = {        
            key : key,
            recId : parts[2],
            columnName : parts[3],
            newValue : localStorage[key]
            };
        return x;
    }

    // Either post to server, or save to local storage
    private save(
        recId: string,
        columnName: string,
        newValue: string) {

        // Save to LocalStorage. When successfully uploaded to server, remove. 
        var key = SheetCache.toKey(recId, columnName);

        // If already exists, don't bump up count. 
        // Overwrite the value so we only send up the latest result. 
        if (localStorage.getItem(key) == null) {
            this._counter++; 
        }
        localStorage.setItem(key, newValue);

        // Timer will flush to the server.
        this.create_timer();               

        this.save_to_trc(); // Optimistically try to save ahead of the background flusher
        /*
        trcPostSheetUpdateCell(this._sheetRef, recId, columnName, newValue,() => {
            localStorage.removeItem(key);
            this._counter--;
        });*/
    }

    // Helper. 
    private static startsWith(x : string, searchString : string) : boolean {
        return x.indexOf(searchString, 0) === 0;
    }


    private getRecIdByIndex(iRow: number): string {
        return this._data["RecId"][iRow];
    }

    public isModifiedByIndex(iRow: number): boolean {
        return this._modified[iRow];
    } 

    // TODO - add a callback so we know when it's successfully on the server. 
    public updateValueByIndex(iRow: number, columnName: string, newValue: string): void {
        var oldVal = this.getValueByIndex(iRow, columnName);
        if (oldVal != newValue) {
            this._modified[iRow] = true;
            var recId = this.getRecIdByIndex(iRow);
            this._data[columnName][iRow] = newValue; // update local cache
            this.save(recId, columnName, newValue); // push to server
        }
    }

    // Get the value of the data from the row index
    public getValueByIndex(iRow: number, columnName: string): string {
        return this._data[columnName][iRow];
    }
        
    // Create background time to drain 
    private create_timer() {
        if (this._timerStarted) {
            return;
        }

        this._timerStarted = true;
        setInterval(
            () => {
                this.save_to_trc();
            },
            60000  /* 60000 ms = 60 sec */
            );
    }

    // Attempt to flush outstanding local changes to the server
    private save_to_trc() {
        var l: IKeyValue[] = [];

        for (var i = 0; i < localStorage.length; i++) {
            var x = SheetCache.fromLocalStorageKey(i);
            if (x != null) {
                l.push(x);
            }
        }

        // Flush all until we get a failure
        this.flush(l, 0);
    }

    private flush(l: IKeyValue[], i: number): void {        
        if (i >= l.length) {
            return;
        }
        var x = l[i];

        // Somebody alreayd flushed this item. Cancel the chain and wait for the next sweep.
        if (localStorage.getItem(x.key) == null) {            
            return;
        }
        trcPostSheetUpdateCell2(this._sheetRef, x.recId, x.columnName, x.newValue,() => {
            this._totalUploaded++;
            this._counter--;
            localStorage.removeItem(x.key);

            // Try the next one 
            this.flush(l, i + 1);
        },() => {
                // On network failure, stop trying to flush. 
        });
    }
}

// Update a single cell in the sheet. 
function trcPostSheetUpdateCell2(
    sheetRef: ISheetReference,
    recId: string,
    colName: string,
    newValue: string,
    successFunc: () => void,
    failureFunc: () => void
    ): void {
    // We can post either application/json or text/csv

    var url = sheetRef.Server + "/sheets/" + sheetRef.SheetId;

    var body: ISheetContents = {};
    body["RecId"] = [recId];
    body[colName] = [newValue];

    $.ajax({
        url: url,
        type: 'POST',
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + sheetRef.AuthToken);
        },
        contentType: "application/json",
        data: JSON.stringify(body),
        success: function () {
            successFunc();
        },
        error: function (data: any) {
            failureFunc();
        }
    });
}
