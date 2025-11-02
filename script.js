const debounce = (callback, wait) => {
  let timerId;
  return (...args) => {
    clearTimeout(timerId);
    timerId = setTimeout(() => {
      callback(...args);
    }, wait);
  };
};

const getEl = (id) => document.getElementById(id);
const u = {
  input: getEl("input"),
  funcInput: getEl("func-input"),
  out: getEl("output"),
  executionTime: getEl("execution-time"),
  inputSize: getEl("input-size"),
  outputSize: getEl("output-size"),
  presets: getEl("presets"),
};

const presets = {
  "Parse JSON":
    "KGlucHV0KSA9PiB7Cgljb25zdCBqc29uID0gSlNPTi5wYXJzZShpbnB1dCkKICAKICAKICByZXR1cm4gSlNPTi5zdHJpbmdpZnkoanNvbixudWxsLDIpCn07",
  "Trim lines":
    "KGlucHV0KSA9PgogIGlucHV0CiAgICAuc3BsaXQoIlxuIikKICAgIC5tYXAoKHgpID0+IHgudHJpbSgpKQogICAgLmpvaW4oIlxuIik7",
  "Get unique lines":
    "KGlucHV0KSA9PiB7CiAgY29uc3QgbGluZXMgPSBpbnB1dAogICAgLnNwbGl0KCJcbiIpCiAgICAuc29ydCgpCiAgICAuZmlsdGVyKCh4KSA9PiB4KTsKCiAgcmV0dXJuIFsuLi5uZXcgU2V0KGxpbmVzKV0uam9pbigiXG4iKTsKfTs=",
  "Wrap lines in quotes":
    "KGlucHV0KSA9PgogIGlucHV0CiAgICAuc3BsaXQoIlxuIikKICAgIC5zb3J0KCkKICAgIC5maWx0ZXIoKHgpID0+IHgpCiAgICAubWFwKCh4KSA9PiBgIiR7eH0iLGApCiAgICAuam9pbigiXG4iKTs=",
  "To base64": "KHgpID0+IGJ0b2EoeCk7",
  "From base64": "KHgpID0+IGF0b2IoeCk7",
};

const insertPresetDeep = (key) => {
  editor.getDoc().setValue(atob(presets[key]));
  _run();
};

Object.keys(presets).forEach((k) => {
  const button = document.createElement("button");
  button.onclick = () => insertPresetDeep(k);
  button.className = "chip";
  button.innerText = k;
  u.presets.appendChild(button);
});

const editor = CodeMirror.fromTextArea(document.getElementById("func-input"), {
  lineNumbers: true,
  mode: "javascript",
  matchBrackets: true,
  autoCloseBrackets: true,
  tabSize: 2,
});

editor.setOption("extraKeys", {
  "Shift-Space": function (cm) {
    _run();
    return cm;
  },
});

const placeholderCode = "(arg) => {\n  return arg;\n}";
editor.setValue(placeholderCode);

const _run = () => {
  const script = editor.getValue();
  if (!script) {
    removeUrlHash();
    return;
  }
  const startTime = performance.now();
  const original = u.input.value;
  const func = eval(script);
  const out = func(original);
  const endTime = performance.now();

  u.executionTime.innerText = `Execution time: ${endTime - startTime} ms`;
  u.out.value = `${out}`;

  u.inputSize.innerText = `${original.length} characters`;
  u.outputSize.innerText = `${out.length} characters`;
};

const run = debounce(_run, 400);

const lzwEncode = (s) => {
  let dict = {};
  let data = (s + "").split("");
  let out = [];
  let currChar;
  let phrase = data[0];
  let code = 256;
  for (let i = 1; i < data.length; i++) {
    currChar = data[i];
    if (dict[phrase + currChar] != null) {
      phrase += currChar;
    } else {
      out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
      dict[phrase + currChar] = code;
      code++;
      phrase = currChar;
    }
  }
  out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
  for (let i = 0; i < out.length; i++) {
    out[i] = String.fromCharCode(out[i]);
  }
  return out.join("");
};

const lwzDecode = (s) => {
  let dict = {};
  let data = (s + "").split("");
  let currChar = data[0];
  let oldPhrase = currChar;
  let out = [currChar];
  let code = 256;
  let phrase;
  for (let i = 1; i < data.length; i++) {
    let currCode = data[i].charCodeAt(0);
    if (currCode < 256) {
      phrase = data[i];
    } else {
      phrase = dict[currCode] ? dict[currCode] : oldPhrase + currChar;
    }
    out.push(phrase);
    currChar = phrase.charAt(0);
    dict[code] = oldPhrase + currChar;
    code++;
    oldPhrase = phrase;
  }
  return out.join("");
};

const urlSave = {
  fromBinary: (encoded) => {
    const isCompressed = encoded.startsWith("v1_");
    const _encoded = isCompressed ? encoded.substring(3) : encoded;

    const binary = atob(_encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const compressed = String.fromCharCode(...new Uint16Array(bytes.buffer));

    if (!isCompressed) {
      return compressed;
    }

    const uncompressed = lwzDecode(compressed);
    return uncompressed;
  },
  toBinary: (string) => {
    const compressed = lzwEncode(string);
    const codeUnits = new Uint16Array(compressed.length);
    for (let i = 0; i < codeUnits.length; i++) {
      codeUnits[i] = compressed.charCodeAt(i);
    }
    return btoa(String.fromCharCode(...new Uint8Array(codeUnits.buffer)));
  },
  remove: () => {
    window.location = window.location.href.split("#")[0];
  },
  set: (value) => {
    if (!value) {
      urlSave.remove();
      return;
    }
    window.location.hash = `#v1_${urlSave.toBinary(value)}`;
  },
  get: () => {
    const hash = window.location.hash.substring(1);
    if (hash) {
      const decoded = urlSave.fromBinary(hash);
      return decoded;
    }
  },
};

const setUrlHash = () => {
  const script = editor.getValue();
  if (!script) {
    urlSave.remove();
    return;
  }
  urlSave.set(script);
};

const getScriptFromUrlHash = () => {
  const result = urlSave.get();
  if (result) {
    editor.setValue(result);
  }
};
getScriptFromUrlHash();
