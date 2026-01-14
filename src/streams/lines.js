export const lines = () => {
  let rest = '';
  return new TransformStream({
    transform(chunk, controller) {
      const lines = chunk.split(/\r?\n/g);
      rest += lines[0];
      if (lines.length < 2) return;
      lines[0] = rest;
      rest = lines.pop();
      for (const line of lines) controller.enqueue(line);
    },
    flush(controller) {
      if (rest) controller.enqueue(rest);
      rest = '';
    }
  });
};

export default lines;
