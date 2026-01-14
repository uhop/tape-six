export const wrap = (type = 'stdout') =>
  new TransformStream({
    transform(line, controller) {
      controller.enqueue({type, name: line});
    }
  });

export default wrap;
