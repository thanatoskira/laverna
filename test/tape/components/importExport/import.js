/**
 * Test components/importExport/Import
 * @file
 */
import test from 'tape';
import sinon from 'sinon';
import Radio from 'backbone.radio';
import '../../../../app/scripts/utils/underscore';

import Import from '../../../../app/scripts/components/importExport/Import';

let sand;
test('importExport/Import: before()', t => {
    sand = sinon.sandbox.create();
    t.end();
});

test('importExport/Import: init()', t => {
    const con    = new Import();
    const reload = sand.stub(document.location, 'reload');
    sand.stub(con, 'checkFiles').returns(false);
    sand.stub(con, 'readZip').returns(Promise.resolve());
    sand.stub(con, 'import');

    t.equal(typeof con.init().then, 'function', 'returns a promise');
    t.equal(con.readZip.notCalled, true, 'does nothing if there are not any files');

    con.options = {files: [1]};
    con.checkFiles.returns(true);
    con.init()
    .then(() => {
        t.equal(con.readZip.calledWith(con.options.files[0]), true,
            'reads the ZIP archive');
        t.equal(con.import.called, true, 'imports files from the ZIP archive');
        t.equal(reload.calledAfter(con.import), true,
            'reloads the page after the proccess is over');

        sand.restore();
        t.end();
    });
});

test('importExport/Import: checkFiles()', t => {
    const con   = new Import();
    sand.stub(con, 'isZipFile').returns(true);

    t.equal(con.checkFiles(), false, 'returns false if there are no files');

    con.options.files = [];
    t.equal(con.checkFiles(), false, 'returns false if the array of files is empty');

    con.options = {files: [1]};
    t.equal(con.checkFiles(), true, 'returns true');

    sand.restore();
    t.end();
});

test('importExport/Import: isZipFile()', t => {
    const con = new Import();

    t.equal(con.isZipFile({type: 'application/zip'}), true,
        'returns true if file type is equal to application/zip');

    t.equal(con.isZipFile({name: 'backup.zip'}), true,
        'returns true if the file has ZIP extension');

    t.equal(con.isZipFile({name: 'backup.zip.png'}), false,
        'returns false');

    t.end();
});

test('importExport/Import: readZip()', t => {
    const con = new Import();

    // Override FileReader
    const reader      = {readAsArrayBuffer: sand.stub()};
    global.FileReader = sand.stub().returns(reader);

    const res = con.readZip('file');
    t.equal(typeof res.then, 'function', 'returns a promise');
    t.equal(reader.readAsArrayBuffer.calledWith('file'), true, 'msg');
    t.equal(typeof con.zip, 'object', 'creates a JSZip instance');

    sand.stub(con.zip, 'loadAsync').returns(Promise.resolve('load'));
    reader.onload({target: {result: 'test'}});

    res.then(() => {
        t.equal(con.zip.loadAsync.calledWith('test'), true,
            'loads the archive\'s content');

        sand.restore();
        t.end();
    });
});

test('importExport/Import: import()', t => {
    const con = new Import();
    const zip = {files: [
        {name: 'test.png'},
        {dir: true},
        {name: 'notebooks.json'},
        {name: 'notes/1.json'},
    ]};
    sand.stub(con, 'readFile');

    const res = con.import(zip);
    t.equal(typeof res.then, 'function', 'returns a promise');
    t.equal(con.readFile.callCount, 2, 'ignores directories and non JSON files');
    t.equal(con.readFile.calledWith(zip, zip.files[2]), true, 'imports notebooks');
    t.equal(con.readFile.calledWith(zip, zip.files[3]), true, 'imports notes');

    sand.restore();
    t.end();
});

test('importExport/Import: readFile()', t => {
    const con   = new Import();
    const res   = JSON.stringify({id: '1'});
    const async = sand.stub().returns(Promise.resolve(res));
    con.zip     = {file: sand.stub().returns({async})};
    sand.stub(con, 'importNote');
    sand.stub(con, 'importCollection');

    const name = 'backup/notes-db/notes/1.json';
    con.readFile(con.zip, {name})
    .then(() => {
        t.equal(con.zip.file.calledWith(name), true,
            'reads the file');

        t.equal(con.importNote.calledWith({
            name,
            zip       : con.zip,
            profileId : 'notes-db',
            data      : {id: '1'},
        }), true, 'imports a note');

        return con.readFile(con.zip, {name: 'backup/notes-db/notebooks.json'});
    })
    .then(() => {
        t.equal(con.importCollection.calledWith({
            profileId : 'notes-db',
            data      : {id: '1'},
            type      : 'notebooks',
        }), true, 'imports notebooks');

        sand.restore();
        t.end();
    });
});

test('importExport/Import: importNote()', t => {
    const con   = new Import();
    const async = sand.stub().returns(Promise.resolve('test content'));
    const zip   = {file: sand.stub().returns({async})};
    const req   = sand.stub(Radio, 'request');

    con.importNote({
        zip, data: {}, profileId: 'test', name: 'backups/test/notes/1.json.json',
    })
    .then(() => {
        t.equal(req.calledWith('collections/Notes', 'saveModelObject', {
            profileId : 'test',
            data      : {content: 'test content'},
        }), true, 'saves the note to database');

        sand.restore();
        t.end();
    });
});

test('importExport/Import: importCollection()', t => {
    const con = new Import();
    const req = sand.stub(Radio, 'request');

    con.importCollection({type: 'books'});
    t.equal(req.notCalled, true, 'does nothing if the collection name is incorrect');

    con.importCollection({type: 'notebooks', profileId: 'test', data: [1, 2]});
    t.equal(req.calledWithMatch('collections/Notebooks', 'saveFromArray', {
        profileId : 'test',
        values    : [1, 2],
    }), true, 'saves notebooks');

    sand.restore();
    t.end();
});