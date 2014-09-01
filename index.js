var cheerio = require('cheerio');
var dir = require('node-dir');
var commander = require('commander');
var fs = require('fs');
var ent = require('ent');
var unorm = require('unorm');
var async = require('async');
var puid = require('puid');
var C = require('./codeTables');

var dictionary = {};
var index = {};
var files = [];
var unknown = [];

var VERBOSE = false;
var FILEGREP = /CIDE/;
var ONLYWEBSTER = true;


// Filter unique
function unique(value, index, self) {
  return self.indexOf(value) === index;
}

/*
* Replace custom entities in the form <NAME/
*/
function replaceEntities(string) {
  var pattern = /<([\?\w]+?)\//g;

  var unknown = [];

  string = string.replace(pattern, function(match, text){
    // Check our dictionary objects
    if (C.entities.hasOwnProperty(text)) {
      return C.entities[text];
    } else if (C.accents.hasOwnProperty(text.substring(1))) {
      return text.substring(0,1) + C.accents[text.substring(1)];
    } else if (C.doubleAccents.hasOwnProperty(text.substring(2))) {
      return text.substring(0,2) + C.accents[text.substring(2)];
    } else if (text.indexOf('frac') == 0) {
      // There are two forms frac1x5000 and frac34
      text = text.replace(/frac(\d+?)x(\d+)/g, function (v, a, b) {
        return '<sup>' + a + '</sup>' + '&frasl;' + '<sub>' + b + '</sub>';
      });
      text = text.replace(/frac(\d)(\d+)/g, function (v, a, b) {
        return '<sup>' + a + '</sup>' + '&frasl;' + '<sub>' + b + '</sub>';
      });
      return text;
    } else {
      unknown.push(text);
      return '[' + text + ']';
    }
  });

  unknown = unknown.filter(unique);
  if (unknown.length) {
    console.log("Unknown entities:", unknown);
  }

  return string;
}

/*
* Transcribe the greek (grk) tags
*/

function greekToUTF8(input) {
  var result = '', curPos = 0, curLength, frag = '';

  while (curPos < input.length) {
    // Longest combination is three
    curLength = 3 + 1;
    while (curLength--) {
      frag = input.substring(curPos, curPos + curLength);

      if (C.greek.hasOwnProperty(frag)) {
        // Fix trailing sigma
        if (frag === 's' && curPos + 1 == input.length) {
          result += "ς";
        } else {
          result += C.greek[frag];
        }

        curPos += frag.length;
        break;
      }

      // We couln't find anything
      // Add one glyph to the string and try again
      if (curLength === 0) {
        //console.log('Problem when transcribing the greek', input);
        result += input[curPos];
        curPos++;
        break;
      }
    }
  }

  return result;
}



function processFiles() {
  dir.readFiles('srcFiles', {
    match: FILEGREP
    }, function(err, content, next) {
        if (err) throw err;
        files.push(content);
        next();
    },
    function(err, files){
        if (err) throw err;
        console.log('Finished reading files:', files);

        parseFiles(function () {
          var output = JSON.stringify({
              dictionary: dictionary,
              index: index
            }, null, 4);

          fs.writeFileSync('output/dictPrelim.json', output, 'utf8');
          postProcessDictionary();
          writeOut();
        });
    });
}

function writeOut() {
  console.log("Done; starting to build XML");

  var xml = buildXML();
  var output = JSON.stringify(dictionary, null, 4);

  fs.writeFile('output/dict.json', output, 'utf8', function (err) {
    if (err) throw err;
    console.log('Wrote file');
  });
  fs.writeFile('template/dict.xml', xml, 'utf8', function (err) {
    if (err) throw err;
    console.log('Wrote file');
  });
}

function prelim() {
  fs.readFile('output/dictPrelim.json', 'utf8', function (err, data) {
    if (err) throw err;
    var data = JSON.parse(data);
    dictionary = data.dictionary;
    index = data.index;

    postProcessDictionary();
    writeOut();
  });

}

function jsonToXML() {
  fs.readFile('output/dict.json', 'utf8', function (err, data) {
    if (err) throw err;
    dictionary = JSON.parse(data);

    var xml = buildXML();
    fs.writeFile('template/dict.xml', xml, 'utf8', function (err) {
      if (err) throw err;
      console.log('Wrote file');
    });
  });

}

function parseFiles(cb) {
  var q = async.queue(function (task, callback) {
    callback();
  }, 5);
  q.drain = cb;

  files.forEach(function (item) {
    q.push({name: 'Task'}, function (err) {
      parseFile(item);
    });
  });
}


function parseFile(file) {
  file = replaceEntities(file);

  var curEntryName = 'NOTHING';

  var $ = cheerio.load(file, {
    normalizeWhitespace: true,
    xmlMode: true,
    decodeEntities: false
  });

  // Walk through each paragraph. If the paragraph contains a hw tag,
  // Add a new entry.
  $('p').each(function (i) {

    if (ONLYWEBSTER) {
      var src = $(this).find('source');

      if (src.text() !== '1913 Webster') {
        return true;
      }

      var next = $(src[0].next);
      var prev = $(src[0].prev);

      src.remove();
      prev.remove();
      next.remove();
    }

    var ent = $(this).find('ent');
    if (ent.length) {
      curEntryName = ent.first().text();

      if (!index[curEntryName]) {
        index[curEntryName] = [];
      }

      ent.each(function () {
        index[curEntryName].push($(this).text());
      });

      ent.remove();
    }


    var hw = $(this).find('hw');
    hw.each(function () {
      var text = $(this).text();
      text = text.replace(/\*/g, '&#x002d;');
      text = text.replace(/\"/g, '&#8242;');
      text = text.replace(/`/g, '&#x02CA;');
      text = text.replace(/'/g, '’');
      text = text.replace(/\|\|/g, '');
      $(this).html(text);
    });

    var grk = $(this).find('grk');
    grk.each(function () {
      var text = $(this).text();
      text = greekToUTF8(text);
      $(this).text(text);
    });

    if (!dictionary[curEntryName]) {
      dictionary[curEntryName] = '';
    }

    var text = $(this).html();

    dictionary[curEntryName] += text;

    if (i%1000 === 0) {
      console.log('Parsed', i, curEntryName);
    }
  });
}

function wrapAll(elements, structure, $) {
  var intro = $(structure);
  elements.first().before(intro);
  elements.each(function () {
    intro.append($(this));
  });
}

function postProcessDictionary() {
  var dashes = new RegExp('\\s+[-]{2,3}\\s+','g');
  var i = 0;

  delete dictionary.NOTHING;

  for (var entry in dictionary) {
    var text = dictionary[entry];
        text = text.replace(dashes, ' — ');
    // Wrap loose sentencens
    var $ = cheerio.load(text);

    $('hw').each(function() {
      var intro = $(this).nextUntil('def, sn');
      wrapAll(intro, '<intro>', $);

      var block = $(this).nextUntil('hw');
      wrapAll(block, '<block>', $);
    });

    $('def').each(function () {
      var extra = $(this).nextUntil('hw, sn');
      wrapAll(extra, '<extra>', $);
    });

    $('blockquote').each(function () {
      var author = $(this).next();
      if (!author.is('i')) {
        author = $(this).children().last();
      }
      if (author.is('i')) {
        author.prepend('— ');
        var wrap = $('<au>');
        wrap.append(author);
        $(this).append(wrap);
      }
      var children = $(this).children();
    });

    // Change tag types
    $('*').each(function () {
      var that = $(this);
      var tagName = that[0].name, newTagName;
      switch (tagName) {
        case 'hw':
          newTagName = 'h2';
          break;
        case 'plain':
          newTagName = 'span';
          break;
        case 'xex':
        case 'it':
          newTagName = 'i';
          break;
        case 'br':
        case 'i':
        case 'b':
        case 'p':
        case 'sup':
        case 'sub':
        case 'a':
          newTagName = tagName;
          break;
        default:
          newTagName = 'div';
          break;
      }
      if (newTagName != tagName) {
        that[0].name = newTagName;
        that.addClass(tagName);
      }
    });

    $('i div, h2 div').each(function () {
      $(this)[0].name = 'span';
    });

    $('i h2').each(function () {
      $(this).parent()[0].name = 'h2'
      $(this)[0].name = 'i';
    });

    dictionary[entry] = $.root().html();

    if (i%1000 === 0 || VERBOSE) {
      console.log('Postprocessing entry', i, entry);
    }

    i++;
  }

}


function buildXML() {
  var ids = new puid(true);
  console.log('Building xml');
  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<d:dictionary xmlns="http://www.w3.org/1999/xhtml" ' +
            'xmlns:d="http://www.apple.com/DTDs/DictionaryService-1.0.rng">\n';

  for (var entry in dictionary) {
    xml += '\n<d:entry id="A' + ids.generate() + '" d:title="' + entry + '">\n';
    xml += buildIndex(entry);

    // Cheerio mangles our <br> tags, fix them here
    xml += '<div>' + dictionary[entry].replace(/<br>/ig, '<br/>') + '</div>';
    xml += '\n</d:entry>\n';
  }

  xml += '</d:dictionary>';

  return xml;

  function buildIndex(entry) {
    var result = '';

    index[entry] = index[entry].filter(unique);

    index[entry].forEach(function (index) {
      result += '<d:index d:value="' + index + '" d:title="' + index + '"/>\n';
    });

    return result;
  }
}

processFiles();
//prelim();
