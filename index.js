var cheerio = require('cheerio');
var dir = require('node-dir');
var fs = require('fs');
var async = require('async');
var Puid = require('puid');
var C = require('./codeTables');

var dictionary = {};
var index = {};
var files = [];
/** @type {Set<string>} */
var unknown = new Set();

var VERBOSE = false;
var FILEGREP = /CIDE\.[A-Z]/;
var ONLYWEBSTER = true;

function monkeyPatch ($) {
  $.prototype.forEach = function (cb) {
    this.each((i, el) => cb($(el), i, el));
  };
}

/**
 * Filter unique. Pass to Array#filter
 * @template T
 * @param {T} value
 * @param {number} index
 * @param {T[]} self
 */
function unique (value, index, self) {
  return self.indexOf(value) === index;
}

/**
 * Replace custom entities in the form <NAME/
 * @param {string} string
 */
function replaceEntities (string) {
  return string.replace(/<([?\w]+?)\//g, (match, text) => {
    // Check our dictionary objects
    if (C.entities.hasOwnProperty(text)) {
      return C.entities[text];
    } else if (C.accents.hasOwnProperty(text.slice(1))) {
      return text.slice(0, 1) + C.accents[text.slice(1)];
    } else if (C.doubleAccents.hasOwnProperty(text.slice(2))) {
      return text.slice(0, 2) + C.accents[text.slice(2)];
    } else if (text.indexOf('frac') === 0) {
      // There are two forms frac1x5000 and frac34
      text = text.replace(/frac(\d+?)x?(\d+)/g, function (v, a, b) {
        return '<sup>' + a + '</sup>' + '⁄' + '<sub>' + b + '</sub>';
      });
      return text;
    } else if (text.endsWith('it') || text.endsWith('IT')) {
      return `<i>${text.slice(0, -2)}</i>`;
    } else {
      unknown.add(text);
      return '[' + text + ']';
    }
  });
}

/**
 * @param {string} string
 */
function replaceVarious (string) {
  return (
    string
      // Remove comments
      .replace(/<!?--[\s\S]*?-->/g, '')
      .replace(/<!?--/g, '')

      // Nicer long dashes
      .replace(/--/g, '–')
      .replace(/---/g, '–')

      // Double bar
      .replace(/\|\|/g, '‖')
      .replace(/\\'d8/g, '‖')

      // Empty prounounciation tags
      .replace(/\s*<pr>\(\?\)<\/pr>/g, '')
      .replace(/\s*<pr>\(�\)<\/pr>/g, '')

      // Move whitespace inside tags, twice
      .replace(/<\/(\w+?)>(\s+)/g, '$2</$1>')
      .replace(/<\/(\w+?)>(\s+)/g, '$2</$1>')
  );
}

/*
* Transcribe the greek (grk) tags
*/

function greekToUTF8 (input) {
  var result = ''; var curPos = 0; var curLength;

  while (curPos < input.length) {
    // Longest combination is three
    curLength = 3 + 1;
    while (curLength--) {
      const frag = input.slice(curPos, curPos + curLength);

      if (C.greek.hasOwnProperty(frag)) {
        // Fix trailing sigma
        if (frag === 's' && curPos + 1 === input.length) {
          result += 'ς';
        } else {
          result += C.greek[frag];
        }

        curPos += frag.length;
        break;
      }

      // We couln't find anything
      // Add one glyph to the string and try again
      if (curLength === 0) {
        // console.log('Problem when transcribing the greek', input);
        result += input[curPos];
        curPos++;
        break;
      }
    }
  }

  return result;
}

function processFiles () {
  dir.readFiles('srcFiles', {
    match: FILEGREP
  }, function (err, content, next) {
    if (err) throw err;
    files.push(content);
    next();
  },
  function (err, files) {
    if (err) throw err;
    console.log('Finished reading files:', files);

    parseFiles(function () {
      var output = JSON.stringify({
        dictionary: dictionary,
        index:      index
      }, null, 4);

      if (unknown.length) {
        console.log('Unknown entities:', [...unknown].join(', '));
      }

      fs.writeFileSync('output/dictPrelim.json', output, 'utf8');
      postProcessDictionary();
      writeOut();
    });
  });
}

function writeOut () {
  console.log('Done; starting to build XML');

  const xml = buildXML();
  const output = JSON.stringify(dictionary, null, 4);

  fs.writeFile('output/dict.json', output, 'utf8', err => {
    if (err) throw err;
    console.log('Wrote file');
  });
  fs.writeFile('template/dict.xml', xml, 'utf8', err => {
    if (err) throw err;
    console.log('Wrote file');
  });
}

function parseFiles (cb) {
  const q = async.queue((task, callback) => callback(), 5);
  q.drain(() => {
    console.log('Everything was parsed');
    cb();
  });

  files.forEach(item => {
    q.push({ name: 'Task' }, () => {
      parseFile(item);
    });
  });
}

function parseFile (file) {
  file = replaceEntities(file);
  file = replaceVarious(file);

  var curEntryName = 'NOTHING';

  var $ = cheerio.load(file, {
    normalizeWhitespace: true,
    xmlMode:             true,
    decodeEntities:      false
  });
  monkeyPatch($);

  // Walk through each paragraph. If the paragraph contains a hw tag,
  // Add a new entry.
  $('p').forEach((el, i) => {
    if (ONLYWEBSTER) {
      let src;
      let p = el;
      while (!src) {
        src = p.find('source');
        p = p.next();
      }

      if (src.text().trim() !== '1913 Webster') {
        return true;
      }

      var next = $(src[0].next);
      var prev = $(src[0].prev);

      src.remove();
      prev.remove();
      next.remove();
    }

    const ent = el.find('ent');
    if (ent.length) {
      curEntryName = ent.first().text();

      if (!index[curEntryName]) {
        index[curEntryName] = [];
      }

      ent.forEach(ent => {
        index[curEntryName].push(ent.text());
        const br = ent.next();
        if (br.is('br')) br.remove();
      });

      ent.remove();
    }

    // Remove leading and trailing br
    const children = el.children();
    const first = children.first();
    const last = children.last();
    if (first.is('br')) first.remove();
    if (last.is('br')) {
      last.prev().append(' ');
      last.remove();
    }

    const hw = el.find('hw, wf, pr');
    hw.forEach(hw =>
      hw.html(
        hw
          .text()
          .replace(/\*/g, '&#x002d;')
          .replace(/"/g, '&#8242;')
          .replace(/`/g, '&#x02CA;')
          .replace(/'/g, '’')
      )
    );

    const grk = el.find('grk');
    grk.forEach(grk => grk.text(greekToUTF8(grk.text())));

    if (!dictionary[curEntryName]) {
      dictionary[curEntryName] = '';
    }

    dictionary[curEntryName] += el.html();

    if (i % 1000 === 0) {
      console.log('Parsed', i, curEntryName);
    }
  });
}

function postProcessDictionary () {
  let i = 0;

  delete dictionary.NOTHING;

  console.log(`Postprocessing ${Object.keys(dictionary).length} entries...`);

  for (var entry in dictionary) {
    var text = dictionary[entry].trim();
    text = text.replace(/\s+[-]{2,3}\s+/, ' — ');
    text = text.replace(/'/, '’');

    // Wrap loose sentencens
    const $ = cheerio.load(text, { xmlMode: true });
    monkeyPatch($);

    $('q').forEach(quote => {
      const next = quote.next();
      const author = next.find('qau');
      if (author.length) {
        quote.append(author);
        next.remove();
      }
    });

    // Change tag types
    $('*').forEach(el => {
      const tagName = el[0].name;
      let newTagName;
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
      if (newTagName !== tagName) {
        el[0].name = newTagName;
        el.addClass(tagName);
      }
    });

    dictionary[entry] = $.root().html();

    if (i % 1000 === 0 || VERBOSE) {
      console.log('Postprocessing entry', i, entry);
    }

    i++;
  }
}

function buildXML () {
  var ids = new Puid(true);
  console.log('Building xml');
  var xml = '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<d:dictionary xmlns="http://www.w3.org/1999/xhtml" ' +
            'xmlns:d="http://www.apple.com/DTDs/DictionaryService-1.0.rng">\n';

  for (const entry in dictionary) {
    xml += `\n<d:entry id="A${ids.generate()}" d:title="${entry}">\n`;
    xml += index[entry]
      .filter(unique)
      .map(index => `<d:index d:value="${index}"/>`)
      .join('\n');
    xml += '\n';

    xml += '<div>' + dictionary[entry] + '</div>';
    xml += '\n</d:entry>\n';
  }

  xml += '</d:dictionary>';

  return xml;
}

processFiles();
