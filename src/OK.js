import {Tester, setAliases} from './Tester.js';

// code mostly borrowed from https://github.com/heya/ice/blob/master/assert.js under BSD-3

const listVariables = (code, self) => {
  const vars =
    code
      .replace(
        /(?:\b[A-Z]|\.[a-zA-Z_$])[a-zA-Z_$\d]*\b|\b[a-zA-Z_$][a-zA-Z_$\d]*:|\b(?:function|return|if|else|switch|case|while|for|do|break|continue|var|try|catch|finally|throw|with|debugger|default|this|true|false|null|undefined|typeof|instanceof|in|delete|new|void|arguments|decodeURI|decodeURIComponent|encodeURI|encodeURIComponent|escape|eval|isFinite|isNaN|parseFloat|parseInt|unescape|window|document|const|let|async|await)\b|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g,
        ''
      )
      .match(/(\b[a-z_$][a-z_$\d]*\b)/gi) || [];
  const result = [],
    resultSet = {};
  for (const name of vars) {
    const key = '-' + name;
    if (name != self && !resultSet[key]) {
      result.push("'" + name + "':" + name);
      resultSet[key] = 1;
    }
  }
  return '{' + result.join(',') + '}';
};

Tester.prototype.OK = function OK(condition, msg, options) {
  if (typeof condition != 'string') {
    throw new TypeError('Condition must be a string');
  }
  if (typeof msg == 'object') {
    options = msg;
    msg = undefined;
  }
  const {self = 't'} = options || {};
  return `(${self}.reporter.report({
  name: ${JSON.stringify(msg || condition)},
  test: ${self}.testNumber,
  marker: new Error(),
  time: ${self}.timer.now(),
  operator: 'ok',
  fail: !(${condition}),
  data: {
    actual: ${listVariables(condition, self)}
  }
}))`;
};

setAliases('OK', 'TRUE, ASSERT');
