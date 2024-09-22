const TWO_PI = 2 * Math.PI;

const tmpl = (template, dict) => template.replace(/\$\{([^\}]*)\}/g, (_, name) => dict[name]);

export const makeSegment = (args, options) => {
  // args is {startAngle, angle, index, className}
  // optional index points to a data point
  // optional className is a CSS class
  // default startAngle=0 (in radians)
  // default angle=2*PI (in radians)

  // options is {center, innerRadius, radius, gap, precision, document}
  // default center is {x=0, y=0}
  // default innerRadius=0
  // default radius=100
  // default gap=0 (gap between segments in pixels)
  // default precision=6 (digits after decimal point)
  // default document is document

  const node = (options.document || document).createElementNS('http://www.w3.org/2000/svg', 'path'),
    center = options.center || {x: 0, y: 0},
    innerRadius = Math.max(options.innerRadius || 0, 0),
    radius = Math.max(options.radius || 100, innerRadius),
    gap = Math.max(options.gap || 0, 0),
    precision = options.precision || 6,
    angle = typeof args.angle != 'number' || args.angle >= TWO_PI ? TWO_PI : args.angle,
    startAngle = args.startAngle || 0;

  let path;

  const innerGapAngle = gap / innerRadius / 2,
    gapAngle = gap / radius / 2,
    cx = center.x,
    cy = center.y,
    data = {
      cx: cx.toFixed(precision),
      cy: cy.toFixed(precision),
      r: radius.toFixed(precision)
    };

  if (angle >= TWO_PI) {
    data.tr = (2 * radius).toFixed(precision);
    // generate a circle
    if (innerRadius <= 0) {
      // a circle
      path = tmpl('M${cx} ${cy}m -${r} 0a${r} ${r} 0 1 0 ${tr} 0a${r} ${r} 0 1 0 -${tr} 0z', data);
    } else {
      data.r0 = innerRadius.toFixed(precision);
      data.tr0 = (2 * innerRadius).toFixed(precision);
      // a donut
      path = tmpl(
        'M${cx} ${cy}m -${r} 0a${r} ${r} 0 1 0 ${tr} 0a${r} ${r} 0 1 0 -${tr} 0zM${cx} ${cy}m -${r0} 0a${r0} ${r0} 0 1 1 ${tr0} 0a${r0} ${r0} 0 1 1 -${tr0} 0z',
        data
      );
    }
  } else {
    const endAngle = startAngle + angle;
    let start = startAngle + gapAngle,
      finish = endAngle - gapAngle;
    if (finish < start) {
      start = finish = startAngle + angle / 2;
    }
    data.lg = angle > Math.PI ? 1 : 0;
    data.x1 = (radius * Math.cos(start) + cx).toFixed(precision);
    data.y1 = (radius * Math.sin(start) + cy).toFixed(precision);
    data.x2 = (radius * Math.cos(finish) + cx).toFixed(precision);
    data.y2 = (radius * Math.sin(finish) + cy).toFixed(precision);
    if (innerRadius <= 0) {
      // a pie slice
      path = tmpl('M${cx} ${cy}L${x1} ${y1}A${r} ${r} 0 ${lg} 1 ${x2} ${y2}L${cx} ${cy}z', data);
    } else {
      start = startAngle + innerGapAngle;
      finish = endAngle - innerGapAngle;
      if (finish < start) {
        start = finish = startAngle + angle / 2;
      }
      data.r0 = innerRadius.toFixed(precision);
      data.x3 = (innerRadius * Math.cos(finish) + cx).toFixed(precision);
      data.y3 = (innerRadius * Math.sin(finish) + cy).toFixed(precision);
      data.x4 = (innerRadius * Math.cos(start) + cx).toFixed(precision);
      data.y4 = (innerRadius * Math.sin(start) + cy).toFixed(precision);
      // a segment
      path = tmpl('M${x1} ${y1}A${r} ${r} 0 ${lg} 1 ${x2} ${y2}L${x3} ${y3}A${r0} ${r0} 0 ${lg} 0 ${x4} ${y4}L${x1} ${y1}z', data);
    }
  }
  node.setAttribute('d', path);
  if ('index' in args) {
    node.setAttribute('data-index', args.index);
  }
  if (args.className) {
    node.setAttribute('class', args.className);
  }
  return node;
};

export const processPieRun = (data, options) => {
  // data is [datum, datum...]
  // datum is {value, className, skip, hide}
  // value is a positive number
  // className is an optional CSS class name
  // skip is a flag (default: false) to skip this segment completely
  // hide is a flag (default: false) to suppress rendering

  // options is {center, innerRadius, radius, startAngle, minSizeInPx, skipIfLessInPx, emptyClass, precision}
  // default center is {x=0, y=0}
  // default innerRadius=0
  // default radius=100
  // default startAngle=0 (in radians)
  // default gap=0 (gap between segments in pixels)
  // default precision=6 (digits after decimal point)
  // minSizeInPx is to make non-empty segments at least this big (default: 0).
  // skipIfLessInPx is a threshold (default: 0), when to skip too small segments.
  // emptyClass is a CSS class name for an empty run

  const radius = Math.max(options.radius || 100, options.innerRadius || 0, 0),
    gap = Math.max(options.gap || 0, 0),
    minSizeInPx = Math.max(options.minSizeInPx || 0, 0),
    skipIfLessInPx = Math.max(options.skipIfLessInPx || 0, gap),
    runOptions = {
      center: options.center,
      innerRadius: options.innerRadius,
      radius: radius,
      gap: gap,
      precision: options.precision,
      document: options.document
    };

  // sanitize data
  data.forEach((datum, index) => {
    if (!datum.skip && (isNaN(datum.value) || datum.value === null || datum.value <= 0)) {
      datum.skip = true;
    }
    datum.index = index;
  });

  const total = data.reduce((acc, datum) => (datum.skip ? acc : acc + datum.value), 0);

  let node;
  if (total <= 0) {
    // empty run
    node = makeSegment(
      {
        index: -1, // to denote that it is not an actionable node
        className: options.emptyClass
      },
      runOptions
    );
    return [node];
  }

  const nonEmptyDatumNumber = data.reduce((acc, datum) => (datum.skip ? acc : acc + 1), 0);

  if (nonEmptyDatumNumber === 1) {
    data.some(datum => {
      if (datum.skip) return false;
      node = makeSegment(
        {
          index: datum.index,
          className: datum.className
        },
        runOptions
      );
      return true;
    });
    return [node];
  }

  // find too small segments
  const sizes = data.map(datum => {
    let angle = 0;
    if (!datum.skip) {
      angle = (datum.value / total) * TWO_PI;
    }
    return {angle: angle, index: datum.index};
  });

  let minAngle, newTotal, changeRatio;
  if (minSizeInPx > 0) {
    // adjust angles
    minAngle = (minSizeInPx + gap) / radius;
    sizes.forEach((size, index) => {
      const datum = data[index];
      if (!datum.skip && !datum.hide && size.angle < minAngle) {
        size.angle = minAngle;
      }
    });
    newTotal = sizes.reduce((acc, size) => acc + size.angle, 0);
    const excess = newTotal - total,
      totalForLargeAngles = sizes.reduce((acc, size) => (size.angle <= minAngle ? acc : acc + size.angle), 0);
    changeRatio = (totalForLargeAngles - excess) / totalForLargeAngles;
    sizes.forEach(size => {
      if (size.angle > minAngle) {
        size.angle *= changeRatio;
      }
    });
  } else if (skipIfLessInPx > 0) {
    // suppress angles
    minAngle = skipIfLessInPx / radius;
    sizes.forEach((size, index) => {
      const datum = data[index];
      if (!datum.skip && !datum.hide && size.angle < minAngle) {
        size.angle = 0;
      }
    });
    newTotal = sizes.reduce((acc, size) => acc + size.angle, 0);
    changeRatio = TWO_PI / newTotal;
    sizes.forEach(size => {
      if (size.angle > 0) {
        size.angle *= changeRatio;
      }
    });
  }

  // generate shape objects
  const shapes = [];
  let startAngle = options.startAngle || 0;
  data.forEach((datum, index) => {
    if (!datum.skip) {
      const angle = sizes[index].angle;
      if (!datum.hide) {
        shapes.push({
          index: index,
          startAngle: startAngle,
          angle: angle,
          className: datum.className
        });
      }
      startAngle += angle;
    }
  });

  return shapes.map(shape => makeSegment(shape, runOptions));
};

export const addShapes = parent => node => parent.appendChild(node);
