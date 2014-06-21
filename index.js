var cheerio = require('cheerio');
var dir = require('node-dir');
var commander = require('commander');
var fs = require('fs');
var ent = require('ent');
var unorm = require('unorm');
var async = require('async');
var puid = require('puid');

var dictionary = {};
var files = [];


// The text has a number of custom entities added.
var regexEntities = [];
var customEntities = {
  // Misspellings first
  '&(\\w)cit;':    '&$1circ;',
  '&(\\w)ct;':     '&$1circ;',
  '&(\\w)cr;':     '&$1circ;',
  '&(\\w)cr\\*;':  '&$1circ;',
  '&(\\w)nac;':    '&$1macr;',
  '&(\\w)mc;':     '&$1macr;',
  '&(\\w)tl;':     '&$1tilde;',
  '&(\\w)al;':     '&$1sl;',
  '&(\\w)slc;':    '&$1sl;',
  '&(\\w)dor;':    '&$1dot;',
  '&(\\w)sot;':    '&$1dot;',
  '&(\\w)sd;':     '&$1sdot;',
  '&(\\w\\w)mc;':  '&$1mac;',
  '&(\\w\\w)mcr;': '&$1mac;',
  '&til;':         '&etilde;',
  '&cr;':          '&ecirc;',
  '&iques;':       '&iquest;',
  '&aemacr;':      '&aelig;x035E;',

  // Proper
  '&(\\w)circ;':   '$1&#x0302;',
  '&(\\w)tilde;':  '$1&#x0303;',
  '&(\\w)macr;':   '$1&#x0304;',
  '&(\\w)breve;':  '$1&#x0306;',
  '&(\\w)dot;':    '$1&#x0307;',
  '&(\\w)sdot;':   '$1&#x0323;',
  '&(\\w)dd;':     '$1&#x0324;',
  '&(\\w)sm;':     '$1&#x0331;',

  // Double length marks
  '&(\\w\\w)cr;':  '$1&#x035D;',
  '&(\\w\\w)mac;': '$1&#x035E;',

  // Semilong (macron with vertical bar on top)
  '&(\\w)sl;':     '$1&#x0304;&#x030d;',

  // Some special charater
  '&pause;':       '&#x1d110;',
  '&yogh;':        '&#541;',
  '&Eth;':         '&#x00D0;',
  '&thlig;':       'th',
  '&fist;':        '&#9758;',
  '&hand;':        '&#9758;',
  '&asterism;':    '&#8258;',

  // Asper (see wiki/rough breathing)
  '&asper;':       '&#x02BD;',
  '&spasp;':       '&#x02BD;',

  // Uppercase greek letters (&GAMMA; to &Gamma;)
  '&([A-Z])([A-Z]+?);': function (v,a,b) {
    return '&' + a + b.toLowerCase() + ';';
  },

  // Fractions (in the form of frac1x2500)
  '&frac[t]*(\\d+?)x(\\d+?);': function (v,a,b) {
    return '<sup>' + a + '</sup>' + '&frasl;' + '<sub>' + b + '</sub>';
  },

  // Beautify dashes
  ' -- ':          '&mdash;',
  ' --- ':         '&mdash;',

  // Note with only one unkown character
  '\\s\\(&\\?;\\)':'',

  // Marker for unknown letters
  '&\\?;':         '&#xFFFD;',

  // Remove comments
  '<!.*?!>'       :'',

  // Move whitespace inside tags
  // Twice
  '</(\\w+?)>(\\s+)': '$2</$1>',
  '</(\\w+?)>(\\s*)': '$2</$1>',

  // Rename some tags (col is a selfclosing tag in html)
  '<col>':          '<colo>',
  '</col>':         '</colo>',

  // Close <br> for xml compat
  '<br>':           '<br/>',
  '<BR>':           '<br/>',

  // Rename gt, lt to preserve for later
  '&gt;':           '&#gt;',
  '&lt;':           '&#lt;',

  // Pronunciation hyphen
  '(\\S)\\*(\\S)':  '$1&#x2010;$2',
};

function compileRegexs() {
  for (var search in customEntities) {
    regexEntities.push({
      regex: new RegExp(search, 'g'),
      replace: customEntities[search]
    });
  }
}

function replaceEntities(string) {
  regexEntities.forEach(function (item) {
    string = string.replace(item.regex, item.replace);
  });
  string = ent.decode(string);
  string = unorm.nfkc(string);
  string = string.replace(/&#gt;/g, '&gt;');
  string = string.replace(/&#lt;/g, '&lt;');
  return string;
}


 /*
 * Removes the introduction and tag references
 */
function stripComments(file) {
  var fileParts;

  // The actual content starts after the end of the first comment
  fileParts = file.split('!>');
  fileParts.shift();
  fileParts = fileParts.join('!>');
  return fileParts;
}

function processFiles() {
  compileRegexs();

  dir.readFiles('srcFiles', {
    match: /.txt$/
    }, function(err, content, next) {
        if (err) throw err;
        files.push(content);
        next();
    },
    function(err, files){
        if (err) throw err;
        console.log('Finished reading files:', files);

        parseFiles(function () {
          var output = JSON.stringify(dictionary, null, 4);
          fs.writeFileSync('output/dictPrelim.json', output, 'utf8');
          postProcessDictionary();
          writeOut();
        });
    });
}

function writeOut() {
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
    dictionary = JSON.parse(data);

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
  file = stripComments(file);

  file = replaceEntities(file);

  var curEntryName = 'NOTHING';

  var $ = cheerio.load(file, {
    normalizeWhitespace: true,
    xmlMode: false
  });

  // Walk through each paragraph. If the paragraph contains a hw tag,
  // Add a new entry.
  $('p').each(function (i) {
    var hw = $(this).find('hw');
    if (hw.length) {
      hw.each(function () {
        var text = $(this).html();
        text = text.replace(/\*/g, '&#x002d;');
        text = text.replace(/\"/g, '&#8242;');
        text = text.replace(/&quot;/g, '&#8242;');
        text = text.replace(/`/g, '&#x02CA;');
        text = text.replace(/'/g, '’');
        text = text.replace(/\|\|/g, '');
        $(this).html(text);
      });

      curEntryName = hw.first().text();

    }
    if (!dictionary[curEntryName]) {
      dictionary[curEntryName] = '';
    }

    var text = $(this).html();
    text = text.replace(/\r\n/g,' ');

    dictionary[curEntryName] += text;

    if (i%1000 === 0) {
      console.log('Parsed', i);
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
  var col = new RegExp('<col>','g');
  var col2 =  new RegExp('</col>','g');
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

    if (i%1000 === 0) {
      console.log('Postprocessing entry', i);
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
    var withHyphen = entry.replace(/[\*′ˊ\|∥‐]/g,'').trim();
    var noHyphen = withHyphen.replace(/[-]/g,'');

    xml += '\n<d:entry id="A' + ids.generate() + '" d:title="' + noHyphen + '">\n';
    xml += buildIndex(entry, withHyphen, noHyphen);
    // Cheerio mangles our <br> tags, fix them here
    xml += '<div>' + dictionary[entry].replace(/<br>/ig, '<br/>') + '</div>';
    xml += '\n</d:entry>\n';
  }

  xml += '</d:dictionary>';

  return xml;

  function buildIndex(entry, withHyphen, noHyphen) {
    var result = '<d:index d:value="' + noHyphen + '" d:title="' + noHyphen + '"/>\n';
    if (withHyphen != noHyphen) {
        result += '<d:index d:value="' + withHyphen + '" d:title="' + withHyphen + '"/>\n';
    }
    return result;
  }
}

//jsonToXML();
prelim();
//processFiles();
