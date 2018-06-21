var fs = require('fs');
var path = require('path');
var cr = require('crypto');

import * as tl from 'vsts-task-lib/task'

var walk = function (dir, done) {
    var results = [];
    fs.readdir(dir, function (err, list) {
        if (err)
            return done(err);
        var pending = list.length;
        if (!pending)
            return done(null, results);
        list.forEach(function (file) {
                file = path.resolve(dir, file);
                fs.stat(file, function (err, stat) {
                    if (stat && stat.isDirectory()) {
                        walk(file, function (err, res) {
                            results = results.concat(res);
                            if (!--pending)
                                done(null, results);
                        });
                    }
                    else {
                        results.push(file);
                        if (!--pending)
                            done(null, results);
                    }
                });
        });
    });
};

var generateHash = function (file) {
    var hash = "";
    return new Promise(function (resolve) {
        var hashInterface = cr.createHash('sha256');
        var stream = fs.createReadStream(file);
        stream.on('data', function (data) {
            hashInterface.update(data, 'utf8');
        });
        stream.on('end', function () {
            hash = hashInterface.digest('hex').toUpperCase();
            resolve(hash);
        });
    });
};

var filePath = path.join(tl.getInput('artifactDirectory',true),'/');
walk(filePath, function (err, result) {
    if (err)
        throw err;
    else {
        var arr = [];
        var hashPromises = [];
        result.forEach(function (file) {
            if(file.substring(file.lastIndexOf('\\')+1) !== 'artifact-metadata.csv') {
                var row = [];
                var hashPromise = generateHash(file).then(function (hash) {
                    row.push(file.substring(filePath.length));
                    row.push(hash);
                    arr.push(row);
                });
                hashPromises.push(hashPromise);
            }
        });
        Promise.all(hashPromises).then(function () {
            var w = fs.createWriteStream(path.join(filePath, 'artifact-metadata.csv'))
            w.once('open', (fd) => {
                arr.forEach((element) => {
                    w.write(element.join()+'\n');
                });
                w.end();
            });
        });
    };
});