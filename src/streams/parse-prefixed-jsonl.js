export const parse = (prefix, type = 'stdout') => {
  let rest = '';
  let haveRest = false;
  let lastLineWasJSON = false;
  return new TransformStream({
    transform(line, controller) {
      if (line.startsWith(prefix)) {
        try {
          const value = JSON.parse(line.slice(prefix.length));
          if (value && typeof value == 'object') {
            controller.enqueue(value);
          }
          lastLineWasJSON = true;
        } catch (_) {
          // squelch
        }
        return;
      }
      if (lastLineWasJSON) {
        rest += line;
        lastLineWasJSON = false;
        haveRest = !!rest;
      } else {
        if (haveRest) {
          controller.enqueue({type, name: rest});
          rest = line;
          haveRest = !!rest;
        } else {
          if (line) {
            rest = line;
            haveRest = true;
          }
        }
      }
    },
    flush(controller) {
      if (haveRest) {
        controller.enqueue({type, name: rest});
      }
      rest = '';
      haveRest = false;
    }
  });
};

export default parse;
